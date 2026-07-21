var { handleChronicle } = require('../features/serverMemory/chronicle/chronicleCommand');

module.exports = {
  name: 'chronicle',
  description: 'Realm chronicle - weekly narrated history',
  options: [
    { name: 'show', description: 'Show the most recent chronicle entry', type: 1 },
    { name: 'history', description: 'Browse past chronicle entries', type: 1, options: [{ name: 'page', description: 'Page number', type: 4, required: false }] },
    { name: 'generate', description: 'Force-generate a chronicle (24h cooldown)', type: 1 },
    { name: 'setchannel', description: 'Set the chronicle posting channel', type: 1, options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }] },
    { name: 'optout', description: 'Toggle whether you are named in chronicles', type: 1 },
  ],
  async execute(interaction) {
    await handleChronicle(interaction);
  },
};
