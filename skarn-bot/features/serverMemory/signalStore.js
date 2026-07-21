const { db } = require('../../db/database');

function insertSignal(guildId, channelId, signalType, summaryText, sourceUserId) {
  return db.prepare(
    'INSERT INTO server_signals (guild_id, channel_id, signal_type, summary_text, source_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(guildId, channelId, signalType, summaryText, sourceUserId, Date.now());
}

function getSignalsSince(guildId, since) {
  return db.prepare(
    'SELECT * FROM server_signals WHERE guild_id = ? AND created_at >= ? ORDER BY created_at ASC'
  ).all(guildId, since);
}

function countSignalsSince(guildId, since) {
  const row = db.prepare(
    'SELECT COUNT(*) AS count FROM server_signals WHERE guild_id = ? AND created_at >= ?'
  ).get(guildId, since);
  return row.count;
}

function pruneSignals(olderThan) {
  return db.prepare('DELETE FROM server_signals WHERE created_at < ?').run(olderThan);
}

function isOptedOut(userId, guildId) {
  const row = db.prepare(
    'SELECT chronicle_optout FROM memory_optout WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
  return row ? row.chronicle_optout === 1 : false;
}

function setOptOut(userId, guildId, optOut) {
  db.prepare(
    'INSERT OR REPLACE INTO memory_optout (user_id, guild_id, chronicle_optout) VALUES (?, ?, ?)'
  ).run(userId, guildId, optOut ? 1 : 0);
}

module.exports = {
  insertSignal,
  getSignalsSince,
  countSignalsSince,
  pruneSignals,
  isOptedOut,
  setOptOut,
};
