const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { fetchWeather, buildRawEmbed, generateSkarnSummary } = require('../lib/weatherScheduler');
const { getGuildConfig, setGuildConfig } = require('../db/database');

async function getWeatherResponse(subcommand, location, style, guildId) {
  const data = await fetchWeather(location);
  if (subcommand === 'current') {
    const current = data.current_condition[0];
    return { embeds: [new EmbedBuilder().setTitle('Weather in ' + location)
      .addFields(
        { name: 'Temperature', value: current.temp_C + '°C / ' + current.temp_F + '°F', inline: true },
        { name: 'Condition', value: current.weatherDesc[0].value, inline: true },
        { name: 'Humidity', value: current.humidity + '%', inline: true },
        { name: 'Wind', value: current.windspeedKmph + ' km/h ' + current.winddir16Point, inline: true },
      ).setColor(0x00e5ff)] };
  }
  const embed = buildRawEmbed(location, data);
  if (style === 'skarn') {
    const summary = await generateSkarnSummary(location, data, guildId);
    if (summary) embed.setDescription(summary);
  }
  return { embeds: [embed] };
}

function getWeatherTracks(guildId) {
  return getGuildConfig(guildId, 'weatherTracks') || [];
}

function executeTracking(subcommand, interaction) {
  const guildId = interaction.guild.id;
  const tracks = getWeatherTracks(guildId);
  if (subcommand === 'add') {
    const location = interaction.options.getString('location');
    const channel = interaction.options.getChannel('channel');
    const time = interaction.options.getString('time');
    if (!/^\d{2}:\d{2}$/.test(time)) return { content: 'Invalid time format. Use HH:MM (24-hour, e.g. 08:00 or 14:30).', flags: 64 };
    const [hours, minutes] = time.split(':').map(Number);
    if (hours > 23 || minutes > 59) return { content: 'Invalid time. Hours must be 00-23, minutes 00-59.', flags: 64 };
    if (tracks.some(t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channel.id)) {
      return { content: 'Already tracking **' + location + '** in <#' + channel.id + '>.', flags: 64 };
    }
    tracks.push({ location, channelId: channel.id, time, lastPosted: '' });
    setGuildConfig(guildId, 'weatherTracks', tracks);
    return { content: 'Daily weather report scheduled: **' + location + '** in <#' + channel.id + '> at **' + time + '** EST.' };
  }
  if (subcommand === 'remove') {
    const location = interaction.options.getString('location');
    const channel = interaction.options.getChannel('channel');
    const index = tracks.findIndex(t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channel.id);
    if (index === -1) return { content: 'No tracking found for **' + location + '** in <#' + channel.id + '>.', flags: 64 };
    tracks.splice(index, 1);
    setGuildConfig(guildId, 'weatherTracks', tracks);
    return { content: 'Stopped tracking **' + location + '** in <#' + channel.id + '>.' };
  }
  if (!tracks.length) return { content: 'No daily weather reports configured.', flags: 64 };
  const list = tracks.map(t => '**' + t.location + '** → <#' + t.channelId + '> at **' + t.time + '** EST').join('\n');
  return { embeds: [new EmbedBuilder().setTitle('Daily Weather Reports').setDescription(list).setColor(0x00e5ff)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather or manage scheduled daily reports')
    .addSubcommand(sub => sub.setName('current').setDescription('Quick weather lookup')
      .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true)))
    .addSubcommand(sub => sub.setName('report').setDescription('Detailed weather report')
      .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true))
      .addStringOption(option => option.setName('style').setDescription('Report style')
        .addChoices({ name: 'Skarn (AI summary)', value: 'skarn' }, { name: 'Raw data', value: 'raw' })))
    .addSubcommandGroup(group => group.setName('track').setDescription('Manage scheduled daily reports')
      .addSubcommand(sub => sub.setName('add').setDescription('Schedule a daily weather report')
        .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel to post in').setRequired(true))
        .addStringOption(option => option.setName('time').setDescription('Post time (HH:MM, 24-hour EST)').setRequired(true)))
      .addSubcommand(sub => sub.setName('remove').setDescription('Remove a scheduled report')
        .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(sub => sub.setName('list').setDescription('Show configured daily reports'))),
  async execute(interaction) {
    if (interaction.options.getSubcommandGroup(false) === 'track') {
      if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: 'Manage Channels permission is required to manage weather tracking.', flags: 64, allowedMentions: { parse: [] } });
      }
      const result = executeTracking(interaction.options.getSubcommand(), interaction);
      return interaction.reply({ ...result, allowedMentions: { parse: [] } });
    }
    const subcommand = interaction.options.getSubcommand();
    const location = interaction.options.getString('location');
    const style = interaction.options.getString('style') || 'skarn';
    await interaction.deferReply();
    try {
      const result = await getWeatherResponse(subcommand, location, style, interaction.guildId);
      await interaction.editReply({ ...result, allowedMentions: { parse: [] } });
    } catch {
      await interaction.editReply({ content: 'Could not fetch weather for "' + location + '".', flags: 64, allowedMentions: { parse: [] } });
    }
  },
};
