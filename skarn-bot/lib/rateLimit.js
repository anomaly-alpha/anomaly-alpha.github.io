const { db } = require('../db/database');

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 10;
const RATE_LIMIT_MSG = 'Even a Warmaster paces himself. Give it a moment.';

function canCall(userId) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM rate_limits WHERE user_id = ? AND timestamp > ?'
  ).get(userId, cutoff);
  return count.count < RATE_LIMIT_MAX_CALLS;
}

function recordCall(userId) {
  db.prepare('INSERT INTO rate_limits (user_id, timestamp) VALUES (?, ?)').run(userId, Date.now());
}

module.exports = { canCall, recordCall, RATE_LIMIT_MSG };
