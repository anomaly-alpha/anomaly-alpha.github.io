const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vein')
    .setDescription('Follow the vein through recent conversation and pull out what matters')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to summarize')
        .addChannelTypes(ChannelType.GuildText))
    .addIntegerOption(option =>
      option.setName('timeframe')
        .setDescription('Hours back to look (default 2, max 24)')
        .setMinValue(1)
        .setMaxValue(24))
    .addStringOption(option =>
      option.setName('focus')
        .setDescription('What to focus on (e.g. action items, the argument about pizza)')),
};
