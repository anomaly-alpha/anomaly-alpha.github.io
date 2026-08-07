const { getWorldState, setWorldState } = require('./realmStore');
const { getFlag, setFlag } = require('../../db/database');
const { REALM_RATE_LIMIT, REALM_DAILY_CALL_LIMIT } = require('./realmConfig');

// ===== Per-user rate limit (30 calls / 30 min) =====

function _bucket(userId) {
  const raw = getFlag('realm_bucket:' + userId);
  return raw ? JSON.parse(raw) : [];
}

function _userBucketCurrent(userId) {
  const now = Date.now();
  const cutoff = now - REALM_RATE_LIMIT.windowMs;
  return _bucket(userId).filter(t => t > cutoff);
}

// ===== Per-guild daily limit (via realm_world_state) =====

function _dailyKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function _guildDailyCount(guildId) {
  const state = getWorldState('daily_ai_calls', guildId);
  if (!state || state.date !== _dailyKey()) return 0;
  return state.count || 0;
}

// ===== Atomic reserve =====
// Checks BOTH ceilings and records both in one synchronous call (no await
// inside), so concurrent realm actions can never overrun the limits.
// Reservation is consumed even if the AI call after it fails — the AI call is
// about to happen, and strictness protects the documented cost budget.

function tryReserve(userId, guildId) {
  const bucket = _userBucketCurrent(userId);
  if (bucket.length >= REALM_RATE_LIMIT.maxCalls) return false;

  const today = _dailyKey();
  const guildCount = _guildDailyCount(guildId);
  if (guildCount >= REALM_DAILY_CALL_LIMIT) return false;

  bucket.push(Date.now());
  setFlag('realm_bucket:' + userId, JSON.stringify(bucket), REALM_RATE_LIMIT.windowMs);
  setWorldState('daily_ai_calls', guildId, { date: today, count: guildCount + 1 });
  return true;
}

module.exports = {
  tryReserve,
};
