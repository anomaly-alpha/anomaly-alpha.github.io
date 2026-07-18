const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(CONFIG_FILE)) return {}; return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
function saveConfig(data) { const dir = path.dirname(CONFIG_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2)); }

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
    const config = loadConfig();
    const guildId = interaction.guild.id;

    if (!config[guildId]) config[guildId] = {};
    config[guildId].weatherTracks = config[guildId].weatherTracks || [];

    if (subcommand === 'add') {
      const location = interaction.options.getString('location');
      const channel = interaction.options.getChannel('channel');
      const time = interaction.options.getString('time');

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return interaction.reply({ content: 'Invalid time format. Use HH:MM (24-hour, e.g. 08:00 or 14:30).', flags: 64 });
      }

      const [hours, minutes] = time.split(':').map(Number);
      if (hours > 23 || minutes > 59) {
        return interaction.reply({ content: 'Invalid time. Hours must be 00-23, minutes 00-59.', flags: 64 });
      }

      // Check for duplicate
      const exists = config[guildId].weatherTracks.some(
        t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channel.id
      );
      if (exists) {
        return interaction.reply({ content: `Already tracking **${location}** in <#${channel.id}>.`, flags: 64 });
      }

      config[guildId].weatherTracks.push({
        location,
        channelId: channel.id,
        time,
        lastPosted: '',
      });
      saveConfig(config);

      await interaction.reply(`Daily weather report scheduled: **${location}** in <#${channel.id}> at **${time}** EST.`);
    } else if (subcommand === 'remove') {
      const location = interaction.options.getString('location');
      const channel = interaction.options.getChannel('channel');

      const idx = config[guildId].weatherTracks.findIndex(
        t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channel.id
      );

      if (idx === -1) {
        return interaction.reply({ content: `No tracking found for **${location}** in <#${channel.id}>.`, flags: 64 });
      }

      config[guildId].weatherTracks.splice(idx, 1);
      saveConfig(config);

      await interaction.reply(`Stopped tracking **${location}** in <#${channel.id}>.`);
    } else if (subcommand === 'list') {
      const tracks = config[guildId].weatherTracks;

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
