const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStats, resetStats } = require('../lib/aiStats');
const { getGuildConfig, getUserPreferences, deleteFlag } = require('../db/database');
const { getStrikes } = require('../features/safety/slurFilter');

function getStrikeStatus(userId) {
  var strikes = getStrikes(userId);
  if (strikes.silencedUntil > Date.now()) {
    var remaining = Math.ceil((strikes.silencedUntil - Date.now()) / 60000);
    return 'Silenced (' + remaining + 'm remaining)';
  }
  if (strikes.count > 0) return strikes.count + ' / 3 strikes';
  return 'None';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistats')
    .setDescription('Check or reset your AI chat stats')
    .addSubcommand(sub => sub.setName('view').setDescription('View your AI chat stats'))
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset your hourly cap, counters, and strikes')),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'reset') {
      resetStats(interaction.user.id);
      var strikes = getStrikes(interaction.user.id);
      var hadStrikes = strikes.count > 0 || strikes.silencedUntil > 0;
      deleteFlag('strike_' + interaction.user.id);
      return interaction.reply({ content: 'Stats reset. Hourly cap, counters' + (hadStrikes ? ', and strikes' : '') + ' cleared.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const stats = getStats(userId);
    const prefs = getUserPreferences(userId, guildId);
    const isOptedIn = prefs && prefs.proactive_opt_in === 1;
    const ignored = guildId ? (getGuildConfig(guildId, 'ignoredUsers') || []).includes(userId) : false;
    const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const embed = new EmbedBuilder()
      .setTitle('AI Chat Stats')
      .addFields(
        { name: 'Remaining Replies', value: `${stats.remaining} / ${stats.cap}`, inline: true },
        { name: 'Resets At', value: resetsStr, inline: true },
        { name: 'Ignore Status', value: ignored ? 'On (skipped in AI channels)' : 'Off', inline: true },
        { name: 'Opt-In Status', value: isOptedIn ? 'Opted In' : 'Opted Out', inline: true },
        { name: 'Messages Sent to Bot', value: `${stats.messagesSent}`, inline: true },
        { name: 'Responses Received', value: `${stats.responsesReceived}`, inline: true },
        { name: 'Strike Status', value: getStrikeStatus(userId), inline: true },
      )
      .setColor(0x00e5ff)
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (args && args.action === 'reset') {
      resetStats(message.author.id);
      deleteFlag('strike_' + message.author.id);
      return message.reply({ content: 'Stats and strikes cleared.', allowedMentions: { parse: ['users'] } });
    }
    const userId = message.author.id;
    const guildId = message.guild?.id;
    const stats = getStats(userId);
    const prefs = getUserPreferences(userId, guildId);
    const isOptedIn = prefs && prefs.proactive_opt_in === 1;
    const ignored = guildId ? (getGuildConfig(guildId, 'ignoredUsers') || []).includes(userId) : false;
    const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const embed = new EmbedBuilder()
      .setTitle('AI Chat Stats')
      .addFields(
        { name: 'Remaining Replies', value: `${stats.remaining} / ${stats.cap}`, inline: true },
        { name: 'Resets At', value: resetsStr, inline: true },
        { name: 'Opt-In Status', value: isOptedIn ? 'Opted In' : 'Opted Out', inline: true },
        { name: 'Messages Sent', value: `${stats.messagesSent}`, inline: true },
        { name: 'Responses Received', value: `${stats.responsesReceived}`, inline: true },
        { name: 'Strike Status', value: getStrikeStatus(userId), inline: true },
      )
      .setColor(0x00e5ff)
      .setThumbnail(message.author.displayAvatarURL());

    await message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn aistats',
    description: 'View or reset AI stats',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      var rest = content.slice('skarn aistats'.length).trim();
      if (rest === 'reset') return { action: 'reset' };
      return {};
    },
  },
};
