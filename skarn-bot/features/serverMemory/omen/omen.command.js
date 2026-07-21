const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('omen')
    .setDescription('Cryptic prophecies about Skarn\'s realm')
    .addSubcommand(s => s.setName('show').setDescription('Show currently unresolved omens'))
    .addSubcommand(s => s.setName('fulfill').setDescription('Try to connect something to an active omen').addStringOption(o => o.setName('description').setDescription('What happened').setRequired(true)))
    .addSubcommand(s => s.setName('history').setDescription('Browse past fulfilled omens').addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false)))
    .addSubcommand(s => s.setName('setchannel').setDescription('Set the omen posting channel').addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true)))
    .addSubcommand(s => s.setName('frequency').setDescription('Set posting interval (min/max days)').addIntegerOption(o => o.setName('min_days').setDescription('Minimum days (2-14)').setRequired(true)).addIntegerOption(o => o.setName('max_days').setDescription('Maximum days (2-14)').setRequired(true))),
};
