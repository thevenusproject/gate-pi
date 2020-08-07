import {google} from 'googleapis';
import moment from 'moment';
import _ from 'lodash';

const { GOOGLE_API_TOKEN, GOOGLE_CALENDAR_ID } = process.env;
let busyTimeslots = [];

export async function fetchCalendarAvailability() {
  // google.calendar()

  const calendar = google.calendar({
    version: 'v3',
    auth: GOOGLE_API_TOKEN
  });
  const timeNow = moment.utc();
  const oneWeekInSeconds = 7 * 24 * 60 * 60;
  const time24HoursFromNow = moment.unix(timeNow.unix() + oneWeekInSeconds).utc();
  const params = {
    // alt: "json",
    // prettyPrint: false,
    timeMin: timeNow.format(),
    timeMax: time24HoursFromNow.format(),
    items: [{id: GOOGLE_CALENDAR_ID}],
    // "resource": {}
  };
  const res = await calendar.freebusy.query({resource: params}).catch(e => {
    console.log(e)
  })
  busyTimeslots = _.get(res, `data.calendars['${GOOGLE_CALENDAR_ID}'].busy`) || busyTimeslots;
  console.log('fetchCalendarAvailability', busyTimeslots)
  return true
  // [ { start: '2020-08-01T03:14:27Z', end: '2020-08-01T05:15:00Z' } ]
}

export function isCalendarBusy() {
  let isBusy = false;
  _.forEach(busyTimeslots, ts => {
    const now = moment.utc()
    if (moment(ts.start).isAfter(now)) return false // future events, stop seeking
    else if (moment(ts.end).isAfter(now)) {
      isBusy = true;
      return false
    }
  })
  return isBusy;
}

export async function isCalendarBusyAsync() {
  await fetchCalendarAvailability();
  const isBusy = isCalendarBusy();
  console.log('isBusy', isBusy);
}
