// ===== per-guild daily counters =====
// Human message volume, distinct speakers, and moderation blocks, bucketed by
// UTC day. Feeds the operator's daily per-server summary.
//
// Every write swallows its own errors on purpose: these are called from the
// messageCreate hot path and from the AI admission gate, and a counting failure
// must never drop a message or an AI reply.

const { db } = require('./db');

function utcDay(atMs) {
  const ms = Number.isFinite(atMs) ? atMs : Date.now();
  return new Date(ms).toISOString().slice(0, 10);
}

function bumpDailyMessage(guildId, userId, atMs) {
  if (!guildId || !userId) return 0;
  const day = utcDay(atMs);
  try {
    db.prepare(
      'INSERT INTO guild_daily_stats (guild_id, day, messages) VALUES (?, ?, 1) ' +
      'ON CONFLICT(guild_id, day) DO UPDATE SET messages = messages + 1'
    ).run(String(guildId), day);
    db.prepare(
      'INSERT INTO guild_daily_speaker (guild_id, day, user_id, messages) VALUES (?, ?, ?, 1) ' +
      'ON CONFLICT(guild_id, day, user_id) DO UPDATE SET messages = messages + 1'
    ).run(String(guildId), day, String(userId));
    return 1;
  } catch (error) {
    console.error('[GuildStats] message bump failed:', error.message);
    return 0;
  }
}

function bumpDailyModerationBlock(guildId, atMs) {
  if (!guildId) return 0;
  try {
    db.prepare(
      'INSERT INTO guild_daily_stats (guild_id, day, moderation_blocks) VALUES (?, ?, 1) ' +
      'ON CONFLICT(guild_id, day) DO UPDATE SET moderation_blocks = moderation_blocks + 1'
    ).run(String(guildId), utcDay(atMs));
    return 1;
  } catch (error) {
    console.error('[GuildStats] moderation bump failed:', error.message);
    return 0;
  }
}

function getDayStats(guildId, day) {
  const row = db.prepare('SELECT messages, moderation_blocks FROM guild_daily_stats WHERE guild_id = ? AND day = ?')
    .get(String(guildId), day);
  return row || { messages: 0, moderation_blocks: 0 };
}

function getDaySpeakers(guildId, day, limit) {
  const count = Number.isFinite(limit) && limit > 0 ? limit : 5;
  return db.prepare(
    'SELECT user_id, messages FROM guild_daily_speaker WHERE guild_id = ? AND day = ? ORDER BY messages DESC, user_id ASC LIMIT ?'
  ).all(String(guildId), day, count);
}

function getDaySpeakerCount(guildId, day) {
  return db.prepare('SELECT COUNT(*) c FROM guild_daily_speaker WHERE guild_id = ? AND day = ?')
    .get(String(guildId), day).c;
}

function pruneDailyStats(beforeDay) {
  const cutoff = beforeDay || utcDay(Date.now() - 90 * 24 * 60 * 60 * 1000);
  try {
    const a = db.prepare('DELETE FROM guild_daily_stats WHERE day < ?').run(cutoff).changes;
    const b = db.prepare('DELETE FROM guild_daily_speaker WHERE day < ?').run(cutoff).changes;
    return { stats: a, speakers: b };
  } catch (error) {
    console.error('[GuildStats] prune failed:', error.message);
    return { stats: 0, speakers: 0 };
  }
}

module.exports = {
  utcDay,
  bumpDailyMessage,
  bumpDailyModerationBlock,
  getDayStats,
  getDaySpeakers,
  getDaySpeakerCount,
  pruneDailyStats,
};
