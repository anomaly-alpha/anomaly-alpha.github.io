const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../db/database');

function getWeathertrackResponse(subcommand, args, message) {
  const guildId = message.guild.id;
  const tracks = getGuildConfig(guildId, 'weatherTracks') || [];

  if (subcommand === 'add') {
    const location = args.location;
    const channelId = args.channel;
    const time = args.time;

    if (!/^\d{2}:\d{2}$/.test(time)) {
      return { content: 'Invalid time format. Use HH:MM (24-hour, e.g. 08:00 or 14:30).', flags: 64 };
    }

    const [hours, minutes] = time.split(':').map(Number);
    if (hours > 23 || minutes > 59) {
      return { content: 'Invalid time. Hours must be 00-23, minutes 00-59.', flags: 64 };
    }

    const exists = tracks.some(t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channelId);
    if (exists) {
      return { content: `Already tracking **${location}** in <#${channelId}>.`, flags: 64 };
    }

    tracks.push({ location, channelId, time, lastPosted: '' });
    setGuildConfig(guildId, 'weatherTracks', tracks);

    return `Daily weather report scheduled: **${location}** in <#${channelId}> at **${time}** EST.`;
  }

  if (subcommand === 'remove') {
    const location = args.location;
    const channelId = args.channel;

    const idx = tracks.findIndex(t => t.location.toLowerCase() === location.toLowerCase() && t.channelId === channelId);
    if (idx === -1) {
      return { content: `No tracking found for **${location}** in <#${channelId}>.`, flags: 64 };
    }

    tracks.splice(idx, 1);
    setGuildConfig(guildId, 'weatherTracks', tracks);

    return `Stopped tracking **${location}** in <#${channelId}>.`;
  }

  if (subcommand === 'list') {
    if (tracks.length === 0) {
      return { content: 'No daily weather reports configured.', flags: 64 };
    }

    const list = tracks.map(t => `**${t.location}** → <#${t.channelId}> at **${t.time}** EST`).join('\n');
    return { embeds: [new EmbedBuilder().setTitle('Daily Weather Reports').setDescription(list).setColor(0x00e5ff)], flags: 64 };
  }

  return { content: 'Unknown subcommand. Use add, remove, or list.', flags: 64 };
}

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
  async handleActivation(message, args) {
    if (!message.member?.permissions.has('ManageChannels')) {
      return message.reply({ content: 'You need Manage Channels permission to use this command.', flags: 64 });
    }
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }
    const subcommand = args.subcommand;
    const result = getWeathertrackResponse(subcommand, args, message);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn weathertrack',
    description: 'Track weather for a location',
    guildOnly: true,
    requiredPermissions: ['ManageChannels'],
    parseArgs: function(content) {
      const rest = content.slice('skarn weathertrack'.length).trim();
      const parts = rest.split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (sub === 'add') {
        // skarn weathertrack add <location> #channel HH:MM
        const channelMention = parts.find(p => /^<#\d+>$/.test(p));
        const time = parts.find(p => /^\d{2}:\d{2}$/.test(p));
        const location = parts.slice(1).filter(p => !/^<#\d+>$/.test(p) && !/^\d{2}:\d{2}$/.test(p)).join(' ');
        return { subcommand: 'add', location, channel: channelMention?.match(/<#(\d+)>/)?.[1] || '', time: time || '08:00' };
      }
      if (sub === 'remove') {
        const channelMention = parts.find(p => /^<#\d+>$/.test(p));
        const location = parts.slice(1).filter(p => !/^<#\d+>$/.test(p)).join(' ');
        return { subcommand: 'remove', location, channel: channelMention?.match(/<#(\d+)>/)?.[1] || '' };
      }
      return { subcommand: 'list' };
    },
  },
};
