const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll a dice')
    .addIntegerOption(option => option.setName('sides').setDescription('Number of sides (default 6)').setMinValue(2).setMaxValue(100)),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const result = Math.floor(Math.random() * sides) + 1;
    await interaction.reply(`🎲 Rolled a **${result}** (d${sides})`);
  },
};
