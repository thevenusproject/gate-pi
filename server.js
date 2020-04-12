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

const {promise: gpiop} = gpio;
// Relay GPIOs - 31 33 35 37 (physical pin #)
// gpiop.setup(31, gpio.DIR_HIGH).then(() => main()).catch(e => console.warn(e));

async function setupPhysicalPins() {
  await gpiop.setup(31, gpio.DIR_HIGH).catch(e => console.warn(e)); // Open
  await gpiop.setup(33, gpio.DIR_HIGH).catch(e => console.warn(e)); // Open
  await gpiop.setup(35, gpio.DIR_HIGH).catch(e => console.warn(e)); // Open
  await gpiop.setup(37, gpio.DIR_LOW).catch(e => console.warn(e)); // Closed
  // cycleRelay37Demo().catch(e => console.warn(e));
}

async function setupBlynkPins() {

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
}

function writePinFromBlynk({pin, params}) {
  const value = _.get(params,'[0]') !== "1";
  gpiop.write(pin, value).catch(e => console.log(`error setting pin ${pin}`, e))
}

async function setup() {
  await setupPhysicalPins()
  await setupBlynkPins()
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
