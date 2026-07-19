const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addReactionRole } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a reaction role message')
    .addRoleOption(option => option.setName('role').setDescription('Role to assign').setRequired(true))
    .addStringOption(option => option.setName('emoji').setDescription('Emoji to react with').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('Description for the message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');
    const description = interaction.options.getString('description') || `React with ${emoji} to get the **${role.name}** role.`;

    const embed = new EmbedBuilder()
      .setTitle('Reaction Roles')
      .setDescription(description)
      .setColor(0x00e5ff);

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react(emoji);

    // Store in database for persistence
    addReactionRole(interaction.guild.id, interaction.channel.id, msg.id, emoji, role.id);

    const filter = (reaction, user) => reaction.emoji.name === emoji && !user.bot;
    const collector = msg.createReactionCollector({ filter });

    collector.on('collect', async (reaction, user) => {
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.add(role);
    });

    collector.on('remove', async (reaction, user) => {
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.remove(role);
    });
  },
  async handleActivation(message, args) {
    await message.reply({ content: 'Please use the `/reactionrole` slash command to set up reaction roles.' });
  },
  activation: {
    type: 'command',
    phrase: 'skarn reactionrole',
    description: 'Create a reaction role message',
    guildOnly: true,
    requiredPermissions: ['ManageRoles'],
    parseArgs: function(content) { return {}; },
  },
};
