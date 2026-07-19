// Thin wrapper — command definition and handler live in features/etch/
const command = require('../features/etch/etch.command');
const handler = require('../features/etch/etch.handler');
const { addMemoryEntry } = require('../db/database');

const CONFIRMATIONS = [
  'Etched. It\'s part of the stone now.',
  'Noted. I don\'t forget.',
  'The stone remembers.',
];

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message, args) {
    addMemoryEntry(message.author.id, message.guild?.id, 'etch', 'fact', args.fact, 1.0, null);
    const reply = CONFIRMATIONS[Math.floor(Math.random() * CONFIRMATIONS.length)];
    await message.reply({ content: reply });
  },
  activation: {
    type: 'command',
    phrase: 'skarn etch',
    description: 'Save a fact to memory',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { fact: content.slice('skarn etch'.length).trim() }; },
  },
};
