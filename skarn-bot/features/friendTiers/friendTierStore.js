const { db } = require('../../db/database');

function getTier(userId, guildId) {
  return db.prepare('SELECT * FROM friend_tiers WHERE user_id = ? AND guild_id = ?').get(userId, guildId) || null;
}

function getGuildTiers(guildId, limit = 10) {
  return db.prepare('SELECT * FROM friend_tiers WHERE guild_id = ? ORDER BY current_tier DESC, activity_points DESC, first_seen_at ASC LIMIT ?').all(guildId, limit);
}

function getFlags(userId, guildId) {
  return db.prepare('SELECT * FROM friend_flags WHERE user_id = ? AND guild_id = ?').get(userId, guildId) || null;
}

function setFlag(userId, guildId, flag, value, actorId) {
  if (!['ai_blocked', 'ai_limited'].includes(flag) || ![0, 1].includes(value)) throw new Error('Invalid friend flag');
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO friend_flags (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
    db.prepare('UPDATE friend_flags SET ' + flag + ' = ?, set_by = ?, updated_at = ? WHERE user_id = ? AND guild_id = ?').run(value, actorId, now, userId, guildId);
    db.prepare('INSERT INTO friend_flag_audit (user_id, guild_id, flag, value, set_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, guildId, flag, value, actorId, now);
  });
  tx();
  return getFlags(userId, guildId);
}

function getFlagAudit(userId, guildId, limit = 10) {
  return db.prepare('SELECT flag, value, set_by, created_at FROM friend_flag_audit WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, guildId, limit);
}

function getTierChannel(guildId) {
  const row = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'friendTierChannel');
  return row ? row.value : null;
}

function setTierChannel(guildId, channelId) {
  db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'friendTierChannel', channelId);
}

function upsertActivity(userId, guildId, now, today) {
  const tx = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO friend_tiers (user_id, guild_id, first_seen_at, last_interaction_at, activity_points_today_date, current_tier) VALUES (?, ?, ?, ?, ?, 0)').run(userId, guildId, now, now, today);
    const row = getTier(userId, guildId);
    const count = row.activity_points_today_date === today ? row.activity_points_today : 0;
    const qualifies = count < 5;
    db.prepare('UPDATE friend_tiers SET last_interaction_at = ?, activity_points = activity_points + ?, activity_points_today = ?, activity_points_today_date = ?, last_decay_at = ? WHERE user_id = ? AND guild_id = ?').run(now, qualifies ? 1 : 0, qualifies ? count + 1 : count, today, now, userId, guildId);
  });
  tx();
  return getTier(userId, guildId);
}

function updateTierProgress(userId, guildId, patch) {
  const columns = Object.keys(patch);
  if (!columns.length || columns.some(k => !['current_tier', 'activity_points', 'last_decay_at'].includes(k))) return;
  const setSql = columns.map(k => k + ' = ?').join(', ');
  db.prepare('UPDATE friend_tiers SET ' + setSql + ' WHERE user_id = ? AND guild_id = ?').run(...columns.map(k => patch[k]), userId, guildId);
}

function getAllTierRows() {
  return db.prepare('SELECT * FROM friend_tiers').all();
}

module.exports = { getTier, getGuildTiers, getFlags, setFlag, getFlagAudit, getTierChannel, setTierChannel, upsertActivity, updateTierProgress, getAllTierRows };
