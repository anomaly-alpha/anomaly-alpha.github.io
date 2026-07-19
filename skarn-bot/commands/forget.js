// Thin wrapper — command definition and handler live in features/forget/
const command = require('../features/forget/forget.command');
const handler = require('../features/forget/forget.handler');
const { deleteUserMemoryEntries } = require('../db/database');

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message, args) {
    deleteUserMemoryEntries(message.author.id, message.guild?.id);
    await message.reply({ content: 'The stone is wiped clean.' });
  },
  activation: {
    type: 'command',
    phrase: 'skarn forget',
    description: 'Clear your etched memories',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
