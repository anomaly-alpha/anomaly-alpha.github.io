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
};
