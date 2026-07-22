const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setGuildConfig } = require('../db/database');

function getSetautoroleResponse(args, message) {
  const roleId = args.role;
  const role = message.guild.roles.cache.get(roleId);
  setGuildConfig(message.guild.id, 'autoRole', roleId);
  return { content: `New members will automatically receive the **${role?.name || 'Unknown'}** role.` };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautorole')
    .setDescription('Set a role to auto-assign to new members')
    .addRoleOption(option => option.setName('role').setDescription('Role to auto-assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const role = interaction.options.getRole('role');
    setGuildConfig(interaction.guild.id, 'autoRole', role.id);
    await interaction.reply({ content: `New members will automatically receive the **${role.name}** role.`, flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply({ content: 'You need Administrator permission to use this command.', allowedMentions: { parse: ['users'] } });
    }
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
    }
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply({ content: 'Please mention a role: `skarn setautorole @role`', allowedMentions: { parse: ['users'] } });
    }
    const result = getSetautoroleResponse({ role: role.id }, message);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn setautorole',
    description: 'Set auto-role',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function(content) { const mention = content.slice('skarn setautorole'.length).trim(); return { role: mention.match(/<@&(\d+)>/)?.[1] || '' }; },
  },
};
