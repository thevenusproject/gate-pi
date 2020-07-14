import axios from 'axios';
import https from 'https';
export const axiosCustom = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});
