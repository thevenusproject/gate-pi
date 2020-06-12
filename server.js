import gpio from "rpi-gpio";
import _ from "lodash";
import { config as dotenv_config } from "dotenv";
import Blynk from "blynk-library";
import Telegraf, { Telegram } from "telegraf";
import { exec } from "child_process";
import axios from "axios";
import fs from "fs";
import Path from "path";
import nconf from "nconf";

const INTERCOM_SNAPSHOT_URL =
  "http://gate-intercom.local:3438/stream/snapshot.jpeg";
const INTERCOM_STREAM_URL =
  "http://gate-intercom.local:3438/stream";
dotenv_config();
// console.log(`Your port is ${process.env.PORT}`); // 3000
const {
  MY_CHAT_ID,
  GATE_GROUP_CHAT_ID,
  BLYNK_AUTH_TOKEN,
  TELEGRAM_TOKEN,
} = process.env;
const telegraf = new Telegraf(TELEGRAM_TOKEN); // required for replying to messages
const telegram = new Telegram(TELEGRAM_TOKEN); // required for initiating conversation
var blynk = new Blynk.Blynk(BLYNK_AUTH_TOKEN);
blynk.on('error', (err) => {
  console.error('Blynk error event', err);
});

//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//
nconf.file({ file: "./config.json" });
nconf.load();

// process.on("SIGTERM", () => {
// server.close(() => {
//   console.log("Process terminated");
// });
// });

// For Local Server:
// const blynk = new Blynk.Blynk(AUTH, options = {
//   connector : new Blynk.TcpClient( options = { addr: "xxx.xxx.xxx.xxx", port: 8080 } )  // This takes all the info and directs the connection to you Local Server.
// });

const CYCLE_PIN = 31;
const DISABLE_BUTTON_PIN = 33;
const OPEN_PIN = 35;
const EXTERNAL_SENSOR_SAMPLE_PIN = 16;

const v1 = new blynk.VirtualPin(1);    // Cycle gate
const v2 = new blynk.VirtualPin(2);    // Disable button
const v3 = new blynk.VirtualPin(3);    // Open gate
const v4 = new blynk.VirtualPin(4);    // read external sensor
const v5 = new blynk.VirtualPin(5);    //  shouldNotifyOnExtTrigger
const v6 = new blynk.VirtualPin(6);    //  extTriggerEnabled
// const v7 = new blynk.VirtualPin(7);    //  keep gate open
const blynkRPiReboot = new blynk.VirtualPin(20); // Setup Reboot Button

const { promise: gpiop } = gpio;
// Relay GPIOs - 31 33 35 37 (physical pin #)
// gpiop.setup(31, gpio.DIR_HIGH).then(() => main()).catch(e => console.warn(e));

async function setupPhysicalPins() {
  console.log("setupPhysicalPins");
  await gpiop
    .setup(EXTERNAL_SENSOR_SAMPLE_PIN, gpio.DIR_IN)
    .catch((e) => console.warn(e)); // Open
  await gpiop.setup(CYCLE_PIN, gpio.DIR_HIGH).catch((e) => console.warn(e)); // Cycle gate
  await gpiop
    .setup(DISABLE_BUTTON_PIN, gpio.DIR_HIGH)
    .catch((e) => console.warn(e)); // Disable button
  await gpiop.setup(OPEN_PIN, gpio.DIR_HIGH).catch((e) => console.warn(e)); // Open gate
  // await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.warn(e)); // Toggle internal sensor common
  // await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.warn(e)); // Toggle internal sensor high
  // cycleRelayDemo(PIN).catch(e => console.warn(e));
}

async function writeRPiPin({ pin, value }) {
  return gpiop
    .write(pin, value)
    .catch((e) => console.log(`error setting pin ${pin}`, e));
}

async function cycleGate() {
  return momentaryRelaySet({ pin: CYCLE_PIN, value: false });
}

async function openGateTemporarily() {
  if (!getSetting({setting: 'keepOpen'})) return momentaryRelaySet({ pin: OPEN_PIN, value: false });
}

