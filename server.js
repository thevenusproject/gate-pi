import gpio from 'rpi-gpio'
import _ from 'lodash'
import {config as dotenv_config} from 'dotenv'
import Blynk from 'blynk-library';
import Telegraf, {Telegram} from 'telegraf';
dotenv_config()
const telegram = new Telegram(process.env.TELEGRAM_TOKEN)
// console.log(`Your port is ${process.env.PORT}`); // 3000
var blynk = new Blynk.Blynk(process.env.BLYNK_AUTH_TOKEN);
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
const blynkRPiReboot = new blynk.VirtualPin(20);  // Setup Reboot Button

const {promise: gpiop} = gpio;
// Relay GPIOs - 31 33 35 37 (physical pin #)
// gpiop.setup(31, gpio.DIR_HIGH).then(() => main()).catch(e => console.warn(e));

async function setupPhysicalPins() {
  console.log('setupPhysicalPins')
  await gpiop.setup(EXTERNAL_SENSOR_SAMPLE_PIN, gpio.DIR_IN).catch(e => console.warn(e)); // Open
  await gpiop.setup(CYCLE_PIN, gpio.DIR_HIGH).catch(e => console.warn(e)); // Cycle gate
  await gpiop.setup(DISABLE_BUTTON_PIN, gpio.DIR_HIGH).catch(e => console.warn(e)); // Disable button
  await gpiop.setup(OPEN_PIN, gpio.DIR_HIGH).catch(e => console.warn(e)); // Open gate
  // await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.warn(e)); // Toggle internal sensor common
  // await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.warn(e)); // Toggle internal sensor high
  // cycleRelayDemo(PIN).catch(e => console.warn(e));
}

async function writeRPiPin({pin, value}) {
  return gpiop.write(pin, value).catch(e => console.log(`error setting pin ${pin}`, e))
}

async function cycleGate() {
  return momentaryRelaySet({pin: CYCLE_PIN, value: true})
}

async function openGate() {
  return momentaryRelaySet({pin: OPEN_PIN, value: true})
}


// Blynk
async function setupBlynkPins() {
  v1.on('write', async function (params) {
    // Cycle gate
    writePinFromBlynk({pin: CYCLE_PIN, params})
  });
  v2.on('write', async function (params) {
    // Disable button
    writePinFromBlynk({pin: DISABLE_BUTTON_PIN, params})
  });
  v3.on('write', async function (params) {
    // Open gate
    writePinFromBlynk({pin: OPEN_PIN, params})
  });
  v4.on('read', async function (params) {
    // read external sensor
    readPinFromBlynk({pin: EXTERNAL_SENSOR_SAMPLE_PIN, params}).catch()
  });
  blynkRPiReboot.on('write', function(param) {  // Watches for V10 Button
    if (param == 1) {  // Runs the CLI command if the button on V10 is pressed
      process.exec('sudo /sbin/shutdown -r', function (msg) { console.log(msg) });
    }
  });
}
function writePinFromBlynk({pin, params}) {
  const value = _.get(params,'[0]') !== "1";
  writeRPiPin({pin, value})
}
async function readPinFromBlynk({pin}) {
  const value = await gpiop.read(pin).catch(e => console.log(`error setting pin ${pin}`, e))
  blynk.virtualWrite(4, value);
}

async function setup() {
  await setupPhysicalPins()
  await setupBlynkPins()
  externalSensorPolling()
  setupTelegram()
}

async function cycleRelayDemo(pin) {
  _.forEach(new Array(5), (some, idx) => {
    setTimeout(() => {
      gpiop.write(pin, true)
      setTimeout(() => {
        gpiop.write(pin, false)
      }, 1000);
    }, idx * 2000 );
  })
}

async function externalSensorPolling() {
  while (true) {
    await sleep(1000)
    const sensorIsOpen = await gpiop.read(16)
    if (!sensorIsOpen) {
      console.log('Internal sensor triggered. Opening gate')
      await gpiop.write(35, false)
      await sleep(700)
      await gpiop.write(35, true)
    }
  }
}

async function momentaryRelaySet({value, pin}) {
  await writeRPiPin({pin, value: !!value})
  await sleep(500)
  await writeRPiPin({pin, value: !value})
}

// Telegram
async function setupTelegram() {
  telegram.start((ctx) => {
    ctx.reply('Welcome!')
  })
  telegram.command('open', async (ctx) => {
    await openGate()
    ctx.reply('Gate is opening')
  })
  telegram.command('cycle', async (ctx) => {
    await cycleGate()
    ctx.reply('Gate cycling')
  })
  telegram.launch()
}

async function sendTelegramGroupMessage(message) {
  await telegram.sendMessage(process.env.MY_CHAT_ID,message);
}
//

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

setup().catch(e => console.log('err in setup', e));
