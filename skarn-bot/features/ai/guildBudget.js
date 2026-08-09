// ===== Per-guild AI spend budget =====
// Mirrors Realm's daily-cap pattern (realmRateLimit.js) on the generic
// app_state store. Interactive chat calls (mention/consult/musing/interjection)
// are counted per guild per UTC day; support calls are not budgeted.
const { db } = require('../../db/database');

const GUILD_AI_DAILY_LIMIT = parseInt(process.env.GUILD_AI_DAILY_LIMIT, 10) || 2000;

// Interactive chat buckets only. NOTE: 'command' is deliberately NOT listed —
// it is the default bucket for support call sites (vein, search, advice,
// analyzer, postProcessor) that omit `bucket`, so budgeting it would silently
// count support calls. Musing/interjection pass explicit buckets (Task 3).
const BUDGETED_BUCKETS = ['chat', 'musing', 'interjection'];

function _dailyKey() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

function _read(guildId) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('guild_ai_daily:' + guildId);
  if (!row || !row.value) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

function _write(guildId, state) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
    .run('guild_ai_daily:' + guildId, JSON.stringify(state), Date.now());
}

// Atomic synchronous reserve — mirrors Realm tryReserve strictness (reservation
// is consumed once the API call starts). Returns true (allow) or false (budget
// exhausted). Fail-open on storage error: never block AI on a counter hiccup.
// §9.1 note: this is a read-modify-write on app_state, but it is atomic by
// construction — synchronous (no await), better-sqlite3 single-threaded, single
// bot instance (CONTEXT.md §8). Revisit if multi-instance ever returns.
function tryReserveGuildCall(guildId) {
  try {
    const today = _dailyKey();
    const state = _read(guildId);
    const count = (state && state.date === today) ? (Number(state.count) || 0) : 0;
    if (count >= GUILD_AI_DAILY_LIMIT) return false;
    _write(guildId, { date: today, count: count + 1 });
    return true;
  } catch (e) {
    console.error('[GuildBudget] reserve failed — failing open:', e.message);
    return true;
  }
}

function getGuildUsage(guildId) {
  try {
    const today = _dailyKey();
    const state = _read(guildId);
    const current = (state && state.date === today) ? (state.count || 0) : 0;
    return { current: current, max: GUILD_AI_DAILY_LIMIT };
  } catch (e) {
    return { current: 0, max: GUILD_AI_DAILY_LIMIT };
  }
}

module.exports = { tryReserveGuildCall, getGuildUsage, GUILD_AI_DAILY_LIMIT, BUDGETED_BUCKETS };
