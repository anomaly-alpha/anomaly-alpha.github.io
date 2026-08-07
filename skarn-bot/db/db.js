// ===== db/db.js — shared connection + helpers =====
// Single better-sqlite3 connection every db/<domain>.js module shares.
// Dynamic UPDATE builders keep the .run(...vals) spread invariant centralized here.

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SKARN_DB_PATH || path.join(__dirname, '..', 'data', 'skarn.db');
const SCHEMA_PATH = path.join(__dirname, 'skarn-schema.sql');

// Ensure data directory exists (skip for in-memory / temp smoke DBs)
const dataDir = path.dirname(DB_PATH);
if (DB_PATH !== ':memory:' && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enforce declared foreign keys; WAL: faster crash recovery + concurrent read access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema on startup
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Migration: add proactive_opt_in column if missing (safe to run every startup)
try {
  db.prepare('ALTER TABLE user_preferences ADD COLUMN proactive_opt_in INTEGER DEFAULT 0').run();
  // Flip existing values: old proactive_opt_out=0 → proactive_opt_in=1
  db.prepare("UPDATE user_preferences SET proactive_opt_in = CASE WHEN proactive_opt_out = 0 THEN 1 ELSE 0 END").run();
} catch (e) {
  if (!e.message.includes('duplicate column')) {
    // Real error, not harmless "column already exists"
    console.error('[DB] Schema migration failed:', e.message);
  }
}

// Migration: add growth-tracking columns if missing
try { db.prepare("ALTER TABLE user_profile ADD COLUMN weekly_sentiment_history TEXT DEFAULT '[]'").run(); } catch (e) { if (!e.message.includes('duplicate column')) throw e; }
try { db.prepare("ALTER TABLE user_profile ADD COLUMN weekly_topic_history TEXT DEFAULT '[]'").run(); } catch (e) { if (!e.message.includes('duplicate column')) throw e; }

// Versioned migrations (user_version-tracked). Idempotent — safe every startup.
const { runMigrations } = require('./migrations');
runMigrations(db);

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

function updateRelationshipField(userId, guildId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(userId, guildId);
  db.prepare(`UPDATE user_relationship SET ${sets} WHERE user_id = ? AND guild_id = ?`).run(...values);
}

// ===== User Profile =====

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

// ===== Sentiment Buffers =====

function getSentimentBuffer(channelId) {
  const row = db.prepare('SELECT messages FROM sentiment_buffers WHERE channel_id = ?').get(channelId);
  return row ? JSON.parse(row.messages) : [];
}

function pushSentimentBuffer(channelId, content, maxSize = 5) {
  const existing = getSentimentBuffer(channelId);
  existing.push(content);
  if (existing.length > maxSize) existing.shift();
  db.prepare('INSERT OR REPLACE INTO sentiment_buffers (channel_id, messages, updated_at) VALUES (?, ?, ?)').run(channelId, JSON.stringify(existing), Date.now());
}

// ===== Attention State =====

function upsertAttentionState(userId, guildId, channelId, fields) {
  const gid = guildId || '';
  const existing = db.prepare('SELECT 1 FROM attention_state WHERE user_id = ? AND guild_id = ? AND channel_id = ?').get(userId, gid, channelId);
  if (existing) {
    const sets = Object.keys(fields).map(function(k) { return k + ' = ?'; }).join(', ');
    const vals = Object.values(fields);
    db.prepare('UPDATE attention_state SET ' + sets + ' WHERE user_id = ? AND guild_id = ? AND channel_id = ?').run(...vals, userId, gid, channelId);
  } else {
    const cols = ['user_id', 'guild_id', 'channel_id'].concat(Object.keys(fields));
    const placeholders = cols.map(function() { return '?'; }).join(', ');
    const vals = [userId, gid, channelId].concat(Object.values(fields));
    db.prepare('INSERT INTO attention_state (' + cols.join(', ') + ') VALUES (' + placeholders + ')').run(...vals);
  }
}

// ===== Rate Limits =====

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function pruneRateLimits() {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  db.prepare('DELETE FROM rate_limits WHERE timestamp < ?').run(cutoff);
}

// ===== App Flags =====

function pruneExpiredFlags() {
  try {
    db.prepare('DELETE FROM app_flags WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

// ===== Full-Text Search (shared helper) =====

// FTS5 treats many characters as operators; strip them so user queries
// can't throw "fts5: syntax error" (e.g. "c# tips", "a > b", "x:y").
function sanitizeFtsQuery(query) {
  return query.replace(/['"()*^$~`#|<>=&@:+\-]/g, '').trim();
}

module.exports = {
  db,
  getChannelState,
  updateChannelState,
  updateRelationshipField,
  upsertUserProfile,
  getSentimentBuffer,
  pushSentimentBuffer,
  upsertAttentionState,
  pruneRateLimits,
  pruneExpiredFlags,
  sanitizeFtsQuery,
};