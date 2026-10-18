// ===== SMOKE: CONSENT, CHECK-IN COOLDOWN, AND SENSITIVITY =====
if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const { db, setUserPreference } = require('../../db/database');
const { shouldSendCheckIn, getCheckInCandidates, parseCheckIn } = require('../../features/proactive/absenceDetector');

const userId = 'checkin-user';
const guildId = 'checkin-guild';
const now = Date.now();

setUserPreference(userId, guildId, 'proactive_opt_in', 0);
assert.strictEqual(shouldSendCheckIn(userId, guildId), false, 'opt-out blocks check-ins');
setUserPreference(userId, guildId, 'proactive_opt_in', 1);
assert.strictEqual(shouldSendCheckIn(userId, guildId), true, 'eligible opted-in user starts clear');

db.prepare("INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after, status, sent_at) VALUES (?, ?, 'proactive', ?, '', ?, ?, 'sent', ?)")
  .run(userId, guildId, 'memory:recent-topic', now - 72 * 60 * 60 * 1000, now, now - 72 * 60 * 60 * 1000 - 1);
assert.strictEqual(shouldSendCheckIn(userId, guildId), true, 'rolling 72-hour boundary allows another check-in');
db.prepare("UPDATE follow_ups SET sent_at = ? WHERE user_id = ? AND guild_id = ? AND channel_id = 'proactive'")
  .run(now - 72 * 60 * 60 * 1000 + 1000, userId, guildId);
assert.strictEqual(shouldSendCheckIn(userId, guildId), false, 'a check-in inside the 72-hour window blocks another');
db.prepare("UPDATE follow_ups SET status = 'responded' WHERE user_id = ? AND guild_id = ? AND channel_id = 'proactive'")
  .run(userId, guildId);
assert.strictEqual(shouldSendCheckIn(userId, guildId), false, 'a response does not bypass the global cadence');

const nowAtEnd = Date.now();
const insertMemory = db.prepare('INSERT INTO memory_entries (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
insertMemory.run(userId, guildId, 'extracted', 'interest', 'likes astronomy', 0.8, null, nowAtEnd, nowAtEnd, nowAtEnd);
insertMemory.run(userId, guildId, 'extracted', 'fact', 'has a medical diagnosis', 0.8, null, nowAtEnd, nowAtEnd, nowAtEnd);
const candidates = getCheckInCandidates(userId, guildId);
assert.ok(candidates.some(candidate => candidate.text === 'likes astronomy'));
assert.ok(!candidates.some(candidate => candidate.text.includes('medical diagnosis')));

assert.deepStrictEqual(parseCheckIn(JSON.stringify({ send: true, candidate_id: candidates[0].id, message: 'How is that project going?' }), candidates), {
  topic: candidates[0].id,
  message: 'How is that project going?',
});
assert.strictEqual(parseCheckIn(JSON.stringify({ send: true, candidate_id: 'unseen', message: 'How is that going?' }), candidates), null);
assert.strictEqual(parseCheckIn(JSON.stringify({ send: true, candidate_id: candidates[0].id, message: '<@everyone> report back now' }), candidates), null);
assert.strictEqual(parseCheckIn(JSON.stringify({ send: true, candidate_id: candidates[0].id, message: 'I missed you; where have you been?' }), candidates), null);

db.close();
console.log('Check-in policy smoke passed');
