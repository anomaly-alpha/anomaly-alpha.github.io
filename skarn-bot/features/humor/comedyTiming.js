const banterChains = new Map(); // "userId:channelId" -> { count, lastAt }
const setups = new Map();       // "channelId:userId" -> { text, at }

function isPunchline(text, channelId, userId) {
  if (!text || text.length >= 100) return false;
  if (text.includes('?')) return false;

  const key = `${channelId}:${userId}`;
  const setup = setups.get(key);
  if (!setup) return false;
  if (Date.now() - setup.at > 30 * 1000) {
    setups.delete(key);
    return false;
  }
  // Parent was a setup-like message
  setups.delete(key);
  return true;
}

function getDeadpanBudget(baseBudget, userId, channelId) {
  const key = `${userId}:${channelId}`;
  const chain = banterChains.get(key);
  if (!chain) return baseBudget;
  if (Date.now() - chain.lastAt > 10 * 60 * 1000) {
    banterChains.delete(key);
    return baseBudget;
  }
  // Only reduce at chain 3+ (spec [S5] 3b)
  if (chain.count < 3) return baseBudget;
  const multiplier = Math.max(0.25, 1 - chain.count * 0.15);
  return Math.round(baseBudget * multiplier);
}

function extendBanterChain(userId, channelId) {
  const key = `${userId}:${channelId}`;
  const chain = banterChains.get(key);
  if (chain) {
    chain.count++;
    chain.lastAt = Date.now();
  } else {
    banterChains.set(key, { count: 1, lastAt: Date.now() });
  }
}

function recordSetup(channelId, userId, content) {
  if (content.endsWith('?') && (content.toLowerCase().includes('what') ||
      content.toLowerCase().includes('imagine') ||
      content.toLowerCase().includes('guess what'))) {
    setups.set(`${channelId}:${userId}`, { text: content, at: Date.now() });
  }
}

function cleanChains() {
  const now = Date.now();
  for (const [key, chain] of banterChains) {
    if (now - chain.lastAt > 10 * 60 * 1000) banterChains.delete(key);
  }
  for (const [key, setup] of setups) {
    if (now - setup.at > 60 * 1000) setups.delete(key);
  }
}

module.exports = { isPunchline, getDeadpanBudget, extendBanterChain, recordSetup, cleanChains };
