// process.on("SIGTERM", () => {
// server.close(() => {
//   console.log("Process terminated");
// });
// });

export function killProcess(msg) {
  console.log('killing process', msg);
  process.kill(process.pid, 'SIGTERM');
}

export function pickRandomFromArray(arr) {
  if (!arr || !Array.isArray(arr))
    console.warn('invalid arr in pickRandomFromArray');
  else return arr[Math.floor(Math.random() * arr.length)];
}
