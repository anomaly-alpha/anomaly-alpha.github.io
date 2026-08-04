const command = require('../features/memory/memory.command');
const handler = require('../features/memory/memory.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message) {
    await handler.execute({
      user: message.author,
      guild: message.guild,
      reply: function(payload) { return message.reply(payload); },
    });
  },
  activation: {
    type: 'command',
    phrase: 'skarn what do you know about me',
    description: 'See what Skarn remembers about you',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
