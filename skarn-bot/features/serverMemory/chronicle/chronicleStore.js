const db = require('../../../db/database');

function insertEntry(guildId, content, periodStart, periodEnd) {
  return db.prepare(
    'INSERT INTO chronicle_entries (guild_id, content, period_start, period_end, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, content, periodStart, periodEnd, Date.now());
}

function getRecentEntry(guildId) {
  return db.prepare(
    'SELECT * FROM chronicle_entries WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(guildId);
}

function getLatestEntryPeriod(guildId) {
  const row = db.prepare(
    'SELECT period_end FROM chronicle_entries WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(guildId);
  return row ? row.period_end : null;
}

function getEntries(guildId, page, pageSize) {
  const offset = (page - 1) * pageSize;
  return db.prepare(
    'SELECT * FROM chronicle_entries WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(guildId, pageSize, offset);
}

module.exports = {
  insertEntry,
  getRecentEntry,
  getLatestEntryPeriod,
  getEntries,
};
