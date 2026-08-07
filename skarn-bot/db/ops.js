// ===== db: ops =====
const { db } = require('./db');

// ===== Cooldowns (mention/interjection/listen) =====

function checkMentionCooldown(userId, channelId) {
  const row = db.prepare('SELECT expires_at FROM mention_cooldowns WHERE user_id = ? AND channel_id = ?').get(userId, channelId);
  return row && row.expires_at > Date.now();
}

function setMentionCooldown(userId, channelId, ttlMs = 1000) {
  db.prepare('INSERT OR REPLACE INTO mention_cooldowns (user_id, channel_id, expires_at) VALUES (?, ?, ?)').run(userId, channelId, Date.now() + ttlMs);
}

function checkInterjectionCooldown(channelId) {
  const row = db.prepare('SELECT expires_at FROM interjection_cooldowns WHERE channel_id = ?').get(channelId);
  return row && row.expires_at > Date.now();
}

function setInterjectionCooldown(channelId, ttlMs = 300000) {
  db.prepare('INSERT OR REPLACE INTO interjection_cooldowns (channel_id, expires_at) VALUES (?, ?)').run(channelId, Date.now() + ttlMs);
}

function checkActiveListenCooldown(channelId) {
  const row = db.prepare('SELECT expires_at FROM active_listen_cooldowns WHERE channel_id = ?').get(channelId);
  return row && row.expires_at > Date.now();
}

function setActiveListenCooldown(channelId, ttlMs = 300000) {
  db.prepare('INSERT OR REPLACE INTO active_listen_cooldowns (channel_id, expires_at) VALUES (?, ?)').run(channelId, Date.now() + ttlMs);
}

// ===== App Flags =====

