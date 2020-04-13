import gpio from 'rpi-gpio'
import _ from 'lodash'
import {config as dotenv_config} from 'dotenv'
import Blynk from 'blynk-library';
dotenv_config()
// console.log(`Your port is ${process.env.PORT}`); // 3000
const AUTH = process.env.BLYNK_AUTH_TOKEN;
var blynk = new Blynk.Blynk(AUTH);
// For Local Server:
// const blynk = new Blynk.Blynk(AUTH, options = {
//   connector : new Blynk.TcpClient( options = { addr: "xxx.xxx.xxx.xxx", port: 8080 } )  // This takes all the info and directs the connection to you Local Server.
// });

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
  await gpiop.setup(17, gpio.DIR_IN).catch(e => console.warn(e)); // Open
  await gpiop.setup(31, gpio.DIR_HIGH).catch(e => console.warn(e)); // Cycle gate
  await gpiop.setup(33, gpio.DIR_HIGH).catch(e => console.warn(e)); // Disable button
  await gpiop.setup(35, gpio.DIR_HIGH).catch(e => console.warn(e)); // Open gate
  await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.warn(e)); // Open
  // cycleRelay37Demo().catch(e => console.warn(e));
}

async function setupBlynkPins() {
  console.log('setupBlynkPins')

  v1.on('write', async function (params) {
    // Cycle gate
    writePinFromBlynk({pin: 31, params})
  });

  v2.on('write', async function (params) {
    // Disable button
    writePinFromBlynk({pin: 33, params})
  });

  v3.on('write', async function (params) {
    // Open gate
    writePinFromBlynk({pin: 35, params})
  });

  v4.on('read', async function (params) {
    // read external sensor
    readPinFromBlynk({pin: 17, params}).catch()
  });

  blynkRPiReboot.on('write', function(param) {  // Watches for V10 Button
    if (param == 1) {  // Runs the CLI command if the button on V10 is pressed
      process.exec('sudo /sbin/shutdown -r', function (msg) { console.log(msg) });
    }
  });
}

function writePinFromBlynk({pin, params}) {
  const value = _.get(params,'[0]') !== "1";
  console.log('writePinFromBlynk',pin, value )
  gpiop.write(pin, value).catch(e => console.log(`error setting pin ${pin}`, e))
}

async function readPinFromBlynk({pin}) {
  console.log('readPinFromBlynk',pin)
  const value = await gpiop.read(pin).catch(e => console.log(`error setting pin ${pin}`, e))
  blynk.virtualWrite(4, value);
}

async function setup() {
  await setupPhysicalPins()
  await setupBlynkPins()
  externalSensorPolling()
}

setup().catch(e => console.log('err in pins setup', e));
//
// v9.on('read', function() {
//   v9.write(new Date().getSeconds());
// });
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cycleRelay37Demo() {
  _.forEach(new Array(5), (some, idx) => {
    setTimeout(() => {
      gpiop.write(37, true)
      console.log('Pin 6 on')
      setTimeout(() => {
        console.log('Pin 6 off')
        gpiop.write(37, false)
      }, 1000);
    }, idx * 2000 );
  })
}

async function externalSensorPolling() {
  while (true) {
    await sleep(1000)
    const sensorIsOpen = await gpiop.read(17)
    if (!sensorIsOpen) {
      console.log('Internal sensor triggered. Opening gate')
      await gpiop.write(35, false)
      await sleep(700)
      await gpiop.write(35, true)
    }
  }
}
