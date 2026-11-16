if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const { db } = require('../../db/database');
const { logGuildEvent, getRecentGuildEvents, getGuildMembershipHistory } = require('../../db/guildMembership');

const GUILD_A = '1460698506489630844';
const GUILD_B = '983753918028845066';

logGuildEvent({ guildId: GUILD_A, guildName: 'IGTG Staff Lounge', event: 'joined', reason: 'allowlisted', memberCount: 37, occurredAt: 1000 });
logGuildEvent({ guildId: GUILD_B, guildName: 'Wirt', event: 'joined', reason: 'allowlisted', memberCount: 56, occurredAt: 2000 });
logGuildEvent({ guildId: GUILD_B, guildName: 'Wirt', event: 'left', reason: 'external', occurredAt: 3000 });

assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM guild_membership_log').get().c, 3);

const recent = getRecentGuildEvents(10);
assert.deepStrictEqual(recent.map((r) => `${r.guild_id}:${r.event}`), [`${GUILD_B}:left`, `${GUILD_B}:joined`, `${GUILD_A}:joined`], 'newest first');

const historyB = getGuildMembershipHistory(GUILD_B, 10);
assert.strictEqual(historyB.length, 2);
assert.strictEqual(historyB[0].event, 'left');
assert.strictEqual(historyB[1].member_count, 56);

assert.strictEqual(getGuildMembershipHistory(GUILD_A, 10).length, 1);
assert.strictEqual(getGuildMembershipHistory('999999999999999999', 10).length, 0);

// Limits
assert.strictEqual(getRecentGuildEvents(1).length, 1);
assert.strictEqual(getRecentGuildEvents(0).length, 3, 'invalid limit falls back to default');
assert.strictEqual(getRecentGuildEvents(undefined).length, 3);

// Fields default safely
assert.strictEqual(logGuildEvent({ guildId: '1234567890123456789', event: 'joined' }), 1);
const bare = getGuildMembershipHistory('1234567890123456789', 1)[0];
assert.strictEqual(bare.guild_name, null);
assert.strictEqual(bare.reason, null);
assert.strictEqual(bare.member_count, null);
assert.ok(bare.occurred_at > 0, 'timestamp defaults to now');

// Required fields are rejected without writing
assert.strictEqual(logGuildEvent({ event: 'joined' }), 0, 'missing guildId');
assert.strictEqual(logGuildEvent({ guildId: GUILD_A }), 0, 'missing event');
assert.strictEqual(logGuildEvent({}), 0);
assert.strictEqual(logGuildEvent(null), 0);

// The schema rejects events outside the allowed set
assert.throws(
  () => db.prepare("INSERT INTO guild_membership_log (guild_id, event, occurred_at) VALUES (?, 'kicked', ?)").run(GUILD_A, Date.now()),
  /CHECK constraint failed/,
);

console.log('Guild membership log smoke passed');
