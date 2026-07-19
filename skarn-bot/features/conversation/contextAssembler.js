const { getRecentMessages, getOlderSummaries, getUserProfile, getUserMemory, db } = require('../../db/database');

const MAX_RECENT_MESSAGES = 30;
const MAX_RECENT_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year (essentially everything)
const MAX_SUMMARIES = 5;
const MAX_FACTS = 10;

function assembleContext(userId, guildId, channelId) {
  const parts = [];

  // 1. Recent conversation history (all available, max 30 messages)
  const recent = getRecentMessages(userId, guildId, channelId, MAX_RECENT_MESSAGES, MAX_RECENT_AGE_MS);
  if (recent.length > 0) {
    const history = recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
    parts.push(`Recent conversation:\n${history}`);
  }

  // 2. Older summaries (all available, max 5)
  const summaries = getOlderSummaries(userId, guildId, channelId, MAX_SUMMARIES);
  if (summaries.length > 0) {
    parts.push(`Earlier conversations:\n${summaries.map(s => s.summary_text).join('\n---\n')}`);
  }

  // 3. Cross-user context — what's been discussed across the server recently
  const crossChannelTopics = db.prepare(
    `SELECT content, created_at FROM conversation_messages
     WHERE guild_id = ? AND created_at > ? AND role = 'user'
     ORDER BY created_at DESC LIMIT 10`
  ).all(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (crossChannelTopics.length >= 5) {
    const topics = [...new Set(crossChannelTopics.map(m => m.content.split(' ').slice(0, 5).join(' ')))].slice(0, 3);
    parts.push(`Server buzz (what others are talking about): ${topics.join('; ')}`);
  }

  // 4. User profile
  const profile = getUserProfile(userId, guildId);
  if (profile) {
    parts.push(`About this person: ${formatProfile(profile)}`);
  }

  // 5. Existing facts
  const memory = getUserMemory(userId, guildId, MAX_FACTS);
  if (memory.length > 0) {
    parts.push(`Known facts: ${memory.map(m => m.fact_text).join('; ')}`);
  }

  return parts.join('\n\n');
}

function formatProfile(profile) {
  const topics = JSON.parse(profile.top_topics || '[]');
  const hours = JSON.parse(profile.peak_hours || '[]');
  const topicStr = topics.slice(0, 3).map(t => t.topic).join(', ');
  const engagementLevel = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';

  return `Topics they care about: ${topicStr || 'unknown'}. ` +
    `Usually active around: ${hours.length > 0 ? hours.join(', ') : 'anytime'}. ` +
    `Engagement: ${engagementLevel}.` +
    (profile.sentiment_trend > 0.1 ? ' Mood improving lately.' : '') +
    (profile.sentiment_trend < -0.1 ? ' Mood declining lately.' : '');
}

module.exports = { assembleContext, formatProfile };
