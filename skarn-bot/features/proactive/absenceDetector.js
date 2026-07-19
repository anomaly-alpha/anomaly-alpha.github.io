const { db, getUserPreferences } = require('../../db/database');

const MIN_INTERACTIONS = 10; // must have this many to be "regular"
const ABSENCE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function findAbsentRegulars(guildId) {
  const cutoff = Date.now() - ABSENCE_THRESHOLD_MS;
  return db.prepare(
    `SELECT r.user_id, r.familiarity, r.last_interaction_at FROM user_relationship r
     WHERE r.guild_id = ? AND r.last_interaction_at < ? AND r.interaction_count >= ?
     ORDER BY r.familiarity DESC`
  ).all(guildId, cutoff, MIN_INTERACTIONS);
}

function shouldSendCheckIn(userId, guildId) {
  const prefs = getUserPreferences(userId, guildId);
  if (prefs && prefs.proactive_opt_out) return false;

  // Only send if we haven't sent one in the last 3 days
  const recent = db.prepare(
    "SELECT COUNT(*) as count FROM follow_ups WHERE user_id = ? AND guild_id = ? AND status = 'sent' AND sent_at > ?"
  ).get(userId, guildId, Date.now() - ABSENCE_THRESHOLD_MS);
  return recent.count === 0;
}

function generateCheckIn(userId) {
  const templates = [
    `hey <@${userId}>, been a minute 👀`,
    `<@${userId}> you still alive?`,
    `yo <@${userId}>, felt quiet without you around`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { findAbsentRegulars, shouldSendCheckIn, generateCheckIn };
