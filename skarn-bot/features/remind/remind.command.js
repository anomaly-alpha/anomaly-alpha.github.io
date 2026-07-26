const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder — Skarn will DM you when it\'s time')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What to remind you about')
        .setRequired(true)
        .setMaxLength(500))
    .addStringOption(option =>
      option.setName('when')
        .setDescription('When? e.g. "30m", "2 hours", "1 day"')
        .setRequired(true)
        .setMaxLength(20)),
};
