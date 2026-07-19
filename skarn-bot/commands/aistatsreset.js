const { SlashCommandBuilder } = require('discord.js');
const { resetStats } = require('../lib/aiStats');

function getAistatsresetResponse(userId) {
  resetStats(userId);
  return { content: 'Stats reset. Your hourly cap and counters are cleared.', flags: 64 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistatsreset')
    .setDescription('Reset your AI chat stats and hourly cap'),
  async execute(interaction) {
    resetStats(interaction.user.id);
    await interaction.reply({ content: 'Stats reset. Your hourly cap and counters are cleared.', flags: 64 });
  },
  async handleActivation(message, args) {
    const result = getAistatsresetResponse(message.author.id);
    await message.reply(result);
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
