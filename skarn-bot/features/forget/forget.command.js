const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Delete all facts Skarn remembers about you'),
};
