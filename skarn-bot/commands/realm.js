const { SlashCommandBuilder } = require('discord.js');
const realmCommand = require('../features/realm/realmCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('realm')
    .setDescription('Enter the Realm of Skarn — a persistent AI-driven RPG')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new character'))
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Begin your journey in the Realm'))
    .addSubcommand(sub =>
      sub.setName('explore')
        .setDescription('Continue exploring from your current location'))
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View your character sheet'))
    .addSubcommand(sub =>
      sub.setName('inventory')
        .setDescription('View and manage your inventory'))
    .addSubcommand(sub =>
      sub.setName('quests')
        .setDescription('View active and completed quests'))
    .addSubcommand(sub =>
      sub.setName('rest')
        .setDescription('Rest at your current location to recover HP'))
    .addSubcommand(sub =>
      sub.setName('trade')
        .setDescription('Initiate a trade with another player')
        .addUserOption(option => option.setName('player').setDescription('Player to trade with').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete your character (with confirmation)'))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('Top characters by level in this server'))
    .addSubcommand(sub =>
      sub.setName('help')
        .setDescription('Show Realm commands and tips')),
  async execute(interaction) {
    return realmCommand.execute(interaction);
  },
};
