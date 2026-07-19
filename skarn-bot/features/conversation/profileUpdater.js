const { db, getUserProfile, upsertUserProfile } = require('../../db/database');

const UPDATE_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function updateAllProfiles() {
  const users = db.prepare(
    `SELECT DISTINCT user_id, guild_id FROM conversation_messages WHERE created_at > ?`
  ).all(Date.now() - UPDATE_CUTOFF_MS);

  for (const { user_id, guild_id } of users) {
    try {
      computeUserProfile(user_id, guild_id);
      console.log(`[Profile] Updated profile for ${user_id} in ${guild_id}`);
    } catch (error) {
      console.error(`[Profile] Failed to update ${user_id}:`, error.message);
    }
  }
}

function computeUserProfile(userId, guildId) {
  const messages = db.prepare(
    'SELECT * FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND created_at > ? ORDER BY created_at'
  ).all(userId, guildId, Date.now() - UPDATE_CUTOFF_MS);

  if (messages.length === 0) return;

  // Topic frequency
  const topicCounts = {};
  for (const msg of messages) {
    const topics = JSON.parse(msg.topics || '[]');
    for (const t of topics) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, weight: count / messages.length, last_seen: Date.now() }));

  // Time patterns
  const hourCounts = new Array(24).fill(0);
  for (const msg of messages) {
    const hour = new Date(msg.created_at).getUTCHours();
    hourCounts[hour]++;
  }
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(h => h.hour);

  // Sentiment trend
  const sentiments = messages.map(m => m.sentiment || 0);
  const recent = sentiments.slice(-20);
  const older = sentiments.slice(0, 20);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
  const sentimentTrend = recentAvg - olderAvg;

  // Engagement score
  const daysActive = new Set(messages.map(m => new Date(m.created_at).toDateString())).size;
  const engagementScore = Math.min(1, (daysActive / 30) * 0.5 + (messages.length / 100) * 0.5);

  // Deep conversation detection
  const questionCount = messages.filter(m => m.is_question).length;
  const lastDeep = messages.length > 10 && questionCount > 3
    ? messages[messages.length - 1].created_at
    : null;

  upsertUserProfile(userId, guildId, {
    top_topics: JSON.stringify(topTopics),
    peak_hours: JSON.stringify(peakHours),
    avg_message_length: messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length,
    humor_match: 0,
    prefers_long_responses: messages.filter(m => m.content.length > 100).length > messages.length * 0.3 ? 1 : 0,
    sentiment_trend: sentimentTrend,
    last_deep_conversation_at: lastDeep,
    engagement_score: engagementScore,
    last_profile_update_at: Date.now(),
  });
}

module.exports = { updateAllProfiles, computeUserProfile };
