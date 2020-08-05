import Telegraf, { Telegram } from 'telegraf';
import _ from 'lodash';
import {
  openGateTemporarily,
  openGate,
  unopenGate,
  cycleGate,
  gitPull,
  pm2Restart, getTemperature, getCPUVoltage,
} from './rpiHelper';
import { deleteImage, downloadImage } from './cameraHelper';
import {
  INTERCOM,
  GATE,
  TELEGRAM_TOKEN,
  GATE_GROUP_CHAT_ID,
  MY_CHAT_ID,
  INTERCOM_SNAPSHOT_URL,
  GATE_SNAPSHOT_URL,
  INTERCOM_STREAM_URL,
  GATE_STREAM_URL,
} from '../constants';
import { saveSetting, getSetting } from '../store';
import { pickRandomFromArray } from '../utils';
import {fetchCalendarAvailability} from "./calendarHelper"

const telegraf = new Telegraf(TELEGRAM_TOKEN); // required for replying to messages
const telegram = new Telegram(TELEGRAM_TOKEN); // required for initiating conversation

export async function sendTelegramGroupMessage(message) {
  await telegram.sendMessage(GATE_GROUP_CHAT_ID, message);
}

export async function sendTelegramAdminMessage(message) {
  await telegram.sendMessage(MY_CHAT_ID, message);
}

export async function sendTelegramGroupImage(imagePath, caption) {
  await telegram.sendPhoto(
    GATE_GROUP_CHAT_ID,
    { source: imagePath },
    { caption }
  );
}

export async function sendTelegramAdminImage(imagePath, caption) {
  await telegram.sendPhoto(MY_CHAT_ID, { source: imagePath }, { caption });
}

export async function setupTelegram() {
  telegraf.catch((err, ctx) => {
    console.log(`Telegraf err for ${ctx.updateType}`, err)
  })
  telegraf.start((ctx) => {
    ctx.reply('Welcome!');
  });
  telegraf.use(async (ctx, next) => {
    const chat_id = _.get(ctx, 'update.message.chat.id') + '';
    if (chat_id && (chat_id === MY_CHAT_ID || chat_id === GATE_GROUP_CHAT_ID))
      next();
    else if (chat_id)
      console.error(
        `Telegram Message from unauthorized chat! Chat ID ${chat_id}`
      );
    else console.log('Message irrelevant to the bot');
  });
  telegraf.command('open', async (ctx) => {
    await openGateTemporarily();
    await ctx.reply('Gate is opening');
  });
  telegraf.command('cycle', async (ctx) => {
    await cycleGate();
    await ctx.reply('Gate cycling');
  });
  telegraf.command('intercom_snapshot', async ctx => fetchImage(ctx, INTERCOM));
  telegraf.command('gate_snapshot', async ctx => fetchImage(ctx, GATE));
  telegraf.command('notify_on_ext_trigger', async (ctx) => {
    const newValue = !getSetting({ setting: 'shouldNotifyOnExtTrigger' });
    await saveSetting({ setting: 'shouldNotifyOnExtTrigger', value: newValue });
    await ctx.reply(
      `Notifications on external trigger are ${newValue ? 'ON' : 'OFF'}`
    );
  });
  telegraf.command('toggle_opening_on_ext_sensor', async (ctx) => {
    const newValue = !getSetting({ setting: 'extTriggerEnabled' });
    await saveSetting({ setting: 'extTriggerEnabled', value: newValue });
    await ctx.reply(
      `Opening the gate on external trigger is ${
        newValue ? 'ENABLED' : 'DISABLED'
      }`
    );
  });
  telegraf.command('toggle_keep_open', async (ctx) => {
    const newValue = !getSetting({ setting: 'keepOpen' });
    await saveSetting({ setting: 'keepOpen', value: newValue }).catch(() =>
      ctx.reply('failed saving setting keepOpen')
    );
    if (!!newValue) openGate().catch();
    else await unopenGate();
    await ctx.reply(`"Keep the gate open" is ${newValue ? 'ON' : 'OFF'}`);
  });
  telegraf.command('status', async (ctx) => {
    const status =
      `Notify on external sensor is ${
        getSetting({ setting: 'shouldNotifyOnExtTrigger' }) ? 'ON' : 'OFF'
      }\n` +
      `External sensor is ${
        getSetting({ setting: 'extTriggerEnabled' }) ? 'ENABLED' : 'DISABLED'
      }\n` +
      `Keep gate open is ${getSetting({ setting: 'keepOpen' }) ? 'ON' : 'OFF'}`;
    await ctx.reply(status);
  });
  telegraf.command('is_alive', async (ctx) => {
    const responses = [
      "I'm still alive. Pretty boring here though...",
      "There's a package for you here! Not really, just want some company, wink wink",
      'Hmm hmm, are YOU still alive?',
      "I think raccoons are planning a coup. If I'm silent for hours, something is probably wrong",
      'Corcen here!',
    ];
    const response = pickRandomFromArray(responses);
    await ctx.reply(response);
  });
  telegraf.command('echo_to_group', (ctx) => {
    const text = _.get(ctx, 'update.message.text') || '';
    const message = text.replace('/echo_to_group ', '');
    if (message && message !== '/echo_to_group')
      sendTelegramGroupMessage(message);
  });
  telegraf.command('git_pull_restart_pm2', async (ctx) => {
    await gitPull().catch((e) => ctx.reply(e));
    await pm2Restart().catch((e) => ctx.reply(e));
    await ctx.reply('Git pulled and pm2 restarted');
  });
  telegraf.command('cpu_temperature', async (ctx) => {
    const temp = await getTemperature();
    await ctx.reply(temp || '');
  });
  telegraf.command('cpu_voltage', async (ctx) => {
    const v = await getCPUVoltage();
    await ctx.reply(v || '');
  });
  telegraf.command('sync_calendar', async (ctx) => {
    const res = await fetchCalendarAvailability().catch(e => console.error('fetchCalendarAvailability err', e));
    if (res) await ctx.reply('Calendar synced');
    else await ctx.reply('Calendar sync failed');
  });

  let response = pickRandomFromArray([
    "I'm back online, how long was I out? Minutes? Days? Years???",
    'Reporting back online',
    'Corcen here, working as usual',
    'A lovely day to be back online again!',
  ]);
  await sendTelegramAdminMessage(response);
  return telegraf.launch();
}

