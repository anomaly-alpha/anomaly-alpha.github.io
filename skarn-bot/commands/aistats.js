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

function buildStatsEmbed(user, userId, guildId) {
  const stats = getStats(userId);
  const prefs = getUserPreferences(userId, guildId);
  const isOptedIn = prefs && prefs.proactive_opt_in === 1;
  const ignored = guildId ? (getGuildConfig(guildId, 'ignoredUsers') || []).includes(userId) : false;
  const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return new EmbedBuilder()
    .setTitle('AI Chat Stats')
    .addFields(
      { name: 'Requests Remaining This Hour', value: `${stats.remaining} / ${stats.cap}`, inline: true },
      { name: 'Resets At', value: resetsStr, inline: true },
      { name: 'Ignore Status', value: ignored ? 'On (skipped in AI channels)' : 'Off', inline: true },
      { name: 'Opt-In Status', value: isOptedIn ? 'Opted In' : 'Opted Out', inline: true },
      { name: 'AI Chat Requests', value: `${stats.messagesSent}`, inline: true },
      { name: 'AI Replies Delivered', value: `${stats.responsesReceived}`, inline: true },
      { name: 'Strike Status', value: getStrikeStatus(userId), inline: true },
    )
    .setColor(0x00e5ff)
    .setThumbnail(user.displayAvatarURL());
}

function resetUserStats(userId) {
  resetStats(userId);
  const strikes = getStrikes(userId);
  deleteFlag('strike_' + userId);
  return strikes.count > 0 || strikes.silencedUntil > 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistats')
    .setDescription('Check or reset your AI chat stats')
    .addSubcommand(sub => sub.setName('view').setDescription('View your AI chat stats'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your hourly cap, counters, and strikes')),
  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'reset') {
      const hadStrikes = resetUserStats(interaction.user.id);
      return interaction.reply({ content: 'Stats reset. Hourly cap, counters' + (hadStrikes ? ', and strikes' : '') + ' cleared.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
    const guildId = interaction.guild && interaction.guild.id;
    await interaction.reply({ embeds: [buildStatsEmbed(interaction.user, interaction.user.id, guildId)], flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const userId = message.author.id;
    if (args && args.action === 'reset') {
      const hadStrikes = resetUserStats(userId);
      return message.reply({ content: 'Stats reset. Hourly cap, counters' + (hadStrikes ? ', and strikes' : '') + ' cleared.', allowedMentions: { parse: ['users'] } });
    }
    const guildId = message.guild && message.guild.id;
    await message.reply({ embeds: [buildStatsEmbed(message.author, userId, guildId)], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn aistats',
    description: 'View or reset AI stats',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      var rest = content.slice('skarn aistats'.length).trim();
      return rest === 'reset' ? { action: 'reset' } : {};
    },
  },
};
