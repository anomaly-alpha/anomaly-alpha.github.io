const { db } = require('../db/database');

// Auto-migration: add bucket column if missing (production databases created before this feature)
try {
  db.prepare("SELECT bucket FROM rate_limits LIMIT 0").get();
} catch {
  db.prepare("ALTER TABLE rate_limits ADD COLUMN bucket TEXT NOT NULL DEFAULT 'command'").run();
  try { db.prepare("DROP INDEX IF EXISTS idx_rate_limits_user").run(); } catch {}
  try { db.prepare("CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, bucket, timestamp)").run(); } catch {}
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 50;

function getUsage(userId, bucket) {
  bucket = bucket || 'command';
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM rate_limits WHERE user_id = ? AND bucket = ? AND timestamp > ?'
  ).get(userId, bucket, cutoff);
  return { current: count.count, max: RATE_LIMIT_MAX_CALLS };
}

function canCall(userId, bucket) {
  var usage = getUsage(userId, bucket);
  return usage.current < usage.max;
}

function recordCall(userId, bucket) {
  bucket = bucket || 'command';
  db.prepare('INSERT INTO rate_limits (user_id, bucket, timestamp) VALUES (?, ?, ?)').run(userId, bucket, Date.now());
}

function getRateLimitMessage(userId, bucket) {
  var usage = getUsage(userId, bucket);
  return 'Even a Warmaster paces himself. (' + usage.current + '/' + usage.max + ') Give it a moment.';
}

module.exports = { canCall, recordCall, getUsage, getRateLimitMessage };
