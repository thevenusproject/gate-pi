import gpio from "rpi-gpio";
import _ from "lodash";
import { config as dotenv_config } from "dotenv";
import Blynk from "blynk-library";
import Telegraf, { Telegram } from "telegraf";

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

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("Process terminated");
  });
});

// For Local Server:
// const blynk = new Blynk.Blynk(AUTH, options = {
//   connector : new Blynk.TcpClient( options = { addr: "xxx.xxx.xxx.xxx", port: 8080 } )  // This takes all the info and directs the connection to you Local Server.
// });

const CYCLE_PIN = 31;
const DISABLE_BUTTON_PIN = 33;
const OPEN_PIN = 35;
const EXTERNAL_SENSOR_SAMPLE_PIN = 16;

const v1 = new blynk.VirtualPin(1);
const v2 = new blynk.VirtualPin(2);
const v3 = new blynk.VirtualPin(3);
const v4 = new blynk.VirtualPin(4);
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

async function openGate() {
  return momentaryRelaySet({ pin: OPEN_PIN, value: false });
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
  v4.on("read", async function (params) {
    // read external sensor
    readPinFromBlynk({ pin: EXTERNAL_SENSOR_SAMPLE_PIN, params }).catch();
  });
  blynkRPiReboot.on("write", function (param) {
    // Watches for V10 Button
    if (param == 1) {
      // Runs the CLI command if the button on V10 is pressed
      process.exec("sudo /sbin/shutdown -r", function (msg) {
        console.log(msg);
      });
    }
  });
}

function writePinFromBlynk({ pin, params }) {
  const value = _.get(params, "[0]") !== "1";
  writeRPiPin({ pin, value });
}

async function readPinFromBlynk({ pin }) {
  const value = await gpiop
    .read(pin)
    .catch((e) => console.log(`error setting pin ${pin}`, e));
  blynk.virtualWrite(4, value);
}

async function setup() {
  await setupPhysicalPins().catch(e => killProcess(e));
  await setupBlynkPins().catch(e => killProcess(e));
  externalSensorPolling().catch(e => killProcess(e));
  setupTelegram().catch(e => killProcess(e));;
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
  while (true) {
    await sleep(1000);
    const sensorIsOpen = await gpiop.read(EXTERNAL_SENSOR_SAMPLE_PIN);
    if (!sensorIsOpen) {
      console.log("External sensor triggered. Opening gate");
      await openGate();
      await sendTelegramGroupMessage(
        "External sensor triggered, gate is opening"
      );
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
    if (chat_id === MY_CHAT_ID || chat_id === GATE_GROUP_CHAT_ID) next();
    else
      throw new Error(
        `Telegram Message from unauthorized chat! Chat ID ${chat_id}`
      );
  });
  telegraf.command("open", async (ctx) => {
    await openGate();
    ctx.reply("Gate is opening");
  });
  telegraf.command("cycle", async (ctx) => {
    await cycleGate();
    ctx.reply("Gate cycling");
  });
  telegraf.launch();
}

async function sendTelegramGroupMessage(message) {
  await telegram.sendMessage(GATE_GROUP_CHAT_ID, message);
}

//

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcess(msg) {
  console.log('killing process', msg)
  process.kill(process.pid, 'SIGTERM')
}

setup().catch((e) => console.log("err in setup", e));
