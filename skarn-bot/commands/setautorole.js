const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautorole')
    .setDescription('Set a role to auto-assign to new members')
    .addRoleOption(option => option.setName('role').setDescription('Role to auto-assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const role = interaction.options.getRole('role');
    setGuildConfig(interaction.guild.id, 'autoRole', role.id);
    await interaction.reply({ content: `New members will automatically receive the **${role.name}** role.`, flags: 64 });
  },
};
