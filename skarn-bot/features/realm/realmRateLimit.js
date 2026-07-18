const { getWorldState, setWorldState } = require('./realmStore');
const { REALM_RATE_LIMIT, REALM_DAILY_CALL_LIMIT } = require('./realmConfig');

// Per-user rolling window: userId → [{ timestamp }]
const userBuckets = new Map();

// ===== Per-user rate limit (30 calls / 30 min) =====

function canCall(userId) {
  const bucket = userBuckets.get(userId) || [];
  const now = Date.now();
  const cutoff = now - REALM_RATE_LIMIT.windowMs;
  const recent = bucket.filter(t => t > cutoff);
  userBuckets.set(userId, recent);
  return recent.length < REALM_RATE_LIMIT.maxCalls;
}

function recordCall(userId) {
  const bucket = userBuckets.get(userId) || [];
  bucket.push(Date.now());
  userBuckets.set(userId, bucket);
}

// ===== Per-guild daily limit (via realm_world_state) =====

function _dailyKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getGuildDailyCount(guildId) {
  const state = getWorldState('daily_ai_calls', guildId);
  if (!state || state.date !== _dailyKey()) return 0;
  return state.count || 0;
}

function incrementGuildDaily(guildId) {
  const today = _dailyKey();
  const state = getWorldState('daily_ai_calls', guildId);
  const count = (state && state.date === today) ? state.count + 1 : 1;
  setWorldState('daily_ai_calls', guildId, { date: today, count });
  return count;
}

function canGuildCall(guildId) {
  return getGuildDailyCount(guildId) < REALM_DAILY_CALL_LIMIT;
}

module.exports = {
  canCall,
  recordCall,
  getGuildDailyCount,
  incrementGuildDaily,
  canGuildCall,
};
