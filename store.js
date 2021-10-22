import nconf from 'nconf';
import fs from 'fs';
import { config as dotenv_config } from 'dotenv';

export function initStore() {
  //
  // Setup nconf to use (in-order):
  //   1. Command-line arguments
  //   2. Environment variables
  //   3. A file located at 'path/to/config.json'
  //
  nconf.file({ file: './config.json' });
  nconf.load();
}

export function getSetting({ setting }) {
  const sett = nconf.get(`settings:${setting}`);
  console.error('sett', sett, typeof sett)
  if (sett !== true && sett !== false) console.error('invalid sett', sett, typeof sett)
  return sett;
}

export async function saveSetting({ setting, value }) {
  nconf.set(`settings:${setting}`, value);
  return new Promise((res, rej) => {
    nconf.save(function (err, data) {
      if (!err) res(data);
      else
        fs.readFile('./config.json', function (err, data) {
          console.dir(JSON.parse(data.toString()));
          rej(new Error('Err in saveSetting'));
        });
    });
  });
}
