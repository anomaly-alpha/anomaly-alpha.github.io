const { db } = require('../db/database');

const HOURLY_CAP = 50;

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function incrementStat(userId, statType) {
  db.prepare(
    'INSERT INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, 1) ON CONFLICT(user_id, stat_type) DO UPDATE SET count = count + 1'
  ).run(userId, statType);
}

function recordMessage(userId) {
  incrementStat(userId, 'messages_sent');
}

function recordResponse(userId) {
  incrementStat(userId, 'responses_received');
}

function canRespond(userId) {
  const hour = currentHour();
  const statType = 'hourly_' + hour;
  return db.transaction(function() {
    const hourly = db.prepare(
      'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
    ).get(userId, statType);
    if (hourly && hourly.count >= HOURLY_CAP) return false;
    incrementStat(userId, statType);
    return true;
  })();
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
