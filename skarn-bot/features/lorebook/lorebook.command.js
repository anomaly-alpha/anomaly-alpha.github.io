const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lorebook')
    .setDescription('Manage Skarn\'s world info (keyword-triggered context)')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a lorebook entry')
        .addStringOption(opt => opt.setName('keywords').setDescription('Comma-separated trigger words').setRequired(true))
        .addStringOption(opt => opt.setName('content').setDescription('What Skarn knows about this').setRequired(true).setMaxLength(1000))
        .addStringOption(opt => opt.setName('category').setDescription('Category (e.g. lore, guide, rule)').setRequired(false))
        .addIntegerOption(opt => opt.setName('priority').setDescription('Higher = shown first (default 0)').setRequired(false).setMinValue(-10).setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a lorebook entry by ID')
        .addIntegerOption(opt => opt.setName('id').setDescription('Entry ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all lorebook entries for this server'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
};
