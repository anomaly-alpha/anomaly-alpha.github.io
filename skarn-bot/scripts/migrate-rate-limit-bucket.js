// Run: node scripts/migrate-rate-limit-bucket.js
// Adds bucket column to rate_limits for separate chat/command tracking

const { db } = require('../db/database');

const col = db.prepare("PRAGMA table_info(rate_limits)").all();
const hasBucket = col.some(function(c) { return c.name === 'bucket'; });

if (!hasBucket) {
  db.prepare("ALTER TABLE rate_limits ADD COLUMN bucket TEXT NOT NULL DEFAULT 'command'").run();
  console.log('Added bucket column to rate_limits');
} else {
  console.log('bucket column already exists — skipping');
}

console.log('Migration complete.');
