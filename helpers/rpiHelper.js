import _ from 'lodash';
import gpio from 'rpi-gpio';
import { getSetting } from '../store';
import { exec } from 'child_process';

export const CYCLE_PIN = 31;
export const DISABLE_BUTTON_PIN = 33;
export const OPEN_PIN = 35;
export const EXTERNAL_SENSOR_SAMPLE_PIN = 16;
const { promise: gpiop } = gpio;

// Relay GPIOs - 31 33 35 37 (physical pin #)
// gpiop.setup(31, gpio.DIR_HIGH).then(() => main()).catch(e => console.warn(e));

export async function setupPhysicalPins() {
  console.log('setupPhysicalPins');
  await gpiop
    .setup(EXTERNAL_SENSOR_SAMPLE_PIN, gpio.DIR_IN)
    .catch((e) => console.error(e)); // Open
  await gpiop.setup(CYCLE_PIN, gpio.DIR_HIGH).catch((e) => console.error(e)); // Cycle gate
  await gpiop
    .setup(DISABLE_BUTTON_PIN, gpio.DIR_HIGH)
    .catch((e) => console.error(e)); // Disable button
  await gpiop.setup(OPEN_PIN, gpio.DIR_HIGH).catch((e) => console.error(e)); // Open gate
  // await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.error(e)); // Toggle internal sensor common
  // await gpiop.setup(37, gpio.DIR_HIGH).catch(e => console.error(e)); // Toggle internal sensor high
  // cycleRelayDemo(PIN).catch(e => console.error(e));
}

export async function writeRPiPin({ pin, value }) {
  return gpiop
    .write(pin, value)
    .catch((e) => console.error(`error setting pin ${pin}`, e));
}

export async function readRPiPin(pin) {
  return await gpiop
    .read(pin)
    .catch((e) => console.error(`error setting pin ${pin}`, e));
}

export async function cycleRelayDemo(pin) {
  _.forEach(new Array(5), (some, idx) => {
    setTimeout(() => {
      gpiop.write(pin, true);
      setTimeout(() => {
        gpiop.write(pin, false);
      }, 1000);
    }, idx * 2000);
  });
}

export async function momentaryRelaySet({ value, pin }) {
  console.log('Opening gate temporarily')
  await writeRPiPin({ pin, value: !!value });
  await sleep(2000);
  await writeRPiPin({ pin, value: !value });
}

export async function cycleGate() {
  return momentaryRelaySet({ pin: CYCLE_PIN, value: false });
}

export async function openGateTemporarily() {
  console.log('Opening gate temporarily')
  if (getSetting({ setting: 'keepOpen' }) !== true)
    await momentaryRelaySet({ pin: OPEN_PIN, value: false });
  else await openGate()
}

export async function openGate() {
  console.log('Opening gate indefinitely')
  await writeRPiPin({ pin: OPEN_PIN, value: false });
}

export async function unopenGate() {
  console.log('Unopening gate')
  await writeRPiPin({ pin: OPEN_PIN, value: true });
}

export async function sampleExternalSensor() {
  return gpiop.read(EXTERNAL_SENSOR_SAMPLE_PIN);
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gitPull() {
  console.log('gitPull');
  return new Promise((res, rej) => {
    exec('/usr/bin/git -C /home/pi/dev/gate-pi pull', function (
      err,
      stdout,
      stderr
    ) {
      if (err) {
        console.error(stderr);
        rej(err);
      } else {
        console.log(stdout);
        res();
      }
    });
  });
}

export async function pm2Restart() {
  console.log('pm2Restart');
  return new Promise((res, rej) => {
    exec('/usr/local/bin/pm2 restart GateOpener', function (
      err,
      stdout,
      stderr
    ) {
      if (err) {
        console.error(stderr);
        rej(err);
      } else {
        console.log(stdout);
        res();
      }
    });
  });
}

export async function getTemperature() {
  console.log('getTemperature');
  return new Promise((res, rej) => {
    exec('/usr/bin/vcgencmd measure_temp', function (
      err,
      stdout,
      stderr
    ) {
      if (err) {
        console.error(stderr);
        rej(err);
      } else {
        console.log(stdout);
        res(stdout);
      }
    });
  });
}

export async function getCPUVoltage() {
  console.log('getCPUVoltage');
  return new Promise((res, rej) => {
    exec('/usr/bin/vcgencmd measure_volts core', function (
      err,
      stdout,
      stderr
    ) {
      if (err) {
        console.error(stderr);
        rej(err);
      } else {
        console.log(stdout);
        res(stdout);
      }
    });
  });
}
