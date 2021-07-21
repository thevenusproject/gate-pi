import _ from 'lodash';
import {initStore, getSetting} from './store';

initStore();
import {
  sampleExternalSensor,
  setupPhysicalPins,
  sleep,
  openGateTemporarily,
} from './helpers/rpiHelper';
import {
  setupTelegram,
  sendTelegramGroupMessage,
  sendTelegramAdminMessage,
  camerasSnapshot,
} from './helpers/telegramHelper';
import {killProcess, pickRandomFromArray} from './utils';
import {setupBlynk} from './helpers/blynkHelper';
import {fetchCalendarAvailability, isCalendarBusy} from "./helpers/calendarHelper";

async function init() {
  await setupPhysicalPins().catch((e) => killProcess(e));
  // await setupBlynk().catch((e) => killProcess(e));
  await setupTelegram().catch((e) => {
    console.error('setupTelegram err ', e);
    // killProcess(e);
  });
  fetchCalendarAvailability().catch(e => console.log('fetchCalendarAvailability err', e));
  externalSensorPolling().catch((e) => killProcess(e));
}

async function externalSensorPolling() {
  const TIME_STEP = 0.5; // seconds
  const COUNT_TRIGGER = 1;
  const COOL_DOWN_TIME = 120; // seconds
  const SPAM_THRESHOLD = 3; // Notifications
  let spamCounter = 0;
  let triggerCounter = 0;
  let coolDownNotificationsCounter = 0;
  while (true) {
    const sensorIsBlocked = await sampleExternalSensor();
    if (sensorIsBlocked) {
      // console.log("Ext. sensor triggered. counter ", triggerCounter);
      if (triggerCounter >= COUNT_TRIGGER) {
        const extTriggerEnabled = getSetting({setting: 'extTriggerEnabled'});
        const shouldNotifyOnExtTrigger = getSetting({
          setting: 'shouldNotifyOnExtTrigger',
        });
        // console.log("Ext. sensor triggered. Opening gate");
        triggerCounter = 0;
        if (extTriggerEnabled || shouldNotifyOnExtTrigger) {
          if (!isCalendarBusy() && extTriggerEnabled) await openGateTemporarily().catch(e => console.error('openGateTemporarily err', e));
          else console.log('calendar busy, not opening gate')
          const day = new Date().getDay();
          let response = pickRandomFromArray([
            'External sensor. Opening gate',
            // "Ext. sensor triggered, maybe a new package?? So exciting..",
            // "Ext. sensor triggered, is Rox checking for mail again?",
          ]);
          if (day === 0) response = 'External sensor. Tomorrow is garbage day!';
          // if (day === 6)
          //   response =
          //     "External sensor. It could have been a Saturday tour! If not for this virus.. I'll spin up my antivirus";
          if (coolDownNotificationsCounter <= 0) {
            coolDownNotificationsCounter = _.floor(COOL_DOWN_TIME / TIME_STEP);
            if (shouldNotifyOnExtTrigger) {
              await sendTelegramGroupMessage(response).catch((e) =>
                console.error('err sendTelegramGroupMessage', e)
              );
              await camerasSnapshot().catch((e) =>
                console.error('err camerasSnapshot', e)
              );
            }
            // else {
            //   await sendTelegramAdminMessage(response).catch((e) =>
            //     console.error(
            //       'extTriggerEnabled',
            //       extTriggerEnabled,
            //       'err sendTelegramAdminMessage',
            //       e
            //     )
            //   );
            //   await camerasSnapshot().catch((e) =>
            //     console.error(
            //       'extTriggerEnabled',
            //       extTriggerEnabled,
            //       'err camerasSnapshot',
            //       e
            //     )
            //   );
            //   fetchCalendarAvailability().catch(e => console.error('fetchCalendarAvailability err', e));
            // }
          } else console.log('coolDownNotificationsCounter', coolDownNotificationsCounter, 'triggerCounter', triggerCounter)
        }
        // console.log('coolDownNotificationsCounter', coolDownNotificationsCounter, 'triggerCounter',triggerCounter)
      } else {
        triggerCounter += 1;
      }
    }
    await sleep(TIME_STEP * 1000);
    if (coolDownNotificationsCounter > 0) {
      --coolDownNotificationsCounter;
    }
  }
}

init().catch((e) => console.error('err in setup', e));
