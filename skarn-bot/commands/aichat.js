const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../db/database');

function getAichatResponse(args, message) {
  const mode = args.mode;
  const guildId = message.guild.id;
  const channelId = message.channel.id;

  let channels = getGuildConfig(guildId, 'aiChannels') || [];

  if (mode === 'on') {
    if (!channels.includes(channelId)) {
      channels.push(channelId);
      setGuildConfig(guildId, 'aiChannels', channels);
    }
    return `AI chat enabled in <#${channelId}>. I'll chime in when I have something to say.`;
  } else {
    channels = channels.filter(id => id !== channelId);
    setGuildConfig(guildId, 'aiChannels', channels);
    return `AI chat disabled in <#${channelId}>.`;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aichat')
    .setDescription('Toggle AI chat mode in this channel')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Enable or disable')
        .setRequired(true)
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' },
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;

    let channels = getGuildConfig(guildId, 'aiChannels') || [];

    if (mode === 'on') {
      if (!channels.includes(channelId)) {
        channels.push(channelId);
        setGuildConfig(guildId, 'aiChannels', channels);
      }
      await interaction.reply(`AI chat enabled in <#${channelId}>. I'll chime in when I have something to say.`);
    } else {
      channels = channels.filter(id => id !== channelId);
      setGuildConfig(guildId, 'aiChannels', channels);
      await interaction.reply(`AI chat disabled in <#${channelId}>.`);
    }
  },
  async handleActivation(message, args) {
    if (!message.member?.permissions.has('ManageChannels')) {
      return message.reply({ content: 'You need the Manage Channels permission to use this command.' });
    }
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.' });
    }
    const result = getAichatResponse(args, message);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn aichat',
    description: 'Configure AI chat channels',
    guildOnly: true,
    requiredPermissions: ['ManageChannels'],
    parseArgs: function(content) { const rest = content.slice('skarn aichat'.length).trim().toLowerCase(); return { mode: rest === 'off' ? 'off' : 'on' }; },
  },
};
