const { AsyncLocalStorage } = require('async_hooks');
const { getFlags } = require('./friendTierStore');
const { getTierMultiplier } = require('./friendTierEngine');

const context = new AsyncLocalStorage();
const ALLOWED_LIMITED_SURFACES = ['consult', 'confidant'];
const SUPPORT_SURFACES = new Set(['analysis', 'memory-extraction', 'tone-analysis', 'topic-extraction', 'summarizer']);
const AI_COMMANDS = new Set([
  '8ball', 'advice', 'adventure', 'aitrivia', 'charades', 'code', 'compare', 'compliment',
  'daily', 'debate', 'fortune', 'homework', 'improv', 'insult', 'joke', 'lore', 'meme',
  'news', 'pickup', 'recipe', 'roast', 'search', 'song', 'story', 'translate', 'trivia',
  'unpopularopinion', 'vein', 'vibe', 'weather', 'wouldyourather', 'consult', 'musing',
]);

function runWithFriendContext(values, callback) {
  return context.run(values || {}, callback);
}

function getFriendContext() {
  return context.getStore() || null;
}

function isAiCommand(commandName) {
  return AI_COMMANDS.has(commandName);
}

function checkAiPermission(userId, guildId, surface) {
  const current = getFriendContext() || {};
  const resolvedUserId = userId || current.userId;
  const resolvedGuildId = guildId || current.guildId;
  const requestedSurface = surface || current.surface || 'other';
  const resolvedSurface = SUPPORT_SURFACES.has(requestedSurface) && current.surface ? current.surface : requestedSurface;
  if (!resolvedUserId) return { allowed: true, reason: null, guildId: resolvedGuildId, surface: resolvedSurface };
  if (!resolvedGuildId || resolvedGuildId === 'dm') {
    const looksLikeDiscordUserId = typeof resolvedUserId === 'string' && resolvedUserId.length >= 17 && resolvedUserId.length <= 20 && /^[0-9]+$/.test(resolvedUserId);
    if (current.userId || looksLikeDiscordUserId) return { allowed: false, reason: 'no_guild', safeMessage: 'AI features are available in a server. Use Confidant Mode for private DM conversations.', guildId: null, surface: resolvedSurface };
    return { allowed: true, reason: null, guildId: null, surface: resolvedSurface };
  }
  const flags = getFlags(resolvedUserId, resolvedGuildId);
  if (!flags) return { allowed: true, reason: null, guildId: resolvedGuildId, surface: resolvedSurface };
  if (flags.ai_blocked) return { allowed: false, reason: 'blocked', safeMessage: "I'm not able to respond to you here.", guildId: resolvedGuildId, surface: resolvedSurface };
  if (flags.ai_limited && !ALLOWED_LIMITED_SURFACES.includes(resolvedSurface)) return { allowed: false, reason: 'limited', safeMessage: "That's not available to you right now.", guildId: resolvedGuildId, surface: resolvedSurface };
  return { allowed: true, reason: null, guildId: resolvedGuildId, surface: resolvedSurface };
}

function getRateMultiplier(userId, guildId) {
  const current = getFriendContext() || {};
  const resolvedUserId = userId || current.userId;
  const resolvedGuildId = guildId || current.guildId;
  if (!resolvedUserId || !resolvedGuildId) return 1;
  try { return getTierMultiplier(resolvedUserId, resolvedGuildId); }
  catch (error) { console.error('[FriendTiers] Rate multiplier lookup failed:', error.message); return 1; }
}

module.exports = { runWithFriendContext, getFriendContext, checkAiPermission, getRateMultiplier, isAiCommand, ALLOWED_LIMITED_SURFACES };
