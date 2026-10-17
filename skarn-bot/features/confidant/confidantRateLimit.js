const { db } = require('../../db/database');

const USER_WINDOW_MS = 24 * 60 * 60 * 1000;
const USER_DAILY_LIMIT = 15;
const GLOBAL_DAILY_LIMIT = Math.max(1, parseInt(process.env.CONFIDANT_DAILY_CALL_LIMIT, 10) || 300);

function utcDate(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function reserve(userId, multiplier = 1, now = Date.now()) {
  const perUserMax = Math.floor(USER_DAILY_LIMIT * Math.max(1, multiplier));
  const result = db.transaction(() => {
    const userCount = db.prepare('SELECT COUNT(*) AS count FROM confidant_rate_limits WHERE user_id = ? AND created_at > ?').get(userId, now - USER_WINDOW_MS).count;
    if (userCount >= perUserMax) return { allowed: false, reason: 'user' };
    const day = utcDate(now);
    db.prepare('INSERT OR IGNORE INTO confidant_daily_usage (date, call_count) VALUES (?, 0)').run(day);
    const globalCount = db.prepare('SELECT call_count FROM confidant_daily_usage WHERE date = ?').get(day).call_count;
    if (globalCount >= GLOBAL_DAILY_LIMIT) return { allowed: false, reason: 'global' };
    db.prepare('INSERT INTO confidant_rate_limits (user_id, created_at) VALUES (?, ?)').run(userId, now);
    db.prepare('UPDATE confidant_daily_usage SET call_count = call_count + 1 WHERE date = ?').run(day);
    return { allowed: true, reason: null };
  });
  return result();
}

function getGlobalUsage(now = Date.now()) {
  const row = db.prepare('SELECT call_count FROM confidant_daily_usage WHERE date = ?').get(utcDate(now));
  return { current: row ? row.call_count : 0, max: GLOBAL_DAILY_LIMIT };
}

function prune(now = Date.now()) {
  db.prepare('DELETE FROM confidant_rate_limits WHERE created_at < ?').run(now - USER_WINDOW_MS);
  db.prepare('DELETE FROM confidant_daily_usage WHERE date < ?').run(utcDate(now - 7 * USER_WINDOW_MS));
}

module.exports = { reserve, getGlobalUsage, prune, USER_DAILY_LIMIT, GLOBAL_DAILY_LIMIT, utcDate };
