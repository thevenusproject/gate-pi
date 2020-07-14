import Blynk from 'blynk-library';
import {
  writeRPiPin,
  CYCLE_PIN,
  DISABLE_BUTTON_PIN,
  EXTERNAL_SENSOR_SAMPLE_PIN,
  OPEN_PIN,
  readRPiPin,
  gitPull,
  pm2Restart, getCPUVoltage, getTemperature,
} from './rpiHelper';
import { exec } from 'child_process';
import { saveSetting, getSetting } from '../store';
import _ from 'lodash';
const { BLYNK_AUTH_TOKEN, BLYNK_SERVER } = process.env;
// For Local Server:
// const blynk = new Blynk.Blynk(BLYNK_AUTH_TOKEN, options = {
//   connector : new Blynk.TcpClient( options = { addr: "xxx.xxx.xxx.xxx", port: 8080 } )  // This takes all the info and directs the connection to you Local Server.
// });

var blynk;

// Blynk
export async function setupBlynk() {
  // blynk = new Blynk.Blynk(BLYNK_AUTH_TOKEN, {port: 80});
  blynk = new Blynk.Blynk(BLYNK_AUTH_TOKEN, {
    connector: new Blynk.TcpClient({ addr: BLYNK_SERVER, port: 8080 }), // This takes all the info and directs the connection to you Local Server.
  });
  blynk.on('error', (err) => {
    console.error('Blynk error event', err);
  });
  const v1 = new blynk.VirtualPin(1); // Cycle gate
  const v2 = new blynk.VirtualPin(2); // Disable button
  const v3 = new blynk.VirtualPin(3); // Open gate
  const v4 = new blynk.VirtualPin(4); // read external sensor
  const v5 = new blynk.VirtualPin(5); //  shouldNotifyOnExtTrigger
  const v6 = new blynk.VirtualPin(6); //  extTriggerEnabled
  const v7 = new blynk.VirtualPin(7); //  keep gate open
  const temperaturePin = new blynk.VirtualPin(8); //  keep gate open
  const cpuVoltagePin = new blynk.VirtualPin(9); //  keep gate open
  const blynkGateOpenerRestart = new blynk.VirtualPin(20); // Setup Reboot Button
  const blynkGateOpenerReboot = new blynk.VirtualPin(21); // Setup Reboot Button
  const blynkGitPullRestart = new blynk.VirtualPin(22); // Setup Reboot Button
  v1.on('write', async function (params) {
    // Cycle gate
    writeGpioPinFromBlynk({ pin: CYCLE_PIN, params });
  });
  v2.on('write', async function (params) {
    // Disable button
    writeGpioPinFromBlynk({ pin: DISABLE_BUTTON_PIN, params });
  });
  v3.on('write', async function (params) {
    // Open gate
    writeGpioPinFromBlynk({ pin: OPEN_PIN, params });
  });
  v4.on('read', async function () {
    // read external sensor
    readPinFromGpioToBlynk({
      gpioPin: EXTERNAL_SENSOR_SAMPLE_PIN,
      blynkPin: 4,
    }).catch();
  });
  v5.on('read', async function (params) {
    // read shouldNotifyOnExtTrigger
    blynk.virtualWrite(5, getSetting({ setting: 'shouldNotifyOnExtTrigger' }));
  });
  v5.on('write', async function (params) {
    // write shouldNotifyOnExtTrigger
    await saveSetting({
      setting: 'shouldNotifyOnExtTrigger',
      value: _.get(params, '[0]') !== '0',
    });
  });
  v6.on('read', async function (params) {
    // read extTriggerEnabled
    blynk.virtualWrite(6, getSetting({ setting: 'extTriggerEnabled' }));
  });
  v6.on('write', async function (params) {
    // write extTriggerEnabled
    await saveSetting({
      setting: 'extTriggerEnabled',
      value: _.get(params, '[0]') !== '0',
    });
  });
  blynkGateOpenerRestart.on('write', function (params) {
    // Watches for V20 Button
    console.log('blynkGateOpenerRestart', params);

    if (_.get(params, '[0]') !== '0') {
      // Runs the CLI command if the button on V10 is pressed
      // reboot - sudo /sbin/reboot
      exec("pm2 restart 'GateOpener'", function (err, stdout, stderr) {
        if (err) console.error(stderr);
        else console.log(stdout);
      });
    }
  });
  blynkGateOpenerReboot.on('write', function (params) {
    // Watches for V21 Button
    console.log('blynkGateOpenerReboot', params);
    if (_.get(params, '[0]') !== '0') {
      // Runs the CLI command if the button on V10 is pressed
      // reboot - sudo /sbin/reboot
      exec('sudo /sbin/reboot', function (err, stdout, stderr) {
        if (err) console.error(stderr);
        else console.log(stdout);
      });
    }
  });
  blynkGitPullRestart.on('write', async function (params) {
    // Watches for V22 Button
    if (_.get(params, '[0]') !== '0') {
      console.log('blynkGitPullRestart', params);
      await gitPull();
      await pm2Restart();
    }
  });
  temperaturePin.on('read', async function () {
    const temp = getTemperature();
    blynk.virtualWrite(8, temp);
  });
  cpuVoltagePin.on('read', async function () {
    const voltage = await getCPUVoltage();
    blynk.virtualWrite(9, voltage);
  });
}

function writeGpioPinFromBlynk({ pin, params }) {
  console.log('writeGpioPinFromBlynk', params);
  const value = _.get(params, '[0]') !== '1';
  writeRPiPin({ pin, value }).catch();
}

async function readPinFromGpioToBlynk({ gpioPin, blynkPin }) {
  const value = await readRPiPin(gpioPin);
  blynk.virtualWrite(blynkPin, value);
}
