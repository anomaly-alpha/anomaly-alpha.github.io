const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('consult')
    .setDescription('Speak with Skarn')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What do you want to say to Skarn?')
        .setRequired(true)),
};
