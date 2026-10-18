const db = require('../../db/database');
const { makeForcedReplyDecision } = require('./attentionDecision');
const { buildChannelSnapshot } = require('../conversation/channelTranscript');
const { checkAiPermission } = require('../friendTiers/friendPermission');

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
  // Automatic channel replies are only for the opted-in user who triggered this turn.
  return isEligibleTarget(triggerUserId, guildId, ignoredUserIds) ? [triggerUserId] : [];
}

function makeCurrentTurnSnapshot(message, currentTurnMessages) {
  const messages = currentTurnMessages.length > 0 ? currentTurnMessages : [{
    message_id: message.id,
    author_id: message.author.id,
    author_name: message.member && message.member.displayName || message.author.globalName || message.author.username,
    content: message.content,
    created_at: message.createdTimestamp || Date.now(),
    reference_message_id: message.reference && message.reference.messageId || null,
    is_skarn: false,
  }];
  return {
    channel_summaries: [],
    messages: messages.map(function(item) {
      return {
        message_id: item.message_id,
        author_id: item.author_id,
        author_name: item.author_name,
        content: item.content,
        created_at: item.created_at,
        reference_message_id: item.reference_message_id || null,
        is_skarn: false,
      };
    }),
  };
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
  const currentTurnMessages = (options.currentTurnMessages || []).filter(Boolean);
  try {
    if (options.snapshot) {
      snapshot = options.snapshot;
      sourceMessageIds = options.sourceMessageIds || [];
    } else {
      const built = await buildChannelSnapshot(guildId, channelId, userId, {
        preserveMessageIds: currentTurnMessages.map(function(item) { return item.message_id; }).filter(Boolean),
      });
      snapshot = built.snapshot;
      sourceMessageIds = built.sourceMessageIds || [];
    }
  } catch (error) {
    recordMetric('context_failure');
    snapshot = makeCurrentTurnSnapshot(message, currentTurnMessages);
    sourceMessageIds = snapshot.messages.map(function(item) { return item.message_id; }).filter(Boolean);
  }
  const snapshotMessageIds = new Set((snapshot.messages || []).map(function(item) { return item.message_id; }));
  const missingCurrentMessages = currentTurnMessages.filter(function(item) {
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

  // Enabled AI channels keep the conversation moving: eligibility decides whether
  // a turn may be answered; there is no model-based silence decision here.
  recordMetric('respond');
  return Object.assign({}, makeForcedReplyDecision(userId), {
    snapshot: snapshot,
    sourceMessageIds: sourceMessageIds,
  });
}

async function shouldRespond(message, client) {
  const decision = await evaluateAttention(message);
  return decision.decision === 'respond';
}

module.exports = { evaluateAttention, shouldRespond, recordMetric };
