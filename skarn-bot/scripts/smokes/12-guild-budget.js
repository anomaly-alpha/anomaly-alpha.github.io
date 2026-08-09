// ===== PER-GUILD AI SPEND BUDGET =====
// Guards the daily per-guild budget module (features/ai/guildBudget.js):
// reserve-at-limit, increment, UTC date rollover, and the budgeted-bucket set.
const { db } = require('../../db/database');
const { tryReserveGuildCall, getGuildUsage, GUILD_AI_DAILY_LIMIT, BUDGETED_BUCKETS } = require('../../features/ai/guildBudget');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

function dailyKey(d) {
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function seed(guildId, date, count) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
    .run('guild_ai_daily:' + guildId, JSON.stringify({ date: date, count: count }), Date.now());
}
function read(guildId) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('guild_ai_daily:' + guildId);
  return row ? JSON.parse(row.value) : null;
}

// 1. At limit-1, reserve succeeds and increments to limit
seed('g1', dailyKey(new Date()), GUILD_AI_DAILY_LIMIT - 1);
assert('reserve succeeds at limit-1', tryReserveGuildCall('g1') === true);
assert('count increments to limit', read('g1').count === GUILD_AI_DAILY_LIMIT);

// 2. At limit, reserve is refused (exhausted)
assert('reserve refused at limit', tryReserveGuildCall('g1') === false);

// 3. UTC date rollover: yesterday's state at limit resets and reserves
var yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
seed('g1', dailyKey(yesterday), GUILD_AI_DAILY_LIMIT);
assert('reserve succeeds after date rollover', tryReserveGuildCall('g1') === true);
assert('count resets to 1 on new day', read('g1').count === 1);
assert('usage reflects new day', getGuildUsage('g1').current === 1);

// 4. Budgeted set is exactly the chat buckets; support/default buckets excluded
assert('budgeted includes chat', BUDGETED_BUCKETS.indexOf('chat') !== -1);
assert('budgeted includes musing', BUDGETED_BUCKETS.indexOf('musing') !== -1);
assert('budgeted includes interjection', BUDGETED_BUCKETS.indexOf('interjection') !== -1);
assert('command NOT budgeted (support default)', BUDGETED_BUCKETS.indexOf('command') === -1);
assert('condense NOT budgeted', BUDGETED_BUCKETS.indexOf('condense') === -1);
assert('tone NOT budgeted', BUDGETED_BUCKETS.indexOf('tone') === -1);
assert('realm NOT budgeted', BUDGETED_BUCKETS.indexOf('realm') === -1);

// 5. Fail-open on storage error: a throwing db.prepare must allow the call
// (never block AI on a counter hiccup) — monkeypatch and restore.
var realPrepare = db.prepare;
db.prepare = function() { throw new Error('simulated storage failure'); };
assert('reserve fails open on storage error', tryReserveGuildCall('gFail') === true);
assert('usage fails open on storage error', getGuildUsage('gFail').current === 0 && getGuildUsage('gFail').max === GUILD_AI_DAILY_LIMIT);
db.prepare = realPrepare;
