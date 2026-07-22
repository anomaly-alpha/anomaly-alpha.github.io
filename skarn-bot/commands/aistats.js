const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStats } = require('../lib/aiStats');
const { getGuildConfig, getUserPreferences } = require('../db/database');
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

function getAistatsResponse(userId, guildId, user) {
  const stats = getStats(userId);
  const prefs = getUserPreferences(userId, guildId);
  const isOptedIn = prefs && prefs.proactive_opt_in === 1;
  const ignored = guildId ? (getGuildConfig(guildId, 'ignoredUsers') || []).includes(userId) : false;
  const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return {
    embeds: [new EmbedBuilder()
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
      .setThumbnail(user.displayAvatarURL())],
    flags: 64,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistats')
    .setDescription('Check your AI chat stats and remaining replies'),
  async execute(interaction) {
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
        { name: 'Strike Status', value: getStrikeStatus(interaction.user.id), inline: true },
      )
      .setColor(0x00e5ff)
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = getAistatsResponse(message.author.id, message.guild?.id, message.author);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn aistats',
    description: 'Show AI usage stats',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
