const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setGuildConfig } = require('../db/database');

function getSetlogResponse(args, message) {
  const channelId = args.channel;
  setGuildConfig(message.guild.id, 'logChannel', channelId);
  setGuildConfig(message.guild.id, 'logMessages', true);
  return { content: `Message logs will be sent to <#${channelId}>.` };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Set the logging channel for message delete/edit events')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for logs').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    setGuildConfig(interaction.guild.id, 'logChannel', channel.id);
    setGuildConfig(interaction.guild.id, 'logMessages', true);
    await interaction.reply({ content: `Message logs will be sent to ${channel}.`, flags: 64 });
  },
  async handleActivation(message, args) {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply({ content: 'You need Administrator permission to use this command.' });
    }
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.' });
    }
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply({ content: 'Please mention a channel: `skarn setlog #channel`' });
    }
    const result = getSetlogResponse({ channel: channel.id }, message);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn setlog',
    description: 'Set logging channel',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function(content) { const mention = content.slice('skarn setlog'.length).trim(); return { channel: mention.match(/<#(\d+)>/)?.[1] || '' }; },
  },
};
