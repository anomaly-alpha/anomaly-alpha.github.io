// ===== SMOKE: REAL GATE ADMISSION CHECK =====
// Seeds a temp DB, then calls the REAL moderatedChatCompletion. Both cases
// return { success:false, safeMessage } with zero network (silence + rate gate).
const { db } = require('../db/database');   // honors SKARN_DB_PATH
const now = Date.now();

// (a) silenced user: seed the same app_flags shape getStrikes() reads.
//     app_flags(flag_key, flag_value, created_at, expires_at) — schema:446
const STRIKE_LIMIT = 3;   // slurFilter.js:6 (STRIKE_LIMIT is private; do not import)
db.prepare('INSERT INTO app_flags (flag_key, flag_value, created_at, expires_at) VALUES (?,?,?,?)')
  .run('strike_siluser',
    JSON.stringify({ count: STRIKE_LIMIT, windowStart: now - 2000, silencedUntil: now + 60000 }),
    now, now + 60000);

// (b) over-quota user: fill the bucket (rate_limits(id,user_id,bucket,timestamp) — schema:344)
const RATE_LIMIT_MAX_CALLS = 50;   // private const in lib/rateLimit.js:13 — hardcode, do not import
const ins = db.prepare('INSERT INTO rate_limits (user_id, bucket, timestamp) VALUES (?,?,?)');
for (let i = 0; i < RATE_LIMIT_MAX_CALLS; i++) ins.run('bulkuser', 'test', now);

const { moderatedChatCompletion } = require('../ai/client');  // exported prop at ai/client.js:132
(async () => {
  const silenced = await moderatedChatCompletion({
    userId: 'siluser', bucket: 'test', messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('silenced user blocked:', silenced.success === false && !!silenced.safeMessage);
  const over = await moderatedChatCompletion({
    userId: 'bulkuser', bucket: 'test', messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('over-quota user blocked:', over.success === false && !!over.safeMessage);
})();