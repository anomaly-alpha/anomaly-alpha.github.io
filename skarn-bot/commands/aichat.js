const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../db/database');

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
};
