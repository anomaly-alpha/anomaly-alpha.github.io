const { moderatedChatCompletion } = require('../../ai/client');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getEffectiveTier, TIERS } = require('../friendTiers/friendTierEngine');
const { reserve } = require('./confidantRateLimit');
const { getOldestMessages, getRecentMessages, getStoredMessageCount, updateSummary } = require('./confidantStore');

function buildHistoryContext(thread, recentMessages) {
  const newline = String.fromCharCode(10);
  const parts = [];
  if (thread.running_summary) parts.push('Earlier conversation summary:' + newline + thread.running_summary);
  if (recentMessages.length) parts.push('Recent conversation:' + newline + recentMessages.map(m => (m.role === 'user' ? 'User' : 'Skarn') + ': ' + m.content).join(newline));
  return parts.join(newline + newline);
}

async function compressHistory(userId, guildId, thread, signal) {
  if (!thread || thread.message_count <= 20 || thread.message_count % 20 !== 0) return false;
  const newline = String.fromCharCode(10);
  let summary = thread.running_summary || '';
  let compressed = false;
  while (getStoredMessageCount(userId) > 20) {
    const oldMessages = getOldestMessages(userId, 20);
    if (oldMessages.length < 20) break;
    const tier = getEffectiveTier(userId, guildId);
    const limit = reserve(userId, TIERS[tier].multiplier);
    if (!limit.allowed) return compressed;
    const transcript = oldMessages.map(m => (m.role === 'user' ? 'User' : 'Skarn') + ': ' + m.content).join(newline);
    const result = await moderatedChatCompletion({
      userId,
      guildId,
      surface: 'confidant',
      bucket: 'confidant',
      model: process.env.AI_MODEL || 'gpt-6-luna',
      max_tokens: roleTokenBudgets.confidant_summarize,
      temperature: 0.3,
      signal: signal,
      messages: [
        { role: 'system', content: roles.confidant_summarize },
        { role: 'user', content: 'Existing summary:' + newline + (summary || '(none)') + newline + newline + 'Earlier exchanges to fold in:' + newline + transcript + newline + newline + 'Return only the replacement summary.' },
      ],
    });
    if (!result.success) return compressed;
    const nextSummary = result.completion.choices[0]?.message?.content?.trim();
    if (!nextSummary) return compressed;
    const saved = updateSummary(userId, nextSummary, oldMessages[oldMessages.length - 1].id, thread);
    if (!saved) return compressed;
    summary = nextSummary;
    compressed = true;
  }
  return compressed;
}

module.exports = { buildHistoryContext, compressHistory, getRecentMessages };
