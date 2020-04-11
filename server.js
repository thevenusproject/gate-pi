import gpio from 'rpi-gpio'
import _ from 'lodash'
import {config as dotenv_config} from 'dotenv'

dotenv_config()
// console.log(`Your port is ${process.env.PORT}`); // 3000

const {promise: gpiop} = gpio;
// Relay GPIOs - 31 33 35 37 (physical pin #)
gpiop.setup(31, gpio.DIR_LOW).then(() => main()).catch(e => console.warn(e));

async function main() {
  await gpiop.setup(33, gpio.DIR_LOW).catch(e => console.warn(e));
  await gpiop.setup(35, gpio.DIR_LOW).catch(e => console.warn(e));
  await gpiop.setup(37, gpio.DIR_LOW).catch(e => console.warn(e));
  // cycle().catch(e => console.warn(e));
}

async function cycle() {
  _.forEach(new Array(5), (some, idx) => {
    setTimeout(() => {
      gpio.write(31, true)
      console.log('Pin 6 on')
      setTimeout(() => {
        console.log('Pin 6 off')
        gpio.write(31, false)
      }, 1000);
    }, idx * 2000 );
  })
}

//
// gpiop.setup(7, gpiop.DIR_OUT)
//   .then(() => {
//     return gpiop.write(7, true)
//   })
//   .catch((err) => {
//     console.log('Error: ', err.toString())
//   })
// gpiop.setup(7, gpiop.DIR_OUT)
//   .then(() => {
//     return gpiop.write(7, true)
//   })
//   .catch((err) => {
//     console.log('Error: ', err.toString())
//   })
//