async function openGate() {
  await writeRPiPin({ pin: OPEN_PIN, value: false });
}
async function unopenGate() {
  await writeRPiPin({ pin: OPEN_PIN, value: true });
}

// Blynk
async function setupBlynkPins() {
  v1.on("write", async function (params) {
    // Cycle gate
    writePinFromBlynk({ pin: CYCLE_PIN, params });
  });
  v2.on("write", async function (params) {
    // Disable button
    writePinFromBlynk({ pin: DISABLE_BUTTON_PIN, params });
  });
  v3.on("write", async function (params) {
    // Open gate
    writePinFromBlynk({ pin: OPEN_PIN, params });
  });
  v4.on("read", async function () {
    // read external sensor
    readPinFromBlynk({
      gpioPin: EXTERNAL_SENSOR_SAMPLE_PIN,
      blynkPin: 4,
    }).catch();
  });
  v5.on("read", async function (params) {
    // read shouldNotifyOnExtTrigger
    blynk.virtualWrite(5, getSetting({setting: 'shouldNotifyOnExtTrigger'}));
  });
  v5.on("write", async function (params) {
    // write shouldNotifyOnExtTrigger
    saveSetting({setting: 'shouldNotifyOnExtTrigger',value: _.get(params, "[0]") !== "0"});
  });
  v6.on("read", async function (params) {
    // read extTriggerEnabled
    blynk.virtualWrite(5, getSetting({setting: 'extTriggerEnabled'}));
  });
  v6.on("write", async function (params) {
    // write extTriggerEnabled
    saveSetting({setting: 'extTriggerEnabled',value: _.get(params, "[0]") !== "0"});
  });
  blynkRPiReboot.on("write", function (param) {
    // Watches for V10 Button
    if (param === 1) {
      // Runs the CLI command if the button on V10 is pressed
      exec("sudo /sbin/reboot", function (err, stdout, stderr) {
        if (err) console.log(stderr);
        else console.log(stdout);
      });
    }
  });
}

function writePinFromBlynk({ pin, params }) {
  console.log('writePinFromBlynk', params)
  const value = _.get(params, "[0]") !== "1";
  writeRPiPin({ pin, value }).catch();
}

async function readPinFromBlynk({ gpioPin, blynkPin }) {
  const value = await gpiop
    .read(gpioPin)
    .catch((e) => console.log(`error setting pin ${gpioPin}`, e));
  blynk.virtualWrite(blynkPin, value);
}

async function setup() {
  await setupPhysicalPins().catch((e) => killProcess(e));
  await setupBlynkPins().catch((e) => killProcess(e));
  await setupTelegram().catch((e) => {
    console.log('setupTelegram err ', e)
    killProcess(e)
  });
  externalSensorPolling().catch((e) => killProcess(e));
}

async function cycleRelayDemo(pin) {
  _.forEach(new Array(5), (some, idx) => {
    setTimeout(() => {
      gpiop.write(pin, true);
      setTimeout(() => {
        gpiop.write(pin, false);
      }, 1000);
    }, idx * 2000);
  });
}

