const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('View or save a personal memory')
    .addSubcommand(sub => sub.setName('view').setDescription('See what Skarn remembers about you'))
    .addSubcommand(sub => sub.setName('save').setDescription('Tell Skarn something to remember')
      .addStringOption(option => option.setName('fact').setDescription('What should Skarn remember?').setRequired(true).setMaxLength(300))),
};
