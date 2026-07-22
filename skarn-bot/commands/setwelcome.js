const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setGuildConfig } = require('../db/database');

function getSetwelcomeResponse(args, message) {
  const channelId = args.channel;
  setGuildConfig(message.guild.id, 'welcomeChannel', channelId);
  return { content: `Welcome messages will be sent to <#${channelId}>.` };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Set the welcome message channel')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for welcome messages').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    setGuildConfig(interaction.guild.id, 'welcomeChannel', channel.id);
    await interaction.reply({ content: `Welcome messages will be sent to ${channel}.`, flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply({ content: 'You need Administrator permission to use this command.', allowedMentions: { parse: ['users'] } });
    }
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
    }
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply({ content: 'Please mention a channel: `skarn setwelcome #channel`', allowedMentions: { parse: ['users'] } });
    }
    const result = getSetwelcomeResponse({ channel: channel.id }, message);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn setwelcome',
    description: 'Set welcome channel',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function(content) { const mention = content.slice('skarn setwelcome'.length).trim(); return { channel: mention.match(/<#(\d+)>/)?.[1] || '' }; },
  },
};
