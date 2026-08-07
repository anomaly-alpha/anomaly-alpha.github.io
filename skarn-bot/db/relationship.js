// ===== db: relationship =====
const { db } = require('./db');

// ===== User Relationship =====

function getRelationship(userId, guildId) {
  const row = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (row) return row;
  const now = Date.now();
  db.prepare(
    'INSERT INTO user_relationship (user_id, guild_id, familiarity, banter_level, interaction_count, last_interaction_at, tags, preferred_tone) VALUES (?, ?, 0, ?, 0, ?, ?, ?)'
  ).run(userId, guildId, 'match', now, '[]', 'neutral');
  return db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function getGuildInteractionStats(guildId, since) {
  return db.prepare(
    'SELECT COUNT(*) as total_users, AVG(familiarity) as avg_familiarity, SUM(interaction_count) as total_interactions FROM user_relationship WHERE guild_id = ? AND last_interaction_at > ?'
  ).get(guildId, since);
}

// ===== Guild Mood =====

function getGuildMood(guildId) {
  const row = db.prepare('SELECT * FROM guild_mood WHERE guild_id = ?').get(guildId);
  if (row) return row;
  const now = Date.now();
  db.prepare(
    'INSERT INTO guild_mood (guild_id, current_mood, last_activity_at, last_mood_shift_at) VALUES (?, ?, ?, ?)'
  ).run(guildId, 'neutral', now, now);
  return db.prepare('SELECT * FROM guild_mood WHERE guild_id = ?').get(guildId);
}

function updateGuildMood(guildId, mood) {
  db.prepare('INSERT OR REPLACE INTO guild_mood (guild_id, current_mood, last_activity_at, last_mood_shift_at) VALUES (?, ?, ?, ?)')
    .run(guildId, mood, Date.now(), Date.now());
}

// ===== User Profile =====

function getUserProfile(userId, guildId) {
  return db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

// ===== User Preferences =====

function getUserPreferences(userId, guildId) {
  const row = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (row) return row;
  db.prepare(
    'INSERT INTO user_preferences (user_id, guild_id, proactive_opt_in) VALUES (?, ?, 0)'
  ).run(userId, guildId);
  return db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function setUserPreference(userId, guildId, key, value) {
  const validKeys = ['proactive_opt_in', 'preferred_tone', 'max_response_length', 'allow_nickname', 'nickname', 'timezone'];
  if (!validKeys.includes(key)) return;
  // Upsert: ensure row exists first
  getUserPreferences(userId, guildId);
  db.prepare(`UPDATE user_preferences SET ${key} = ? WHERE user_id = ? AND guild_id = ?`).run(value, userId, guildId);
}

// ===== Follow Ups =====

function createFollowUp(userId, guildId, channelId, topic, context, dueAfter) {
  const result = db.prepare(
    'INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, channelId, topic, context ?? null, Date.now(), Date.now() + dueAfter);
  return { id: result.lastInsertRowid };
}

function getPendingFollowUps() {
  return db.prepare(
    "SELECT * FROM follow_ups WHERE due_after < ? AND status = 'pending'"
  ).all(Date.now());
}

function markFollowUpSent(id) {
  db.prepare("UPDATE follow_ups SET status = 'sent', sent_at = ? WHERE id = ?").run(Date.now(), id);
}

// ===== Relationship Milestones =====

function addMilestone(userId, guildId, type, name, context) {
  const result = db.prepare(
    'INSERT INTO relationship_milestones (user_id, guild_id, milestone_type, milestone_name, achieved_at, context) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, type, name, Date.now(), context ?? null);
  return { id: result.lastInsertRowid };
}

function getMilestones(userId, guildId) {
  return db.prepare(
    'SELECT * FROM relationship_milestones WHERE user_id = ? AND guild_id = ? ORDER BY achieved_at DESC'
  ).all(userId, guildId);
}

// ===== User Emotional Context =====

function getUserEmotion(userId, guildId) {
  return db.prepare(
    'SELECT * FROM user_emotional_context WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
}

function setUserEmotion(userId, guildId, state) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO user_emotional_context (user_id, guild_id, emotional_state, topics_emotional, last_mood_check)
     VALUES (?, ?, ?, '{}', ?)
     ON CONFLICT(user_id, guild_id) DO UPDATE SET
       emotional_state = excluded.emotional_state,
       topics_emotional = excluded.topics_emotional,
       last_mood_check = excluded.last_mood_check`
  ).run(userId, guildId, state, now);
}

// ===== Emotional Intelligence: History & Trends =====

function logEmotionHistory(userId, guildId, emotion, sentiment) {
  db.prepare(
    'INSERT INTO emotion_history (user_id, guild_id, emotion, sentiment, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, guildId, emotion, sentiment, Date.now());
  // Prune old entries (keep last 50 per user)
  db.prepare(
    'DELETE FROM emotion_history WHERE user_id = ? AND guild_id = ? AND id NOT IN (SELECT id FROM emotion_history WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 50)'
  ).run(userId, guildId, userId, guildId);
}

function getEmotionTrend(userId, guildId, limit) {
  return db.prepare(
    'SELECT emotion, sentiment, created_at FROM emotion_history WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, guildId, limit || 10);
}

module.exports = {
  getRelationship,
  getGuildInteractionStats,
  getGuildMood,
  updateGuildMood,
  getUserProfile,
  getUserPreferences,
  setUserPreference,
  createFollowUp,
  getPendingFollowUps,
  markFollowUpSent,
  addMilestone,
  getMilestones,
  getUserEmotion,
  setUserEmotion,
  logEmotionHistory,
  getEmotionTrend,
};