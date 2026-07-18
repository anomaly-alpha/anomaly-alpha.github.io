// In-memory token bucket per user. 10 calls per rolling 10-minute window.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = 10;
const calls = new Map(); // userId -> timestamp[]

function canCall(userId) {
  const now = Date.now();
  const userCalls = calls.get(userId) || [];
  // Prune old entries
  const recent = userCalls.filter(t => now - t < WINDOW_MS);
  if (recent.length === 0) {
    calls.delete(userId); // Avoid leaving empty arrays forever in the map
  } else {
    calls.set(userId, recent);
  }
  return recent.length < MAX_CALLS;
}

function recordCall(userId) {
  const now = Date.now();
  const userCalls = calls.get(userId) || [];
  userCalls.push(now);
  calls.set(userId, userCalls);
}

module.exports = { canCall, recordCall };
