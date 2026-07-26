const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('See what Skarn remembers about you'),
};
