import gpio from 'rpi-gpio'
import _ from 'lodash'
import {config as dotenv_config} from 'dotenv'

dotenv_config()
console.log(`Your port is ${process.env.PORT}`); // 3000

const {promise: gpiop} = gpio;
// Relay GPIOs - 6 13 19 26
gpio.setup(6, gpio.DIR_OUT);

async function main() {
  _.forEach(new Array(5), (some, idx) => {
    setTimeout(() => {
      gpio.write(6, false)
      console.log('Pin 6 off')
    }, idx * 1000 );
    setTimeout(() => {
      console.log('Pin 6 on')
      gpio.write(6, true)
    }, idx * 1000 + 500);
  })
}
main().catch(e => console.warn(e))
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
