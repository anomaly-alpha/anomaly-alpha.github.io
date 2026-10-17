const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('consult')
    .setDescription('Speak with Skarn')
    .addSubcommand(sub => sub.setName('chat').setDescription('Continue an in-character conversation')
      .addStringOption(option => option.setName('message').setDescription('What do you want to say to Skarn?').setRequired(true)))
    .addSubcommand(sub => sub.setName('advice').setDescription('Ask Skarn for direct advice')
      .addStringOption(option => option.setName('question').setDescription('What do you need advice about?').setRequired(true).setMaxLength(500))),
};
