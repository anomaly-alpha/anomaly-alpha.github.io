const { SlashCommandBuilder } = require('discord.js');
const { resetStats } = require('../lib/aiStats');
const { getStrikes } = require('../features/safety/slurFilter');
const { deleteFlag } = require('../db/database');

function getAistatsresetResponse(userId) {
  resetStats(userId);
  var strikes = getStrikes(userId);
  var hadStrikes = strikes.count > 0 || strikes.silencedUntil > 0;
  deleteFlag('strike_' + userId);
  return { content: 'Stats reset. Hourly cap, counters' + (hadStrikes ? ', and strikes' : '') + ' cleared.', flags: 64 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistatsreset')
    .setDescription('Reset your AI chat stats and hourly cap'),
  async execute(interaction) {
    resetStats(interaction.user.id);
    var strikes = getStrikes(interaction.user.id);
    var hadStrikes = strikes.count > 0 || strikes.silencedUntil > 0;
    deleteFlag('strike_' + interaction.user.id);
    await interaction.reply({ content: 'Stats reset. Hourly cap, counters' + (hadStrikes ? ', and strikes' : '') + ' cleared.', flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = getAistatsresetResponse(message.author.id);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn aistatsreset',
    description: 'Reset AI stats',
    guildOnly: false,
    requiredPermissions: ['Administrator'],
    parseArgs: function() { return {}; },
  },
};
