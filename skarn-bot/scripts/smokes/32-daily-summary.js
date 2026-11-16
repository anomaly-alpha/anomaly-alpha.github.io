if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const { db } = require('../../db/database');
const { bumpDailyMessage, bumpDailyModerationBlock } = require('../../db/guildStats');
const { logGuildEvent } = require('../../db/guildMembership');
const {
  HOUR_ENV_KEY,
  OPERATOR_ENV_KEY,
  DEFAULT_HOUR_UTC,
  buildGuildSummaryText,
  sendDailySummaries,
  startDailySummary,
} = require('../../features/guildStats/dailySummary');

const DAY = '2026-11-15';
const AT = Date.parse(DAY + 'T12:00:00Z');
const G = '1460698506489630844';
const G2 = '983753918028845066';

function fakeClient(guilds) {
  const sent = [];
  return {
    sent,
    guilds: { cache: new Map(guilds.map((g) => [g.id, g])) },
    users: {
      cache: new Map(),
      async fetch(id) {
        if (id === 'closed-dms') throw new Error('Cannot send messages to this user');
        return { send: async (payload) => { sent.push({ to: id, content: payload.content }); } };
      },
    },
  };
}

function guild(id, name, memberCount) {
  return { id, name, memberCount, members: { cache: new Map() } };
}

function silent() {
  const lines = [];
  const log = (m) => lines.push(m);
  log.lines = lines;
  return log;
}

async function main() {
  // ---- pure text formatting ----
  const quiet = buildGuildSummaryText('Quiet', DAY, {
    messages: 0, moderationBlocks: 0, speakers: [], speakerCount: 0,
    aiExchanges: 0, aiThreads: 0, aiPeople: 0, joined: 0, left: 0,
  }, { memberCount: 40 });
  assert.ok(quiet.includes('Quiet — ' + DAY), 'header names the guild and day');
  assert.ok(quiet.includes('nothing happened'), 'quiet day says so');
  assert.ok(quiet.includes('40 members, quiet all day'));

  const busy = buildGuildSummaryText('Busy', DAY, {
    messages: 37,
    moderationBlocks: 2,
    speakers: [{ user_id: 'u1', messages: 14 }, { user_id: 'u2', messages: 9 }],
    speakerCount: 5,
    aiExchanges: 6, aiThreads: 3, aiPeople: 2,
    joined: 1, left: 0,
  }, { memberCount: 37, nameOf: (id) => (id === 'u1' ? 'alice' : 'bob') });
  assert.ok(busy.includes('37 messages from 5 people'), 'message line');
  assert.ok(busy.includes('alice (14), bob (9)'), 'top speakers resolved to names');
  assert.ok(busy.includes('6 ai exchanges across 3 threads from 2 people'), 'ai line');
  assert.ok(busy.includes('2 inputs blocked by moderation'), 'moderation line');
  assert.ok(busy.includes('1 joined'), 'membership line');
  assert.ok(busy.includes('37 members now'), 'member total');

  const singular = buildGuildSummaryText('One', DAY, {
    messages: 1, moderationBlocks: 1, speakers: [{ user_id: 'u1', messages: 1 }], speakerCount: 1,
    aiExchanges: 1, aiThreads: 1, aiPeople: 1, joined: 0, left: 0,
  }, { nameOf: () => 'solo' });
  assert.ok(singular.includes('1 message from 1 person'), 'singular message/person');
  assert.ok(singular.includes('1 ai exchange across 1 thread from 1 person'), 'singular ai nouns');
  assert.ok(singular.includes('1 input blocked'), 'singular input');

  // ---- sending ----
  bumpDailyMessage(G, 'u1', AT);
  bumpDailyMessage(G, 'u1', AT);
  bumpDailyMessage(G, 'u2', AT);
  bumpDailyModerationBlock(G, AT);
  logGuildEvent({ guildId: G, guildName: 'Busy', event: 'joined', reason: 'allowlisted', memberCount: 37, occurredAt: AT });
  db.prepare(
    "INSERT INTO conversation_threads (thread_id, user_id, guild_id, channel_id, thread_type, started_at, last_active_at) VALUES ('t1','u1',?,'c1','ai',?,?)"
  ).run(G, AT, AT);
  db.prepare("INSERT INTO conversation_messages (thread_id, user_id, guild_id, channel_id, role, content, created_at) VALUES ('t1','u1',?,'c1','user','hi',?)").run(G, AT);

  const client = fakeClient([guild(G, 'Busy', 37), guild(G2, 'Empty', 4)]);
  const log = silent();
  const result = await sendDailySummaries(client, { day: DAY, operatorId: 'op', log });
  assert.deepStrictEqual(result, { sent: 2, skipped: 0 }, 'one dm per guild');
  assert.strictEqual(client.sent.length, 2, 'two dms sent');
  assert.ok(client.sent[0].content.includes('Busy — ' + DAY));
  assert.ok(client.sent[0].content.includes('3 messages from 2 people'), 'counts reached the dm');
  assert.ok(client.sent[0].content.includes('u1 (2), u2 (1)'), 'speakers reached the dm');
  assert.ok(client.sent[0].content.includes('1 input') && client.sent[0].content.includes('blocked'), 'moderation reached the dm');
  assert.ok(client.sent[0].content.includes('1 ai exchange'), 'ai use reached the dm');
  assert.ok(client.sent[1].content.includes('nothing happened'), 'quiet guild reported as quiet');

  // No operator configured: nothing sent, nothing thrown.
  const idle = fakeClient([guild(G, 'Busy', 37)]);
  const idleLog = silent();
  const idleResult = await sendDailySummaries(idle, { day: DAY, operatorId: '', log: idleLog });
  assert.deepStrictEqual(idleResult, { sent: 0, skipped: 1 });
  assert.strictEqual(idle.sent.length, 0);
  assert.ok(idleLog.lines.some((l) => l.includes(OPERATOR_ENV_KEY)), 'logs why it skipped');

  // Unfetchable operator: no crash.
  const closed = fakeClient([guild(G, 'Busy', 37)]);
  const closedLog = silent();
  const closedResult = await sendDailySummaries(closed, { day: DAY, operatorId: 'closed-dms', log: closedLog });
  assert.deepStrictEqual(closedResult, { sent: 0, skipped: 1 });
  assert.ok(closedLog.lines.some((l) => l.includes('cannot fetch operator')));

  // ---- scheduling ----
  const none = startDailySummary(fakeClient([]), { operatorId: '', log: silent() });
  assert.deepStrictEqual(none, { scheduled: false }, 'disabled without an operator id');

  const started = startDailySummary(fakeClient([]), { operatorId: 'op', hour: 9, log: silent() });
  assert.deepStrictEqual(started, { scheduled: true, hour: 9 });

  const fallback = startDailySummary(fakeClient([]), { operatorId: 'op', hour: 99, log: silent() });
  assert.strictEqual(fallback.hour, DEFAULT_HOUR_UTC, 'out-of-range hour falls back to default');
  assert.strictEqual(HOUR_ENV_KEY, 'SKARN_SUMMARY_HOUR_UTC');
  assert.strictEqual(DEFAULT_HOUR_UTC, 9);

  console.log('Daily summary smoke passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
