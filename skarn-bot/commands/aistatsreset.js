const { SlashCommandBuilder } = require('discord.js');
const { resetStats } = require('../lib/aiStats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistatsreset')
    .setDescription('Reset your AI chat stats and hourly cap'),
  async execute(interaction) {
    resetStats(interaction.user.id);
    await interaction.reply({ content: 'Stats reset. Your hourly cap and counters are cleared.', ephemeral: true });
  },
};
