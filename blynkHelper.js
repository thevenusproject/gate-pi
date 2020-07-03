import Blynk from "blynk-library";
import {
  writeRPiPin,
  CYCLE_PIN,
  DISABLE_BUTTON_PIN,
  EXTERNAL_SENSOR_SAMPLE_PIN,
  OPEN_PIN,
  readRPiPin
} from "./rpiHelper";
import { exec } from "child_process";
import {saveSetting, getSetting} from "./store"

const {
  BLYNK_AUTH_TOKEN
} = process.env;
// For Local Server:
// const blynk = new Blynk.Blynk(AUTH, options = {
//   connector : new Blynk.TcpClient( options = { addr: "xxx.xxx.xxx.xxx", port: 8080 } )  // This takes all the info and directs the connection to you Local Server.
// });

var blynk;

// Blynk
async function setupBlynk() {
  blynk = new Blynk.Blynk(BLYNK_AUTH_TOKEN, {port: 80});
  blynk.on("error", (err) => {
    console.error("Blynk error event", err);
  });
  const v1 = new blynk.VirtualPin(1); // Cycle gate
  const v2 = new blynk.VirtualPin(2); // Disable button
  const v3 = new blynk.VirtualPin(3); // Open gate
  const v4 = new blynk.VirtualPin(4); // read external sensor
  const v5 = new blynk.VirtualPin(5); //  shouldNotifyOnExtTrigger
  const v6 = new blynk.VirtualPin(6); //  extTriggerEnabled
  const v7 = new blynk.VirtualPin(7);    //  keep gate open
  const blynkRPiReboot = new blynk.VirtualPin(20); // Setup Reboot Button
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
    blynk.virtualWrite(5, getSetting({ setting: "shouldNotifyOnExtTrigger" }));
  });
  v5.on("write", async function (params) {
    // write shouldNotifyOnExtTrigger
    await saveSetting({
      setting: "shouldNotifyOnExtTrigger",
      value: _.get(params, "[0]") !== "0",
    });
  });
  v6.on("read", async function (params) {
    // read extTriggerEnabled
    blynk.virtualWrite(5, getSetting({ setting: "extTriggerEnabled" }));
  });
  v6.on("write", async function (params) {
    // write extTriggerEnabled
    await saveSetting({
      setting: "extTriggerEnabled",
      value: _.get(params, "[0]") !== "0",
    });
  });
  blynkRPiReboot.on("write", function (params) {
    // Watches for V20 Button
    console.log("blynkRPiReboot", params)

    if (_.get(params, "[0]") !== "0") {
      // Runs the CLI command if the button on V10 is pressed
      // reboot - sudo /sbin/reboot
      exec("sudo /bin/systemctl restart GateOpener.service", function (err, stdout, stderr) {
        if (err) console.log(stderr);
        else console.log(stdout);
      });
    }
  });
}

function writePinFromBlynk({ pin, params }) {
  console.log("writePinFromBlynk", params);
  const value = _.get(params, "[0]") !== "1";
  writeRPiPin({ pin, value }).catch();
}

async function readPinFromBlynk({ gpioPin, blynkPin }) {
  const value = await readRPiPin(gpioPin)
  blynk.virtualWrite(blynkPin, value);
}
