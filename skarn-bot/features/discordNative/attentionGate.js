const { moderatedChatCompletion } = require('../../ai/client');
const db = require('../../db/database');
const { buildAttentionMessages, parseAttentionDecision } = require('./attentionDecision');
const { buildChannelSnapshot } = require('../conversation/channelTranscript');
const { checkAiPermission } = require('../friendTiers/friendPermission');

const MODEL = process.env.AI_MODEL || 'gpt-6-luna';
const METRIC_PREFIX = 'skarn_attention_daily:';

function dailyMetricKey(now) {
  const date = new Date(now);
  const day = date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  return METRIC_PREFIX + day;
}

function recordMetric(kind) {
  try {
    const key = dailyMetricKey(Date.now());
    const row = db.db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
    let counts = {};
    if (row && row.value) {
      try { counts = JSON.parse(row.value) || {}; } catch (e) { counts = {}; }
    }
    counts[kind] = (Number(counts[kind]) || 0) + 1;
    db.db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
      .run(key, JSON.stringify(counts), Date.now());
  } catch (e) { /* telemetry must never block a reply */ }
}

function userIsOptedIn(userId, guildId) {
  try {
    const row = db.db.prepare('SELECT proactive_opt_in FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    return !!row && row.proactive_opt_in === 1;
  }
  catch (e) { return false; }
}

function isEligibleTarget(userId, guildId, ignoredUserIds) {
  if (ignoredUserIds.has(userId) || !userIsOptedIn(userId, guildId)) return false;
  try { return checkAiPermission(userId, guildId, 'ai-channel').allowed; }
  catch (e) { return false; }
}

function getEligibleUsers(snapshot, triggerUserId, guildId, ignoredUserIds) {
  // Keep personal memory bound to the opted-in user whose message triggered
  // this turn. The other allowed response mode is an unaddressed channel comment.
  return isEligibleTarget(triggerUserId, guildId, ignoredUserIds) ? [triggerUserId] : [];
}

function getOptedInParticipants(snapshot, triggerUserId, guildId, ignoredUserIds) {
  const optedIn = new Set();
  const optedInIds = new Set();
  try {
    db.db.prepare('SELECT user_id FROM user_preferences WHERE guild_id = ? AND proactive_opt_in = 1')
      .all(guildId).forEach(function(row) { optedInIds.add(row.user_id); });
  } catch (e) { /* consent labels fail closed */ }
  if (optedInIds.has(triggerUserId) && !ignoredUserIds.has(triggerUserId)) optedIn.add(triggerUserId);
  const checked = new Set([triggerUserId]);
  for (const message of snapshot.messages || []) {
    if (message.is_skarn || !message.author_id || checked.has(message.author_id)) continue;
    checked.add(message.author_id);
    if (optedInIds.has(message.author_id) && !ignoredUserIds.has(message.author_id)) optedIn.add(message.author_id);
  }
  return Array.from(optedIn);
}

async function evaluateAttention(message, options) {
  options = options || {};
  const userId = message.author.id;
  const guildId = message.guild && message.guild.id;
  const channelId = message.channel.id;
  const silent = { decision: 'stay_silent', target_user_id: null, category: 'context_only', reply_intent: '', failure: null };
  if (!guildId || !userIsOptedIn(userId, guildId) || !message.content) {
    recordMetric('ineligible');
    return silent;
  }

  let snapshot;
  let sourceMessageIds = [];
  try {
    if (options.snapshot) {
      snapshot = options.snapshot;
      sourceMessageIds = options.sourceMessageIds || [];
    } else {
      const built = await buildChannelSnapshot(guildId, channelId, userId, {
        preserveMessageIds: (options.currentTurnMessages || []).map(function(item) { return item && item.message_id; }).filter(Boolean),
      });
      snapshot = built.snapshot;
      sourceMessageIds = built.sourceMessageIds || [];
    }
  } catch (error) {
    recordMetric('context_failure');
    return Object.assign({}, silent, { failure: 'context_unavailable' });
  }
  const snapshotMessageIds = new Set((snapshot.messages || []).map(function(item) { return item.message_id; }));
  const missingCurrentMessages = (options.currentTurnMessages || []).filter(function(item) {
    return item && typeof item.message_id === 'string' && !snapshotMessageIds.has(item.message_id);
  });
  if (missingCurrentMessages.length > 0) {
    snapshot = Object.assign({}, snapshot, {
      messages: (snapshot.messages || []).concat(missingCurrentMessages).sort(function(a, b) {
        return a.created_at - b.created_at || a.message_id.localeCompare(b.message_id);
      }),
    });
  }
  if (!userIsOptedIn(userId, guildId)) {
    recordMetric('ineligible');
    return silent;
  }

  let ignoredUserIds = new Set();
  try {
    const configured = db.getGuildConfig(guildId, 'ignoredUsers') || [];
    ignoredUserIds = new Set(Array.isArray(configured) ? configured : []);
  } catch (e) { /* ignore-list lookup failure does not grant a user target */ }
  const eligibleUserIds = getEligibleUsers(snapshot, userId, guildId, ignoredUserIds);
  if (!eligibleUserIds.includes(userId)) {
    recordMetric('ineligible');
    return silent;
  }

  const metadata = {
    guild_id: guildId,
    channel_id: channelId,
    triggering_user_id: userId,
    triggering_user_is_opted_in: true,
    eligible_user_ids: eligibleUserIds,
    opted_in_user_ids: getOptedInParticipants(snapshot, userId, guildId, ignoredUserIds),
    ignored_user_ids: Array.from(ignoredUserIds),
    mode: 'passive_channel_turn',
  };
  const messages = buildAttentionMessages(snapshot, metadata);
  let result;
  try {
    result = await moderatedChatCompletion({
      model: MODEL,
      messages: messages,
      max_tokens: 180,
      temperature: 0.1,
      userId: userId,
      guildId: guildId,
      surface: 'ai-channel',
      bucket: 'attention',
    });
  } catch (error) {
    recordMetric('model_failure');
    return Object.assign({}, silent, { failure: 'attention_unavailable' });
  }
  if (!result || !result.success) {
    recordMetric(result && result.budgetExhausted ? 'budget_failure' : 'model_failure');
    return Object.assign({}, silent, { failure: 'attention_unavailable' });
  }

  try {
    const content = result.completion.choices[0]?.message?.content;
    const decision = parseAttentionDecision(content, eligibleUserIds);
    if (decision.decision === 'stay_silent') {
      recordMetric('silent');
      return Object.assign({}, decision, { snapshot: snapshot, sourceMessageIds: sourceMessageIds });
    }
    if (decision.target_user_id && decision.target_user_id !== 'unaddressed' && !isEligibleTarget(decision.target_user_id, guildId, ignoredUserIds)) {
      recordMetric('invalid_target');
      return Object.assign({}, silent, { failure: 'invalid_target' });
    }
    recordMetric('respond');
    return Object.assign({}, decision, { snapshot: snapshot, sourceMessageIds: sourceMessageIds });
  } catch (error) {
    recordMetric('invalid_output');
    return Object.assign({}, silent, { failure: 'invalid_output' });
  }
}

async function shouldRespond(message, client) {
  const decision = await evaluateAttention(message);
  return decision.decision === 'respond';
}

module.exports = { evaluateAttention, shouldRespond, recordMetric };
