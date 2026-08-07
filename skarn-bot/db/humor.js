// ===== db: humor =====
const { db } = require('./db');

// ===== Banter Chains =====

function getBanterChain(userId, guildId, channelId) {
  return db.prepare('SELECT * FROM banter_chains WHERE user_id = ? AND guild_id = ? AND channel_id = ? ORDER BY last_active_at DESC LIMIT 1').get(userId, guildId, channelId);
}

function upsertBanterChain(userId, guildId, channelId, chainData) {
  const existing = getBanterChain(userId, guildId, channelId);
  const now = Date.now();
  if (existing) {
    db.prepare('UPDATE banter_chains SET chain_data = ?, last_active_at = ? WHERE id = ?').run(chainData, now, existing.id);
  } else {
    db.prepare('INSERT INTO banter_chains (user_id, guild_id, channel_id, chain_data, started_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, guildId, channelId, chainData, now, now);
  }
}

function pruneBanterChains(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM banter_chains WHERE last_active_at < ?').run(cutoff);
}

// ===== Callbacks =====

function addCallback(channelId, userId, message) {
  db.prepare('INSERT INTO callbacks (channel_id, user_id, message, created_at) VALUES (?, ?, ?, ?)').run(channelId, userId, message, Date.now());
}

function getCallbacks(channelId, limit = 5) {
  return db.prepare('SELECT * FROM callbacks WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?').all(channelId, limit);
}

function pruneCallbacks(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM callbacks WHERE created_at < ?').run(cutoff);
}

module.exports = {
  getBanterChain,
  upsertBanterChain,
  pruneBanterChains,
  addCallback,
  getCallbacks,
  pruneCallbacks,
};