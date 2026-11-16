if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const { db } = require('../../db/database');
const {
  utcDay,
  bumpDailyMessage,
  bumpDailyModerationBlock,
  getDayStats,
  getDaySpeakers,
  getDaySpeakerCount,
  pruneDailyStats,
} = require('../../db/guildStats');

const G = '1460698506489630844';
const OTHER = '983753918028845066';
const DAY = '2026-11-15';
const AT = Date.parse(DAY + 'T12:00:00Z');

assert.strictEqual(utcDay(AT), DAY);
assert.strictEqual(utcDay(Date.parse('2026-11-15T23:59:59Z')), DAY, 'end of day is same bucket');
assert.strictEqual(utcDay(Date.parse('2026-11-16T00:00:00Z')), '2026-11-16', 'next day is a new bucket');
assert.strictEqual(utcDay(undefined) !== undefined, true, 'undefined timestamp falls back to now');

// Idempotent creation + increments
bumpDailyMessage(G, 'u1', AT);
bumpDailyMessage(G, 'u1', AT);
bumpDailyMessage(G, 'u2', AT);
bumpDailyMessage(G, 'u3', AT);
bumpDailyMessage(OTHER, 'u9', AT);

assert.deepStrictEqual(getDayStats(G, DAY), { messages: 4, moderation_blocks: 0 });
assert.strictEqual(getDaySpeakerCount(G, DAY), 3, 'three distinct speakers');
assert.deepStrictEqual(
  getDaySpeakers(G, DAY, 3).map((s) => `${s.user_id}:${s.messages}`),
  ['u1:2', 'u2:1', 'u3:1'],
  'ordered by volume then id',
);
assert.strictEqual(getDaySpeakers(G, DAY, 1).length, 1, 'limit respected');
assert.strictEqual(getDayStats(OTHER, DAY).messages, 1, 'guilds do not bleed');
assert.deepStrictEqual(getDayStats(G, '2026-11-14'), { messages: 0, moderation_blocks: 0 }, 'absent day is zeroed');

// Day boundary splits counts
bumpDailyMessage(G, 'u1', Date.parse('2026-11-16T00:00:01Z'));
assert.strictEqual(getDayStats(G, DAY).messages, 4, 'previous day unchanged');
assert.strictEqual(getDayStats(G, '2026-11-16').messages, 1, 'new day started');

// Moderation blocks are independent of message counts
bumpDailyModerationBlock(G, AT);
bumpDailyModerationBlock(G, AT);
assert.deepStrictEqual(getDayStats(G, DAY), { messages: 4, moderation_blocks: 2 });

// Malformed input is ignored rather than throwing
assert.strictEqual(bumpDailyMessage(null, 'u1', AT), 0);
assert.strictEqual(bumpDailyMessage(G, null, AT), 0);
assert.strictEqual(bumpDailyModerationBlock(null, AT), 0);
assert.strictEqual(getDayStats(G, DAY).messages, 4, 'rejected writes changed nothing');

// Prune drops whole days older than the cutoff
const pruned = pruneDailyStats('2026-11-16');
assert.ok(pruned.stats >= 1 && pruned.speakers >= 1);
assert.deepStrictEqual(getDayStats(G, DAY), { messages: 0, moderation_blocks: 0 }, 'old day removed');
assert.strictEqual(getDayStats(G, '2026-11-16').messages, 1, 'recent day kept');
assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM guild_daily_speaker WHERE day < ?').get('2026-11-16').c, 0);

console.log('Guild stats smoke passed');
