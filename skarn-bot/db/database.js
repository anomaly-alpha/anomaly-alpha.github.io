const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'skarn.db');
const SCHEMA_PATH = path.join(__dirname, 'skarn-schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Run schema on startup
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// ===== User Memory =====

function getUserMemory(userId, guildId, limit = 5) {
  return db.prepare(
    'SELECT fact_text FROM user_memory WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, guildId, limit);
}

function addUserMemory(userId, guildId, factText) {
  db.prepare(
    'INSERT INTO user_memory (user_id, guild_id, fact_text, created_at) VALUES (?, ?, ?, ?)'
  ).run(userId, guildId, factText, Date.now());
}

function deleteUserMemory(userId, guildId) {
  db.prepare('DELETE FROM user_memory WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

// ===== Channel State =====

function getChannelState(channelId, guildId) {
  const row = db.prepare('SELECT * FROM channel_state WHERE channel_id = ?').get(channelId);
  if (row) return row;
  // Create default row
  const now = Date.now();
  db.prepare(
    'INSERT INTO channel_state (channel_id, guild_id, current_state, last_message_at, last_transition_at, recent_message_count, count_window_started_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(channelId, guildId, 'Attentive', now, now, 0, now);
  return db.prepare('SELECT * FROM channel_state WHERE channel_id = ?').get(channelId);
}

function updateChannelState(channelId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(channelId);
  db.prepare(`UPDATE channel_state SET ${sets} WHERE channel_id = ?`).run(...values);
}

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

function updateRelationshipField(userId, guildId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(userId, guildId);
  db.prepare(`UPDATE user_relationship SET ${sets} WHERE user_id = ? AND guild_id = ?`).run(...values);
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

// ===== Server Culture =====

function addNGram(guildId, channelId, ngram) {
  const existing = db.prepare('SELECT frequency FROM server_culture WHERE guild_id = ? AND channel_id = ? AND ngram = ?').get(guildId, channelId, ngram);
  if (existing) {
    db.prepare('UPDATE server_culture SET frequency = frequency + 1, last_seen_at = ? WHERE guild_id = ? AND channel_id = ? AND ngram = ?')
      .run(Date.now(), guildId, channelId, ngram);
  } else {
    db.prepare('INSERT INTO server_culture (guild_id, channel_id, ngram, frequency, first_seen_at, last_seen_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run(guildId, channelId, ngram, Date.now(), Date.now());
  }
}

function getTopNGrams(guildId, channelId, limit) {
  return db.prepare('SELECT ngram, frequency FROM server_culture WHERE guild_id = ? AND channel_id = ? ORDER BY frequency DESC LIMIT ?')
    .all(guildId, channelId, limit || 5);
}

// ===== Conversation Threads =====

const CHANNEL_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes for channels
const DM_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 hours for DMs

function getActiveThread(userId, guildId, channelId) {
  const now = Date.now();
  const row = db.prepare(
    'SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND archived_at IS NULL ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);
  if (!row) return null;

  const timeout = row.thread_type === 'dm' ? DM_INACTIVITY_MS : CHANNEL_INACTIVITY_MS;
  if ((now - row.last_active_at) < timeout) return row;
  return null;
}

function createThread(userId, guildId, channelId, threadType) {
  const threadId = `thread_${userId}_${guildId}_${Date.now()}`;
  const now = Date.now();
  db.prepare(
    'INSERT INTO conversation_threads (thread_id, user_id, guild_id, channel_id, thread_type, started_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(threadId, userId, guildId, channelId, threadType, now, now);
  return { thread_id: threadId, user_id: userId, guild_id: guildId, channel_id: channelId, thread_type: threadType, started_at: now, last_active_at: now };
}

function archiveThread(threadId) {
  db.prepare('UPDATE conversation_threads SET archived_at = ? WHERE thread_id = ?').run(Date.now(), threadId);
}

function updateThreadActivity(threadId) {
  db.prepare('UPDATE conversation_threads SET last_active_at = ?, message_count = message_count + 1 WHERE thread_id = ?').run(Date.now(), threadId);
}

function updateThreadSentiment(threadId, sentiment) {
  const row = db.prepare('SELECT sentiment_start FROM conversation_threads WHERE thread_id = ?').get(threadId);
  if (row && row.sentiment_start === null) {
    db.prepare('UPDATE conversation_threads SET sentiment_start = ? WHERE thread_id = ?').run(sentiment, threadId);
  }
  db.prepare('UPDATE conversation_threads SET sentiment_end = ? WHERE thread_id = ?').run(sentiment, threadId);
}

// ===== Conversation Messages =====

function insertMessage(threadId, userId, guildId, channelId, role, content, opts = {}) {
  const { sentiment = 0, topics = [], isQuestion = false, tokensEst = 0 } = opts;
  db.prepare(
    'INSERT INTO conversation_messages (thread_id, user_id, guild_id, channel_id, role, content, sentiment, topics, is_question, tokens_est, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(threadId, userId, guildId, channelId, role, content, sentiment, JSON.stringify(topics), isQuestion ? 1 : 0, tokensEst, Date.now());
}

function getRecentMessages(userId, guildId, channelId, limit = 20, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return db.prepare(
    `SELECT m.* FROM conversation_messages m
     JOIN conversation_threads t ON m.thread_id = t.thread_id
     WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ?
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(userId, guildId, channelId, cutoff, limit).reverse();
}

// ===== Conversation Summaries =====

function insertSummary(threadId, summaryText, coversFrom, coversTo, messageCount) {
  db.prepare(
    'INSERT INTO conversation_summaries (thread_id, summary_text, covers_from, covers_to, message_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(threadId, summaryText, coversFrom, coversTo, messageCount, Date.now());
}

function getOlderSummaries(userId, guildId, channelId, limit = 3) {
  return db.prepare(
    `SELECT s.* FROM conversation_summaries s
     JOIN conversation_threads t ON s.thread_id = t.thread_id
     WHERE t.user_id = ? AND t.guild_id = ? AND t.channel_id = ?
     ORDER BY s.covers_to DESC LIMIT ?`
  ).all(userId, guildId, channelId, limit);
}

function getThreadsNeedingSummary(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  return db.prepare(
    'SELECT * FROM conversation_threads WHERE archived_at IS NOT NULL AND archived_at < ? AND topic_summary IS NULL AND message_count >= 3'
  ).all(cutoff);
}

function getThreadMessages(threadId) {
  return db.prepare('SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at').all(threadId);
}

function updateThreadSummary(threadId, summaryText) {
  db.prepare('UPDATE conversation_threads SET topic_summary = ? WHERE thread_id = ?').run(summaryText, threadId);
}

// ===== User Profile =====

function getUserProfile(userId, guildId) {
  return db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function upsertUserProfile(userId, guildId, data) {
  const existing = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (existing) {
    const keys = Object.keys(data);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    db.prepare(`UPDATE user_profile SET ${sets}, last_profile_update_at = ? WHERE user_id = ? AND guild_id = ?`).run(...values, Date.now(), userId, guildId);
  } else {
    const keys = ['last_profile_update_at', ...Object.keys(data)];
    const values = [Date.now(), ...Object.values(data)];
    db.prepare(`INSERT INTO user_profile (user_id, guild_id, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})`).run(userId, guildId, ...values);
  }
}

// ===== Pruning =====

function pruneOldMessages(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
}

// ===== Privacy =====

function deleteUserConversation(userId, guildId) {
  const threads = db.prepare('SELECT thread_id FROM conversation_threads WHERE user_id = ? AND guild_id = ?').all(userId, guildId);
  for (const t of threads) {
    db.prepare('DELETE FROM conversation_messages WHERE thread_id = ?').run(t.thread_id);
    db.prepare('DELETE FROM conversation_summaries WHERE thread_id = ?').run(t.thread_id);
  }
  db.prepare('DELETE FROM conversation_threads WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
  db.prepare('DELETE FROM user_profile WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

module.exports = {
  db,
  getUserMemory,
  addUserMemory,
  deleteUserMemory,
  getChannelState,
  updateChannelState,
  getRelationship,
  updateRelationshipField,
  getGuildInteractionStats,
  getGuildMood,
  updateGuildMood,
  addNGram,
  getTopNGrams,
  getActiveThread,
  createThread,
  archiveThread,
  updateThreadActivity,
  updateThreadSentiment,
  insertMessage,
  getRecentMessages,
  insertSummary,
  getOlderSummaries,
  getThreadsNeedingSummary,
  getThreadMessages,
  updateThreadSummary,
  getUserProfile,
  upsertUserProfile,
  pruneOldMessages,
  deleteUserConversation,
};
