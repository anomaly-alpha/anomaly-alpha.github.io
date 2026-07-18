const RPC = require('discord-rpc');

const clientId = '982308134871765022';
const rpc = new RPC.Client({ transport: 'ipc' });

const phrases = [
  '🗡️ Servant of the Code',
  '🛡️ Servant of the Realm',
  '⚔️ Servant of the Quest',
  '🏰 Servant of the Crown',
  '🔮 Servant of the Oracle',
  '⚡ Servant of the Storm',
  '🦅 Servant of the Hunt',
  '💀 Servant of the Shadow',
  '🔥 Servant of the Flame',
  '🌙 Servant of the Night',
];

rpc.on('ready', () => {
  console.log('Rich Presence connected!');

  function setStatus() {
    rpc.setActivity({
      details: '😈 Servant of ...',
      state: 'Anomaly Alpha',
      largeImageKey: 'skarn_logo',
      largeImageText: 'Skarn Bot',
      instance: false,
      type: 1,
      url: 'https://www.twitch.tv/anomalyalpha',
    });
  }

  setStatus();
  setInterval(setStatus, 60000);
});

rpc.login({ clientId }).catch(err => {
  console.error('Failed to connect:', err.message);
  console.log('\nMake sure Discord is running on this computer.');
});
