const { db } = require('../db/database');

const HOURLY_CAP = 50;

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function recordMessage(userId) {
  db.prepare(
    'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, COALESCE((SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?), 0) + 1)'
  ).run(userId, 'messages_sent', userId, 'messages_sent');
}

function recordResponse(userId) {
  db.prepare(
    'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, COALESCE((SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?), 0) + 1)'
  ).run(userId, 'responses_received', userId, 'responses_received');
}

function canRespond(userId) {
  const hour = currentHour();
  const hourly = db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'hourly_' + hour);
  if (hourly && hourly.count >= HOURLY_CAP) return false;
  db.prepare(
    'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, COALESCE((SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?), 0) + 1)'
  ).run(userId, 'hourly_' + hour, userId, 'hourly_' + hour);
  return true;
}

function getStats(userId) {
  const hour = currentHour();
  const hourly = db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'hourly_' + hour);
  const used = hourly ? hourly.count : 0;
  const remaining = Math.max(0, HOURLY_CAP - used);
  const messagesSent = (db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'messages_sent') || {}).count || 0;
  const responsesReceived = (db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'responses_received') || {}).count || 0;
  return { remaining, used, cap: HOURLY_CAP, resetsAt: new Date((hour + 1) * 3600000), messagesSent, responsesReceived };
}

function resetStats(userId) {
  db.prepare('DELETE FROM ai_usage WHERE user_id = ?').run(userId);
}

module.exports = { recordMessage, recordResponse, canRespond, getStats, resetStats };
