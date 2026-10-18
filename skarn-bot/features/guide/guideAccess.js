const { getGuildConfig } = require('../../db/database');
const { canInteract } = require('../proactive/absenceDetector');
const { checkAiPermission } = require('../friendTiers/friendPermission');

function checkGuideAccess(context) {
  const userId = context && context.userId;
  const guildId = context && context.guildId;
  const channelId = context && context.channelId;
  if (!userId || !guildId || !channelId) return { allowed: false, reason: 'guild_required' };

  let channels;
  try { channels = getGuildConfig(guildId, 'aiChannels') || []; }
  catch (error) { return { allowed: false, reason: 'unavailable' }; }
  if (!Array.isArray(channels) || !channels.includes(channelId)) {
    return { allowed: false, reason: 'channel_disabled' };
  }

  try {
    if (!canInteract(userId, guildId)) return { allowed: false, reason: 'opt_in_required' };
    const permission = checkAiPermission(userId, guildId, 'mention');
    if (!permission.allowed) return { allowed: false, reason: permission.reason || 'not_allowed', message: permission.safeMessage };
  } catch (error) {
    return { allowed: false, reason: 'unavailable' };
  }
  return { allowed: true, reason: null };
}

function denialMessage(result, isPrivate) {
  if (result.reason === 'opt_in_required') return 'Opt in first with `skarn opt in` before using this guide.';
  if (result.reason === 'channel_disabled') return 'AI chat must be enabled in this channel to use the guide.';
  if (result.reason === 'guild_required') return 'Use the guide in a server channel where AI chat is enabled.';
  if (isPrivate && result.message) return result.message;
  return 'The guide is unavailable here.';
}

module.exports = { checkGuideAccess, denialMessage };
