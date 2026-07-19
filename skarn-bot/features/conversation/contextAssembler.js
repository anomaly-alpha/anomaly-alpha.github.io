const { getRecentMessages, getOlderSummaries, getUserProfile, getUserMemory } = require('../../db/database');

const MAX_RECENT_MESSAGES = 20;
const MAX_RECENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_SUMMARIES = 3;
const MAX_FACTS = 5;

function assembleContext(userId, guildId, channelId) {
  const parts = [];

  // 1. Recent conversation history (last 7 days, max 20 messages)
  const recent = getRecentMessages(userId, guildId, channelId, MAX_RECENT_MESSAGES, MAX_RECENT_AGE_MS);
  if (recent.length > 0) {
    const history = recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
    parts.push(`Recent conversation:\n${history}`);
  }

  // 2. Older summaries (7-30 days)
  const summaries = getOlderSummaries(userId, guildId, channelId, MAX_SUMMARIES);
  if (summaries.length > 0) {
    parts.push(`Earlier conversations:\n${summaries.map(s => s.summary_text).join('\n---\n')}`);
  }

  // 3. User profile
  const profile = getUserProfile(userId, guildId);
  if (profile) {
    parts.push(`About this person: ${formatProfile(profile)}`);
  }

  // 4. Existing facts
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
