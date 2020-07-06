import _ from "lodash";
import {initStore, getSetting} from './store';
initStore();
import {sampleExternalSensor, setupPhysicalPins, sleep, openGateTemporarily} from './helpers/rpiHelper';
import {setupTelegram, sendTelegramGroupMessage, sendTelegramAdminMessage} from "./helpers/telegramHelper";
import {camerasSnapshot} from "./helpers/telegramHelper";
import {killProcess, pickRandomFromArray} from "./utils";
import {setupBlynk} from "./helpers/blynkHelper";

async function init() {
  await setupPhysicalPins().catch((e) => killProcess(e));
  await setupBlynk().catch((e) => killProcess(e));
  await setupTelegram().catch((e) => {
    console.log("setupTelegram err ", e);
    killProcess(e);
  });
  externalSensorPolling().catch((e) => killProcess(e));
}

async function externalSensorPolling() {
  const TIME_STEP = 0.5; // seconds
  const COUNT_TRIGGER = 1;
  const COOL_DOWN_TIME = 120; // seconds
  let triggerCounter = 0;
  let coolDownNotificationsCounter = 0;
  while (true) {
    await sleep(TIME_STEP * 1000);
    const sensorIsBlocked = await sampleExternalSensor();
    if (sensorIsBlocked) {
      // console.log("Ext. sensor triggered. counter ", triggerCounter);
      if (triggerCounter >= COUNT_TRIGGER) {
        const extTriggerEnabled = getSetting({ setting: "extTriggerEnabled" });
        const shouldNotifyOnExtTrigger = getSetting({
          setting: "shouldNotifyOnExtTrigger",
        });
        // console.log("Ext. sensor triggered. Opening gate");
        triggerCounter = 0;
        if (extTriggerEnabled) {
          await openGateTemporarily();
          const day = new Date().getDay();
          let response = pickRandomFromArray([
            "External sensor. Opening gate",
            // "Ext. sensor triggered, maybe a new package?? So exciting..",
            // "Ext. sensor triggered, is Rox checking for mail again?",
          ]);
          if (day === 0) response = "External sensor. Tomorrow is garbage day!";
          // if (day === 6)
          //   response =
          //     "External sensor. It could have been a Saturday tour! If not for this virus.. I'll spin up my antivirus";
          if (coolDownNotificationsCounter <= 0) {
            coolDownNotificationsCounter = 120;
            if (extTriggerEnabled) {
              if (shouldNotifyOnExtTrigger) {
                await sendTelegramGroupMessage(response).catch((e) =>
                  console.log("err sendTelegramGroupMessage", e)
                );
                await camerasSnapshot().catch((e) =>
                  console.log("err camerasSnapshot", e)
                );
              } else {
                await sendTelegramAdminMessage(
                  extTriggerEnabled
                    ? response
                    : "Ext sensor was triggered but opening is disabled"
                ).catch((e) =>
                  console.log(
                    "extTriggerEnabled",
                    extTriggerEnabled,
                    "err sendTelegramAdminMessage",
                    e
                  )
                );
                await camerasSnapshot().catch((e) =>
                  console.log(
                    "extTriggerEnabled",
                    extTriggerEnabled,
                    "err camerasSnapshot",
                    e
                  )
                );
              }
            }
          }
        }
        // console.log('coolDownNotificationsCounter', coolDownNotificationsCounter)
      } else {
        triggerCounter += 1;
      }
    }
    if (coolDownNotificationsCounter > 0) {
      --coolDownNotificationsCounter;
    }
  }
}

init().catch((e) => console.log("err in setup", e));
