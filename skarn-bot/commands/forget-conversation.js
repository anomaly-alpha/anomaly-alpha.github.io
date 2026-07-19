const { SlashCommandBuilder } = require('discord.js');
const { deleteUserConversation } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forget-conversation')
    .setDescription('Delete your conversation history with Skarn (keeps remembered facts)')
    .addUserOption(option => option.setName('user').setDescription('User to forget (admin only)').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can clear other users\' history.', flags: 64 });
    }

    deleteUserConversation(targetUser.id, interaction.guild.id);

    await interaction.reply({
      content: targetUser.id === interaction.user.id
        ? 'Your conversation history with Skarn has been deleted. Remembered facts are kept.'
        : `Conversation history for ${targetUser.username} has been deleted.`,
      flags: 64,
    });
  },
};
