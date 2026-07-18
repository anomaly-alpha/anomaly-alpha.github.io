const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (mute them temporarily)')
    .addUserOption(option => option.setName('user').setDescription('The member to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });

    await member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply(`**${user.username}** has been timed out for ${minutes} minute(s). Reason: ${reason}`);
  },
};
