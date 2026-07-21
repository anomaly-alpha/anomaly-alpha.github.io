var { handleOmen } = require('../features/serverMemory/omen/omenCommand');

module.exports = {
  name: 'omen',
  description: 'Cryptic prophecies about Skarn\'s realm',
  options: [
    { name: 'show', description: 'Show currently unresolved omens', type: 1 },
    { name: 'fulfill', description: 'Try to connect something to an active omen', type: 1, options: [{ name: 'description', description: 'What happened', type: 3, required: true }] },
    { name: 'history', description: 'Browse past fulfilled omens', type: 1, options: [{ name: 'page', description: 'Page number', type: 4, required: false }] },
    { name: 'setchannel', description: 'Set the omen posting channel', type: 1, options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }] },
    { name: 'frequency', description: 'Set posting interval (min/max days)', type: 1, options: [{ name: 'min_days', description: 'Minimum days between omens (2-14)', type: 4, required: true }, { name: 'max_days', description: 'Maximum days between omens (2-14)', type: 4, required: true }] },
  ],
  async execute(interaction) {
    await handleOmen(interaction);
  },
};
