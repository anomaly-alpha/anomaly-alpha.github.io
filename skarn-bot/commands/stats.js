const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

// Single source of truth for conversation stats. Shared by the slash handler,
// the activation handler, and the get_user_stats AI tool (spec [S5.5]/[S11]).
function getStatsData(userId, guildId) {
  const total = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const questions = db.prepare(
    "SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND role = 'user' AND is_question = 1"
  ).get(userId, guildId);

  const firstMsg = db.prepare(
    'SELECT MIN(created_at) as first_seen FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const threads = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_threads WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const profile = db.prepare(
    'SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const topics = JSON.parse((profile && profile.top_topics) || '[]');
  const hours = JSON.parse((profile && profile.peak_hours) || '[]');

  return {
    total: total.count,
    questions: questions.count,
    threads: threads.count,
    firstSeen: firstMsg && firstMsg.first_seen ? new Date(firstMsg.first_seen).toLocaleDateString() : null,
    topTopics: topics.slice(0, 3).map(t => `${t.topic} (${Math.round(t.weight * 100)}%)`).join(', '),
    hours: hours,
    engagement: profile && profile.engagement_score > 0.7 ? 'High' : profile && profile.engagement_score > 0.3 ? 'Medium' : 'Low',
    mood: profile && profile.sentiment_trend > 0.1 ? 'Improving 😊' : profile && profile.sentiment_trend < -0.1 ? 'Declining 😕' : 'Stable 😐',
    hasProfile: !!profile,
  };
}

async function getStatsResponse(args, message) {
  const targetUserId = message.author.id;
  const guildId = message.guild.id;
  const data = getStatsData(targetUserId, guildId);

  const embed = new EmbedBuilder()
    .setTitle(`Conversation Stats — ${message.author.username}`)
    .setColor(0x00e5ff);

  embed.addFields(
    { name: 'Total Messages', value: `${data.total}`, inline: true },
    { name: 'Questions Asked', value: `${data.questions}`, inline: true },
    { name: 'Conversation Threads', value: `${data.threads}`, inline: true },
  );

  if (data.firstSeen) {
    embed.addFields({ name: 'First Conversation', value: data.firstSeen, inline: true });
  }

  if (data.hasProfile) {
    if (data.topTopics) embed.addFields({ name: 'Top Topics', value: data.topTopics, inline: false });
    if (data.hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: data.hours.join(', '), inline: true });
    embed.addFields(
      { name: 'Engagement', value: data.engagement, inline: true },
      { name: 'Mood Trend', value: data.mood, inline: true },
    );
  }
  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your conversation stats with Skarn')
    .addUserOption(option => option.setName('user').setDescription('User to view (admin only)').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can view other users\' stats.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    await interaction.deferReply({ flags: 64 });

    const data = getStatsData(targetUser.id, interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`Conversation Stats — ${targetUser.username}`)
      .setColor(0x00e5ff);

    embed.addFields(
      { name: 'Total Messages', value: `${data.total}`, inline: true },
      { name: 'Questions Asked', value: `${data.questions}`, inline: true },
      { name: 'Conversation Threads', value: `${data.threads}`, inline: true },
    );

    if (data.firstSeen) {
      embed.addFields({ name: 'First Conversation', value: data.firstSeen, inline: true });
    }

    if (data.hasProfile) {
      if (data.topTopics) embed.addFields({ name: 'Top Topics', value: data.topTopics, inline: false });
      if (data.hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: data.hours.join(', '), inline: true });
      embed.addFields(
        { name: 'Engagement', value: data.engagement, inline: true },
        { name: 'Mood Trend', value: data.mood, inline: true },
      );
    }

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
    }
    try {
      const result = await getStatsResponse(args, message);
      await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
    } catch (err) {
      await message.reply({ content: err.message || 'Error fetching stats.', allowedMentions: { parse: ['users'] } });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn stats',
    description: 'Show user stats',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn stats'.length).trim() || null }; },
  },
};

module.exports.getStatsData = getStatsData;