function setFlag(key, value, ttlMs) {
  try {
    db.prepare('INSERT OR REPLACE INTO app_flags (flag_key, flag_value, created_at, expires_at) VALUES (?, ?, ?, ?)').run(key, value, Date.now(), ttlMs ? Date.now() + ttlMs : null);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

function getFlag(key) {
  try {
    const row = db.prepare('SELECT flag_value FROM app_flags WHERE flag_key = ? AND (expires_at IS NULL OR expires_at > ?)').get(key, Date.now());
    return row ? row.flag_value : null;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return null;
    throw e;
  }
}

function getFlags(keys) {
  if (!keys || keys.length === 0) return {};
  var placeholders = keys.map(function() { return '?'; }).join(',');
  var rows = db.prepare('SELECT flag_key, flag_value FROM app_flags WHERE flag_key IN (' + placeholders + ') AND (expires_at IS NULL OR expires_at > ?)').all(...keys, Date.now());
  var out = {};
  for (var i = 0; i < rows.length; i++) out[rows[i].flag_key] = rows[i].flag_value;
  return out;
}

function deleteFlag(key) {
  try {
    db.prepare('DELETE FROM app_flags WHERE flag_key = ?').run(key);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

function hasFlag(key) {
  try {
    const row = db.prepare('SELECT 1 FROM app_flags WHERE flag_key = ? AND (expires_at IS NULL OR expires_at > ?)').get(key, Date.now());
    return !!row;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return false;
    throw e;
  }
}

// ===== App State =====

function getAppState(key) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setAppState(key, value) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, Date.now());
}

// ===== Guild Config =====

function getGuildConfig(guildId, key) {
  const row = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setGuildConfig(guildId, key, value) {
  const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
  db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, key, strVal);
}

// ===== FRIENDS (migrated from JSON) =====
function getAllFriends() {
  return db.prepare('SELECT * FROM friends ORDER BY name ASC').all();
}
function getFriendByCode(code) {
  return db.prepare('SELECT * FROM friends WHERE code = ?').get(code);
}
function searchFriends(query) {
  const escaped = query.toLowerCase().replace(/[%_]/g, m => '\\' + m);
  return db.prepare("SELECT * FROM friends WHERE LOWER(name) LIKE ? ESCAPE '\\'").all('%' + escaped + '%');
}

// ===== COOLDOWNS (generic) =====
function checkCooldown(key) {
  const row = db.prepare('SELECT 1 FROM cooldowns WHERE key = ? AND expires_at > ?').get(key, Date.now());
  return !!row;
}
function setCooldown(key, ttlMs) {
  db.prepare('INSERT OR REPLACE INTO cooldowns (key, expires_at) VALUES (?, ?)').run(key, Date.now() + ttlMs);
}
function cleanCooldowns() {
  db.prepare('DELETE FROM cooldowns WHERE expires_at < ?').run(Date.now());
}

// ===== REMINDERS =====
function createReminder(userId, channelId, guildId, message, remindAt) {
  db.prepare('INSERT INTO reminders (user_id, channel_id, guild_id, message, remind_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, channelId, guildId, message, remindAt, Date.now());
}
function getDueReminders() {
  return db.prepare('SELECT * FROM reminders WHERE remind_at <= ? AND delivered = 0').all(Date.now());
}
function markReminderDelivered(id) {
  db.prepare('UPDATE reminders SET delivered = 1 WHERE id = ?').run(id);
}
function getPendingReminders() {
  return db.prepare('SELECT * FROM reminders WHERE delivered = 0 ORDER BY remind_at ASC').all();
}

// ===== GIVEAWAYS =====
function createGiveaway(guildId, channelId, prize, endsAt, hostId, winnerCount) {
  db.prepare('INSERT INTO giveaways (guild_id, channel_id, prize, ends_at, host_id, winner_count) VALUES (?, ?, ?, ?, ?, ?)')
    .run(guildId, channelId, prize, endsAt, hostId, winnerCount || 1);
}
function getActiveGiveaways() {
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();
}
function getEndedGiveaways() {
  return db.prepare('SELECT * FROM giveaways WHERE ends_at <= ? AND ended = 0').all(Date.now());
}
function markGiveawayEnded(id) {
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(id);
}

// ===== REACTION ROLES =====
function addReactionRole(guildId, channelId, messageId, emoji, roleId) {
  db.prepare('INSERT OR IGNORE INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, channelId, messageId, emoji, roleId);
}
function getReactionRolesByMessage(messageId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE message_id = ?').all(messageId);
}
function getAllReactionRoles() {
  return db.prepare('SELECT * FROM reaction_roles').all();
}
function removeReactionRole(messageId, emoji) {
  db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?').run(messageId, emoji);
}

// ===== Lorebook (World Info) =====

const LOREBOOK_CACHE_TTL = 5 * 60 * 1000;
let lorebookCache = null;
let lorebookCacheLoadedAt = 0;

function refreshLorebookCache() {
  lorebookCache = db.prepare('SELECT * FROM lorebook ORDER BY priority DESC').all();
  lorebookCacheLoadedAt = Date.now();
}
// Initial load
refreshLorebookCache();

function addLoreEntry(guildId, keywords, content, category, priority) {
  const now = Date.now();
  db.prepare('INSERT INTO lorebook (guild_id, keywords, content, category, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, keywords, content, category || 'general', priority || 0, now, now);
  refreshLorebookCache();
}

function removeLoreEntry(id) {
  db.prepare('DELETE FROM lorebook WHERE id = ?').run(id);
  refreshLorebookCache();
}

function getLoreEntries(guildId) {
  return db.prepare('SELECT * FROM lorebook WHERE guild_id = ? ORDER BY priority DESC').all(guildId);
}

function findLoreForMessage(message, guildId) {
  if (!message) return [];
  const lower = message.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  const cleaned = lower.replace(/[^a-z0-9\s]/g, '');

  // Refresh cache if expired
  const now = Date.now();
  if (now - lorebookCacheLoadedAt > LOREBOOK_CACHE_TTL) refreshLorebookCache();

  if (!lorebookCache) return [];

  const matches = [];
  for (const entry of lorebookCache) {
    if (entry.guild_id !== guildId) continue;
    const kws = entry.keywords.split(',').map(k => k.trim().toLowerCase());
    for (const kw of kws) {
      if (cleaned.includes(kw) || words.includes(kw)) {
        matches.push(entry);
        break;
      }
    }
  }

  return matches.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

module.exports = {
  checkMentionCooldown,
  setMentionCooldown,
  checkInterjectionCooldown,
  setInterjectionCooldown,
  checkActiveListenCooldown,
  setActiveListenCooldown,
  setFlag,
  getFlag,
  getFlags,
  deleteFlag,
  hasFlag,
  getAppState,
  setAppState,
  getGuildConfig,
  setGuildConfig,
  getAllFriends,
  getFriendByCode,
  searchFriends,
  checkCooldown,
  setCooldown,
  cleanCooldowns,
  createReminder,
  getDueReminders,
  markReminderDelivered,
  getPendingReminders,
  createGiveaway,
  getActiveGiveaways,
  getEndedGiveaways,
  markGiveawayEnded,
  addReactionRole,
  getReactionRolesByMessage,
  getAllReactionRoles,
  removeReactionRole,
  addLoreEntry,
  removeLoreEntry,
  getLoreEntries,
  findLoreForMessage,
};