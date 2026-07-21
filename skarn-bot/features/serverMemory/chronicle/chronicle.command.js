const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chronicle')
    .setDescription('Realm chronicle — weekly narrated history')
    .addSubcommand(s => s.setName('show').setDescription('Show the most recent chronicle entry'))
    .addSubcommand(s => s.setName('history').setDescription('Browse past chronicle entries').addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false)))
    .addSubcommand(s => s.setName('generate').setDescription('Force-generate a chronicle (24h cooldown)'))
    .addSubcommand(s => s.setName('setchannel').setDescription('Set the chronicle posting channel').addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true)))
    .addSubcommand(s => s.setName('optout').setDescription('Toggle whether you are named in chronicles')),
};
