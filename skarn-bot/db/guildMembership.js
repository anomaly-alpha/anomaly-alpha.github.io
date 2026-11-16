// ===== guild membership log =====
// Append-only record of every guild the bot joins or leaves, with the reason.
// Written by features/safety/guildAllowlist.js; read by operators and by
// scripts/guild-membership-report.js.

const { db } = require('./db');

function logGuildEvent(entry) {
  const record = entry || {};
  if (!record.guildId || !record.event) return 0;
  return db.prepare(
    'INSERT INTO guild_membership_log (guild_id, guild_name, event, reason, member_count, occurred_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    String(record.guildId),
    record.guildName || null,
    record.event,
    record.reason || null,
    Number.isFinite(record.memberCount) ? record.memberCount : null,
    Number.isFinite(record.occurredAt) ? record.occurredAt : Date.now(),
  ).changes;
}

function getRecentGuildEvents(limit) {
  const count = Number.isFinite(limit) && limit > 0 ? limit : 50;
  return db.prepare('SELECT * FROM guild_membership_log ORDER BY occurred_at DESC, id DESC LIMIT ?').all(count);
}

function getGuildMembershipHistory(guildId, limit) {
  const count = Number.isFinite(limit) && limit > 0 ? limit : 50;
  return db.prepare('SELECT * FROM guild_membership_log WHERE guild_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ?').all(String(guildId), count);
}

module.exports = { logGuildEvent, getRecentGuildEvents, getGuildMembershipHistory };
