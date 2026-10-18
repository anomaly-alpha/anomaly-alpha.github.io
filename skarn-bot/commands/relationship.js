const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

function getRelationshipData(userId, guildId) {
  const rel = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const milestones = db.prepare(
    "SELECT * FROM relationship_milestones WHERE user_id = ? AND guild_id = ? AND milestone_type != 'response_feedback' ORDER BY achieved_at DESC LIMIT 10"
  ).all(userId, guildId);
  const totalMessages = db.prepare(
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
  const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const topics = JSON.parse((profile && profile.top_topics) || '[]');
  const hours = JSON.parse((profile && profile.peak_hours) || '[]');
  return {
    rel: rel, profile: profile, milestones: milestones, total: totalMessages.count,
    questions: questions.count, threads: threads.count,
    firstSeen: firstMsg && firstMsg.first_seen ? new Date(firstMsg.first_seen).toLocaleDateString() : null,
    topTopics: topics.slice(0, 3).map(t => `${t.topic} (${Math.round(t.weight * 100)}%)`).join(', '),
    hours: hours,
    engagement: profile && profile.engagement_score > 0.7 ? 'High' : profile && profile.engagement_score > 0.3 ? 'Medium' : 'Low',
    mood: profile && profile.sentiment_trend > 0.1 ? 'Improving 😊' : profile && profile.sentiment_trend < -0.1 ? 'Declining 😕' : 'Stable 😐',
    hasProfile: !!profile, nickname: prefs && prefs.nickname,
  };
}

function getStatsData(userId, guildId) {
  const data = getRelationshipData(userId, guildId);
  return { total: data.total, questions: data.questions, threads: data.threads, firstSeen: data.firstSeen, topTopics: data.topTopics, hours: data.hours, engagement: data.engagement, mood: data.mood, hasProfile: data.hasProfile };
}

function buildRelationshipEmbed(data, user) {
  const embed = new EmbedBuilder()
    .setTitle(`Relationship & Conversation Stats — ${user.username}`)
    .setColor(0x00e5ff);

  if (data.rel) {
    const familiarity = Math.round(data.rel.familiarity);
    const bars = Math.round((familiarity / 100) * 10);
    const barStr = '▓'.repeat(Math.min(bars, 10)) + '░'.repeat(Math.max(0, 10 - bars));
    embed.addFields(
      { name: 'Familiarity', value: `\`${barStr}\` ${familiarity}/100`, inline: false },
      { name: 'Interactions', value: `${data.rel.interaction_count}`, inline: true },
    );
  }

  embed.addFields(
    { name: 'Messages', value: `${data.total}`, inline: true },
    { name: 'Questions Asked', value: `${data.questions}`, inline: true },
    { name: 'Conversation Threads', value: `${data.threads}`, inline: true },
  );
  if (data.firstSeen) embed.addFields({ name: 'First Conversation', value: data.firstSeen, inline: true });
  if (data.hasProfile) {
    if (data.topTopics) embed.addFields({ name: 'Top Topics', value: data.topTopics, inline: false });
    if (data.hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: data.hours.join(', '), inline: true });
    embed.addFields(
      { name: 'Engagement', value: data.engagement, inline: true },
      { name: 'Mood Trend', value: data.mood, inline: true },
    );
  }

  if (data.milestones.length > 0) {
    const milestoneText = data.milestones.map(m => {
      const date = new Date(m.achieved_at).toLocaleDateString();
      return `**${m.milestone_name}** — ${date}`;
    }).join('\n');
    embed.addFields({ name: 'Milestones 🏆', value: milestoneText, inline: false });
  }

  if (data.nickname) {
    embed.setDescription(`Nickname: **${data.nickname}**`);
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relationship')
    .setDescription('View your relationship and conversation stats')
    .addUserOption(option => option.setName('user').setDescription('User to view (admin only)').setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Relationship and conversation stats are only available in a server.', flags: 64, allowedMentions: { parse: [] } });
    }
    const targetUser = interaction.options.getUser('user') || interaction.user;
    if (targetUser.id !== interaction.user.id && !interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: "Only admins can view another user's relationship and stats.", flags: 64, allowedMentions: { parse: ['users'] } });
    }
    const data = getRelationshipData(targetUser.id, interaction.guild.id);
    await interaction.reply({ embeds: [buildRelationshipEmbed(data, targetUser)], flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!message.guild) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
    const data = getRelationshipData(message.author.id, message.guild.id);
    await message.reply({ embeds: [buildRelationshipEmbed(data, message.author)], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn relationship',
    description: 'Check relationship and conversation stats',
    guildOnly: true,
    requiredPermissions: [],
  },
};
module.exports.getStatsData = getStatsData;