export async function fetchImage(ctx, imageType) {
  const imagePath =
    (await downloadImage({
      url: imageType === INTERCOM ? INTERCOM_SNAPSHOT_URL : GATE_SNAPSHOT_URL,
      imageType,
    }).catch((e) => console.error('err in img download', e.code))) + '';
  if (imagePath) {
    await ctx
      .replyWithPhoto({source: imagePath}, {caption: imageType === INTERCOM ? INTERCOM_STREAM_URL : GATE_STREAM_URL})
      .catch((e) => deleteImage(imagePath));
    await deleteImage(imagePath);
  } else await ctx.reply('No Image');
}
export async function camerasSnapshot() {
  const intercomImagePath = await downloadImage({
    url: INTERCOM_SNAPSHOT_URL,
    imageType: INTERCOM,
  }).catch((e) => console.warn('err getting intercom image', _.get(e, 'error')));
  const gateImagePath = await downloadImage({
    url: GATE_SNAPSHOT_URL,
    imageType: GATE,
  }).catch((e) => console.warn('err getting gate image', _.get(e, 'error')));
  if (getSetting({ setting: 'shouldNotifyOnExtTrigger' })) {
    if (intercomImagePath)
      await sendTelegramGroupImage(
        intercomImagePath,
        INTERCOM_STREAM_URL
      ).catch((e) => {
        throw e;
      });
    if (gateImagePath)
      await sendTelegramGroupImage(gateImagePath, GATE_STREAM_URL).catch(
        (e) => {
          deleteImage(gateImagePath);
          throw e;
        }
      );
  } else {
    if (intercomImagePath) {
      await sendTelegramAdminImage(intercomImagePath, INTERCOM_STREAM_URL).catch(
        (e) => {
          deleteImage(intercomImagePath);
          throw e;
        }
      );
    }
    if (gateImagePath) {
      await sendTelegramAdminImage(gateImagePath, GATE_STREAM_URL).catch((e) => {
        deleteImage(gateImagePath);
        throw e;
      });
    }
  }
  await deleteImage(intercomImagePath);
  await deleteImage(gateImagePath);
}
