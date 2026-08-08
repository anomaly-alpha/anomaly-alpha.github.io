const RPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');

const clientId = '982308134871765022';
const RETRY_MS = 15000;
const LOG_FILE = path.join(__dirname, 'data', 'rpc.log');

let retryTimer = null;

// Background service — log to data/rpc.log so a hidden launch is still observable.
function log(line) {
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, '[' + new Date().toISOString() + '] ' + line + '\n'); } catch (e) {}
}

// Single retry slot so a failed login + 'disconnected' can't schedule two reconnects.
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(function() { retryTimer = null; connect(); }, RETRY_MS);
}

function connect() {
  const rpc = new RPC.Client({ transport: 'ipc' });

  rpc.on('ready', () => {
    log('Rich Presence connected!');
    log('Status: <+HUSH> ONLINE / <+HUSH> AWAITING SIGNAL');

    rpc.setActivity({
      details: '<+HUSH> ONLINE',
      state: '<+HUSH> AWAITING SIGNAL',
      largeImageKey: 'skarn_logo',
      largeImageText: 'Skarn Bot',
      instance: false,
      type: 0, // 0=Playing (default; local Discord ignores Streaming)
      // Absolute max: 1 second into unix time
      startTimestamp: 1000, // Jan 1, 1970 00:00:01
    });
  });

  rpc.on('error', (err) => log('Error: ' + err.message));
  rpc.on('disconnected', () => {
    log('Disconnected — retrying in ' + RETRY_MS / 1000 + 's');
    scheduleRetry();
  });

  // Discord may not be up yet at logon — keep retrying instead of exiting.
  rpc.login({ clientId }).catch((err) => {
    log('Failed to connect: ' + err.message);
    log('Retrying in ' + RETRY_MS / 1000 + 's (is Discord running?)');
    scheduleRetry();
  });
}

connect();
