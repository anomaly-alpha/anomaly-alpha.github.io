const command = require('../features/remind/remind.command');
const handler = require('../features/remind/remind.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message, args) {
    await handler.setReminder({
      userId: message.author.id,
      channelId: message.channel?.id || message.author.id,
      guildId: message.guild?.id || null,
      message: args.message,
      when: args.when,
      reply: function(payload) { return message.reply(payload); },
    });
  },
  activation: {
    type: 'command',
    phrase: 'skarn remind me',
    description: 'Set a reminder — Skarn will DM you',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      const rest = content.slice('skarn remind me'.length).trim();
      // Try to extract "in X" at the end
      const timeMatch = rest.match(/(.+?)\s+in\s+(\d+\s*[mhd]\w*)$/i);
      if (timeMatch) {
        return { message: timeMatch[1].trim(), when: timeMatch[2] };
      }
      return { message: rest, when: '30m' };
    },
  },
};
