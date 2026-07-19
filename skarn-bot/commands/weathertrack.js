const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weathertrack')
    .setDescription('Manage daily weather reports')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Schedule a daily weather report')
        .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel to post in').setRequired(true))
        .addStringOption(option => option.setName('time').setDescription('Post time (HH:MM, 24h EST)').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a daily weather report')
        .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all configured daily reports'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const tracks = getGuildConfig(guildId, 'weatherTracks') || [];

    if (subcommand === 'add') {
      const location = interaction.options.getString('location');
      const channel = interaction.options.getChannel('channel');
      const time = interaction.options.getString('time');

      if (!/^\d{2}:\d{2}$/.test(time)) {
        return interaction.reply({ content: 'Invalid time format. Use HH:MM (24-hour, e.g. 08:00 or 14:30).', flags: 64 });
      }

      const [hours, minutes] = time.split(':').map(Number);
      if (hours > 23 || minutes > 59) {
        return interaction.reply({ content: 'Invalid time. Hours must be 00-23, minutes 00-59.', flags: 64 });
      }

      const exists = tracks.some(
        t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channel.id
      );
      if (exists) {
        return interaction.reply({ content: `Already tracking **${location}** in <#${channel.id}>.`, flags: 64 });
      }

      tracks.push({ location, channelId: channel.id, time, lastPosted: '' });
      setGuildConfig(guildId, 'weatherTracks', tracks);

      await interaction.reply(`Daily weather report scheduled: **${location}** in <#${channel.id}> at **${time}** EST.`);
    } else if (subcommand === 'remove') {
      const location = interaction.options.getString('location');
      const channel = interaction.options.getChannel('channel');

      const idx = tracks.findIndex(
        t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channel.id
      );

      if (idx === -1) {
        return interaction.reply({ content: `No tracking found for **${location}** in <#${channel.id}>.`, flags: 64 });
      }

      tracks.splice(idx, 1);
      setGuildConfig(guildId, 'weatherTracks', tracks);

      await interaction.reply(`Stopped tracking **${location}** in <#${channel.id}>.`);
    } else if (subcommand === 'list') {
      if (tracks.length === 0) {
        return interaction.reply({ content: 'No daily weather reports configured.', flags: 64 });
      }

      const list = tracks.map(t => `**${t.location}** → <#${t.channelId}> at **${t.time}** EST`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('Daily Weather Reports')
        .setDescription(list)
        .setColor(0x00e5ff);

      await interaction.reply({ embeds: [embed], flags: 64 });
    }
  },
};
