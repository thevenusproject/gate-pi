import gpio from 'rpi-gpio'
import _ from 'lodash'
import {config as dotenv_config} from 'dotenv'

dotenv_config()
console.log(`Your port is ${process.env.PORT}`); // 3000

const {promise: gpiop} = gpio;

// gpio.setup(7, gpio.DIR_IN, readInput);
// function readInput(err) {
//   if (err) throw err;
//   gpio.read(7, function (err, value) {
//     if (err) throw err;
//     console.log('The value is ' + value);
//   });
// }
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