async function externalSensorPolling() {
  const TIME_STEP = 0.5; // seconds
  const COUNT_TRIGGER = 1;
  const COOL_DOWN_TIME = 120; // seconds
  let triggerCounter = 0;
  let coolDownNotificationsCounter = 0;
  while (true) {
    await sleep(TIME_STEP * 1000);
    const sensorIsBlocked = await gpiop.read(EXTERNAL_SENSOR_SAMPLE_PIN);
    if (sensorIsBlocked) {
      // console.log("Ext. sensor triggered. counter ", triggerCounter);
      if (triggerCounter >= COUNT_TRIGGER) {
        // console.log("Ext. sensor triggered. Opening gate");
        triggerCounter = 0;
        if (getSetting({setting: 'extTriggerEnabled'})) await openGateTemporarily();
        const day = new Date().getDay();
        let response = pickRandomFromArray([
          "External sensor. Opening gate",
          // "Ext. sensor triggered, maybe a new package?? So exciting..",
          // "Ext. sensor triggered, is Rox checking for mail again?",
        ]);
        if (day === 0) response = "External sensor. Tomorrow is garbage day!";
        // if (day === 6)
        //   response =
        //     "External sensor. It could have been a Saturday tour! If not for this virus.. I'll spin up my antivirus";
        if (coolDownNotificationsCounter <= 0) {
          coolDownNotificationsCounter = 120;
          const extTriggerEnabled = getSetting({setting: 'extTriggerEnabled'});
          if (extTriggerEnabled && getSetting({setting: 'shouldNotifyOnExtTrigger'})) {
            await sendTelegramGroupMessage(response).catch(e => console.log('err sendTelegramGroupMessage', e));
            await intercomCameraSnapshot().catch(e => console.log('err intercomCameraSnapshot', e));
          } else {
            await sendTelegramAdminMessage(extTriggerEnabled ? response : 'Ext sensor was triggered but opening is disabled').catch(e => console.log('extTriggerEnabled',extTriggerEnabled,'err sendTelegramAdminMessage', e));
            await intercomCameraSnapshot().catch(e => console.log('extTriggerEnabled',extTriggerEnabled,'err intercomCameraSnapshot', e));
          }
        }
        // console.log('coolDownNotificationsCounter', coolDownNotificationsCounter)
      } else {
        triggerCounter += 1;
      }
    }
    if (coolDownNotificationsCounter > 0) {
      --coolDownNotificationsCounter;
    }
  }
}

async function momentaryRelaySet({ value, pin }) {
  await writeRPiPin({ pin, value: !!value });
  await sleep(500);
  await writeRPiPin({ pin, value: !value });
}

// Telegram
async function setupTelegram() {
  telegraf.start((ctx) => {
    ctx.reply("Welcome!");
  });
  telegraf.use(async (ctx, next) => {
    const chat_id = _.get(ctx, "update.message.chat.id") + "";
    if (chat_id && (chat_id === MY_CHAT_ID || chat_id === GATE_GROUP_CHAT_ID))
      next();
    else if (chat_id)
      console.warn(
        `Telegram Message from unauthorized chat! Chat ID ${chat_id}`
      );
    else console.log("Message irrelevant to the bot");
  });
  telegraf.command("open", async (ctx) => {
    await openGateTemporarily();
    ctx.reply("Gate is opening");
  });
  telegraf.command("cycle", async (ctx) => {
    await cycleGate();
    ctx.reply("Gate cycling");
  });
  telegraf.command("intercom_snapshot", async (ctx) => {
    const imagePath = await downloadImage({url: INTERCOM_SNAPSHOT_URL});
    await ctx.replyWithPhoto({source: imagePath}, {caption: INTERCOM_STREAM_URL}).catch(e => {
      deleteImage(imagePath)
      throw e;
    });
    await deleteImage(imagePath);
  });
  telegraf.command("notify_on_ext_trigger", async (ctx) => {
    const newValue = !getSetting({setting: 'shouldNotifyOnExtTrigger'})
    saveSetting({setting: 'shouldNotifyOnExtTrigger', value: newValue});
    ctx.reply(
      `Notifications on external trigger are ${
        newValue ? "ON" : "OFF"
      }`
    );
  });
  telegraf.command("toggle_opening_on_ext_sensor", async (ctx) => {
    const newValue = !getSetting({setting: 'extTriggerEnabled'});
    saveSetting({setting: 'extTriggerEnabled', value: newValue});
    ctx.reply(
      `Opening the gate on external trigger is ${
        newValue ? "ENABLED" : "DISABLED"
      }`
    );
  });
  telegraf.command("toggle_keep_open", async (ctx) => {
    const newValue = !getSetting({setting: 'keepOpen'});
    await saveSetting({setting: 'keepOpen', value: newValue}).catch(e => ctx.reply('failed saving setting keepOpen'));
    if (!!newValue) openGate().catch();
    else await unopenGate();
    ctx.reply(
      `"Keep the gate open" is ${
        newValue ? "ON" : "OFF"
      }`
    );
  });
  telegraf.command("status", async (ctx) => {
    const status = `Notify on external sensor is ${getSetting({setting: 'shouldNotifyOnExtTrigger'}) ? 'ON' : 'OFF'}\n`
    + `External sensor is ${getSetting({setting: 'extTriggerEnabled'}) ? 'ENABLED' : 'DISABLED'}\n`
    + `Keep gate open is ${getSetting({setting: 'keepOpen'}) ? 'ON' : 'OFF'}`
    ctx.reply(status);
  });
  telegraf.command("is_alive", async (ctx) => {
    const responses = [
      "I'm still alive. Pretty boring here though...",
      "There's a package for you here! Not really, just want some company, wink wink",
      "Hmm hmm, are YOU still alive?",
      "I think raccoons are planning a coup. If I'm silent for hours, something is probably wrong",
      "Corcen here!",
    ];
    const response = pickRandomFromArray(responses);
    ctx.reply(response);
  });
  telegraf.command("echo_to_group", (ctx) => {
    const text = _.get(ctx, "update.message.text") || "";
    const message = text.replace("/echo_to_group ", "");
    if (message && message !== '/echo_to_group') sendTelegramGroupMessage(message);
  });
  await telegraf.launch();
  let response = pickRandomFromArray([
    "I'm back online, how long was I out? Minutes? Days? Years???",
    "Reporting back online",
    "Corcen here, working as usual",
    "A lovely day to be back online again!",
  ]);
  await sendTelegramAdminMessage(response);
}

