const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { deleteUserMemoryEntries, deleteUserConversation, getMemoryEntries } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Delete what Skarn remembers')
    .addSubcommand(sub =>
      sub.setName('memory')
        .setDescription('Delete all etched memories (keeps conversation history)'))
    .addSubcommand(sub =>
      sub.setName('conversation')
        .setDescription('Delete conversation history (keeps etched memories)')
        .addUserOption(option => option.setName('user').setDescription('User to forget (admin only)')))
    .addSubcommand(sub =>
      sub.setName('all')
        .setDescription('Delete everything — memories AND conversation history')),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user') || interaction.user;

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can clear other users\' data.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    if (subcommand === 'memory') {
      deleteUserMemoryEntries(targetUser.id, interaction.guild.id);
      return interaction.reply({ content: 'Etched memories cleared. I\'ve forgotten what you told me.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    if (subcommand === 'conversation') {
      deleteUserConversation(targetUser.id, interaction.guild.id);
      return interaction.reply({ content: 'Conversation history deleted. Etched memories are kept.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    if (subcommand === 'all') {
      deleteUserMemoryEntries(targetUser.id, interaction.guild.id);
      deleteUserConversation(targetUser.id, interaction.guild.id);
      return interaction.reply({ content: 'Everything is gone. The stone is wiped clean.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
  async handleActivation(message, args) {
    if (args.action === 'memory') {
      deleteUserMemoryEntries(message.author.id, message.guild?.id);
      await message.reply({ content: 'Etched memories cleared.', allowedMentions: { parse: ['users'] } });
    } else if (args.action === 'conversation') {
      deleteUserConversation(message.author.id, message.guild?.id);
      await message.reply({ content: 'Conversation history cleared.', allowedMentions: { parse: ['users'] } });
    } else {
      deleteUserMemoryEntries(message.author.id, message.guild?.id);
      deleteUserConversation(message.author.id, message.guild?.id);
      await message.reply({ content: 'The stone is wiped clean.', allowedMentions: { parse: ['users'] } });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn forget',
    description: 'Clear memories or conversation history',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      var rest = content.slice('skarn forget'.length).trim().toLowerCase();
      if (rest === 'memory' || rest === 'memories') return { action: 'memory' };
      if (rest === 'conversation' || rest === 'chat' || rest === 'history') return { action: 'conversation' };
      return { action: 'all' };
    },
  },
};
