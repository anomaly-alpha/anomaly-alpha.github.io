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

module.exports = {
  db,
  getUserMemory,
  addUserMemory,
  deleteUserMemory,
  getChannelState,
  updateChannelState,
};
