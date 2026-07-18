const RPC = require('discord-rpc');

const clientId = '982308134871765022';
const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
  console.log('Rich Presence connected!');
  console.log('Status: 😈 Servant of ... / Anomaly Alpha');

  rpc.setActivity({
    details: '😈 Servant of ...',
    state: 'Anomaly Alpha',
    largeImageKey: 'skarn_logo',
    largeImageText: 'Skarn Bot',
    instance: false,
    type: 3, // 0=Playing, 1=Streaming, 2=Listening, 3=Watching, 5=Competing
    // Absolute max: 1 second into unix time
    startTimestamp: 1000, // Jan 1, 1970 00:00:01
  });
});

rpc.login({ clientId }).catch(err => {
  console.error('Failed to connect:', err.message);
  console.log('\nMake sure Discord is running on this computer.');
});