async function sendTelegramGroupMessage(message) {
  await telegram.sendMessage(GATE_GROUP_CHAT_ID, message);
}
async function sendTelegramGroupImage(imagePath) {
  await telegram.sendPhoto(GATE_GROUP_CHAT_ID, { source: imagePath }, {caption: INTERCOM_STREAM_URL});
}

async function sendTelegramAdminMessage(message) {
  await telegram.sendMessage(MY_CHAT_ID, message);
}

async function sendTelegramAdminImage(imagePath) {
  await telegram.sendPhoto(MY_CHAT_ID, { source: imagePath }, {caption: INTERCOM_STREAM_URL});
}

async function intercomCameraSnapshot() {
  const imagePath = await downloadImage({ url: INTERCOM_SNAPSHOT_URL });
  if (getSetting({setting: 'shouldNotifyOnExtTrigger'}) && getSetting({setting: 'extTriggerEnabled'})) {
    await sendTelegramGroupImage(imagePath).catch(e => {
      deleteImage(imagePath)
      throw e
    })
  } else {
    await sendTelegramAdminImage(imagePath).catch(e => {
      deleteImage(imagePath)
      throw e
    })
  }
  await deleteImage(imagePath)
}

async function downloadImage({ url }) {
  // const path = `${__dirname}/intercom_photos/${Date.now()}.jpg`;
  const imagePath = Path.resolve(__dirname, "intercom_photos", `${Date.now()}.jpg`);
  const writer = fs.createWriteStream(imagePath);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", (res) => {
      resolve(imagePath);
    });
    writer.on("error", reject);
  });
}

async function deleteImage(imagePath) {
  fs.unlinkSync(imagePath);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcess(msg) {
  console.log("killing process", msg);
  process.kill(process.pid, "SIGTERM");
}

function pickRandomFromArray(arr) {
  if (!arr || !Array.isArray(arr))
    console.warn("invalid arr in pickRandomFromArray");
  else return arr[Math.floor(Math.random() * arr.length)];
}

function getSetting({ setting }) {
  return nconf.get(`settings:${setting}`);
}

async function saveSetting({ setting, value }) {
  nconf.set(`settings:${setting}`, value);
  return new Promise((res, rej) => {
    nconf.save(function (err, data) {
      if (!err) res(data)
      else fs.readFile("./config.json", function (err, data) {
        console.dir(JSON.parse(data.toString()));
        rej(new Error('Err in saveSetting'))
      });
    });
  });
}

setup().catch((e) => console.log("err in setup", e));
