// ===== FRIEND TIERS + CONFIDANT =====
const { db } = require('../../db/database');
const { recordFriendActivity, applyDecay } = require('../../features/friendTiers/friendActivity');
const { setFlag } = require('../../features/friendTiers/friendTierStore');
const { computeTier, getEffectiveTier } = require('../../features/friendTiers/friendTierEngine');
const { checkAiPermission, runWithFriendContext } = require('../../features/friendTiers/friendPermission');
const { hasDistressSignal, needsGrounding } = require('../../features/confidant/confidantSafety');
const { createThread, getThread, appendExchange, getRecentMessages, deleteThread } = require('../../features/confidant/confidantStore');

function assert(label, condition) {
  console.log(label + ':', condition);
  if (!condition) process.exitCode = 1;
}

(async function() {
  const now = Date.now();
  for (let i = 0; i < 7; i++) recordFriendActivity('tier-user', 'guild-a', now + i);
  const capped = db.prepare('SELECT * FROM friend_tiers WHERE user_id = ? AND guild_id = ?').get('tier-user', 'guild-a');
  assert('activity cap is five points per UTC date', capped.activity_points === 5 && capped.activity_points_today === 5);
  assert('acquaintance requires both tenure and points', computeTier({ first_seen_at: now - 7 * 86400000, activity_points: 10 }, now) === 1);
  assert('tenure alone does not grant a tier', computeTier({ first_seen_at: now - 200 * 86400000, activity_points: 0 }, now) === 0);
  const decayed = applyDecay({ last_interaction_at: now - 20 * 86400000, last_decay_at: now - 4 * 86400000, activity_points: 40 }, now);
  assert('inactivity decay removes five points per full inactive day', decayed.points === 20);

  setFlag('flag-user', 'guild-a', 'ai_limited', 1, 'admin-user');
  assert('limited users retain consult access', checkAiPermission('flag-user', 'guild-a', 'consult').allowed);
  assert('limited users lose mention access', !checkAiPermission('flag-user', 'guild-a', 'mention').allowed);
  const asyncContextResult = runWithFriendContext({ userId: 'flag-user', guildId: 'guild-a', surface: 'mention' }, () => checkAiPermission().reason);
  assert('permission gate resolves AsyncLocalStorage context', asyncContextResult === 'limited');
  assert('guildless user-scoped AI fails closed', checkAiPermission('123456789012345678', null, 'command').reason === 'no_guild');
  assert('synthetic scheduled AI identity remains usable', checkAiPermission('lore-batch', null, 'scheduled').allowed);
  setFlag('flag-user', 'guild-a', 'ai_blocked', 1, 'admin-user');
  assert('blocked takes precedence over limited', checkAiPermission('flag-user', 'guild-a', 'consult').reason === 'blocked');
  assert('tier lookup uses the guild-scoped row', getEffectiveTier('tier-user', 'guild-a') === 0 && getEffectiveTier('tier-user', 'guild-b') === 0);

  createThread('confidant-user', 'guild-a', now);
  const originalThread = getThread('confidant-user');
  const savedExchange = appendExchange('confidant-user', 'I am working on a garden.', 'You will make the soil listen yet.', now + 1, originalThread);
  const thread = getThread('confidant-user');
  const history = getRecentMessages('confidant-user', 20);
  assert('valid Confidant turn persists', savedExchange === true);
  assert('Confidant is one account-wide thread with its origin guild', thread.origin_guild_id === 'guild-a' && thread.status === 'active');
  assert('Confidant exchange persists in user/Skarn order', thread.message_count === 2 && history.length === 2 && history[0].role === 'user' && history[1].role === 'skarn');
  deleteThread('confidant-user');
  assert('forget deletes the complete Confidant thread', getThread('confidant-user') === null && getRecentMessages('confidant-user').length === 0);
  createThread('confidant-user', 'guild-b', now + 2);
  const staleWrite = appendExchange('confidant-user', 'old turn', 'old reply', now + 3, originalThread);
  assert('stale in-flight turn cannot restore erased history', staleWrite === false && getRecentMessages('confidant-user').length === 0);
  deleteThread('confidant-user');

  const { moderatedChatCompletion } = require('../../ai/client');
  const blocked = await moderatedChatCompletion({ userId: 'flag-user', guildId: 'guild-a', surface: 'command', messages: [{ role: 'user', content: 'hello' }] });
  assert('central AI gate denies blocked users without an API call', blocked.success === false && blocked.permissionDenied === 'blocked');
  assert('crisis matcher recognizes direct self-harm language', hasDistressSignal('I want to die') === true);
  assert('grounding matcher recognizes minor age disclosure', needsGrounding('I am 15 years old') === true);
  assert('grounding matcher recognizes isolation disclosure', needsGrounding('You are the only one I talk to') === true);
})();
