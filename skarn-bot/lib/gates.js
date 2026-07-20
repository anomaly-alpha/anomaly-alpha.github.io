const { checkUserRateLimit, getUserPreferences } = require('../db/database');

function ensureAiConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI is not configured. Add OPENAI_API_KEY to the environment.');
  }
}

function checkCanCall(userId) {
  const { getRateLimitMessage } = require('../lib/rateLimit');
  const msg = getRateLimitMessage(userId);
  try {
    const { canCall } = require('../lib/rateLimit');
    if (!canCall(userId)) throw new Error(msg);
  } catch (e) {
    throw new Error(msg);
  }
}

function checkHostile(userId, guildId) {
  const { isSilenced } = require('../features/safety/hostileDetector');
  if (isSilenced(userId, guildId)) {
    throw new Error('You are temporarily silenced due to hostile behavior.');
  }
}

function checkGuildOnly(message) {
  if (!message.guild) {
    throw new Error('This command can only be used in a server.');
  }
}

function checkPermissions(member, permissions) {
  if (!member || !member.permissions) return;
  const missing = permissions.filter(p => !member.permissions.has(p));
  if (missing.length > 0) {
    throw new Error('You need the ' + missing.join(', ') + ' permission(s) to use this command.');
  }
}

function checkOptIn(userId, guildId) {
  const prefs = getUserPreferences(userId, guildId || '');
  return prefs && prefs.proactive_opt_in === 1;
}

module.exports = { ensureAiConfigured, checkCanCall, checkHostile, checkGuildOnly, checkPermissions, checkOptIn };
