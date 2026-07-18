const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('etch')
    .setDescription('Tell Skarn something to remember about you')
    .addStringOption(option =>
      option.setName('fact')
        .setDescription('What should Skarn remember?')
        .setRequired(true)
        .setMaxLength(300)),
};
