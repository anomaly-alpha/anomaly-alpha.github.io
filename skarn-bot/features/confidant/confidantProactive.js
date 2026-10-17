const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { moderatedChatCompletion } = require('../../ai/client');
const { getEffectiveTier, getFamiliarityLine, TIERS } = require('../friendTiers/friendTierEngine');
const { runWithFriendContext, checkAiPermission } = require('../friendTiers/friendPermission');
const { invalidateConfidantUser } = require('./confidantConversation');
const { getThread, getActiveThreads, getRecentMessages, setLastProactiveAt, setStatus } = require('./confidantStore');
const { buildHistoryContext } = require('./confidantMemory');
const { reserve, getGlobalUsage } = require('./confidantRateLimit');
const { sendText } = require('./confidantConversation');

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_IDLE_MS = 3 * DAY_MS;
const PROACTIVE_COOLDOWN_MS = 5 * DAY_MS;

function isDmBlocked(error) {
  return error && (error.code === 50007 || error.rawError?.code === 50007);
}

async function runConfidantProactive(client, now = Date.now()) {
  const usage = getGlobalUsage(now);
  if (usage.current >= usage.max) return { sent: 0, skipped: true };
  const threads = getActiveThreads();
  let sent = 0;
  for (const thread of threads) {
    if (now - thread.last_interaction_at < MIN_IDLE_MS) continue;
    if (thread.last_proactive_at && now - thread.last_proactive_at < PROACTIVE_COOLDOWN_MS) continue;
    const permission = checkAiPermission(thread.user_id, thread.origin_guild_id, 'confidant');
    if (!permission.allowed) continue;
    const tier = getEffectiveTier(thread.user_id, thread.origin_guild_id);
    const limits = reserve(thread.user_id, TIERS[tier].multiplier, now);
    if (!limits.allowed) {
      if (limits.reason === 'global') return { sent, skipped: true };
      continue;
    }

    try {
      const history = buildHistoryContext(thread, getRecentMessages(thread.user_id, 20));
      const system = buildSystemPrompt({
        roleLine: roles.confidant,
        memoryLine: history,
        familiarityLine: getFamiliarityLine(tier),
        additionalContext: 'Reach out first because several days have passed. Keep it light and low-pressure — a genuine thought, an observation, or a question. Never imply anything is wrong, that they owe you a reply, or that you miss them.',
      });
      const result = await runWithFriendContext({ userId: thread.user_id, guildId: thread.origin_guild_id, surface: 'confidant' }, () => moderatedChatCompletion({
        userId: thread.user_id,
        guildId: thread.origin_guild_id,
        surface: 'confidant',
        bucket: 'confidant',
        model: process.env.AI_MODEL || 'gpt-6-luna',
        max_tokens: roleTokenBudgets.confidant,
        temperature: 0.75,
        messages: [{ role: 'system', content: system }, { role: 'user', content: 'Write one brief, low-pressure message to reopen the conversation.' }],
      }));
      if (!result.success) continue;
      const text = result.completion.choices[0]?.message?.content;
      if (!text) continue;
      const current = getThread(thread.user_id);
      if (!current || current.status !== 'active' || current.thread_id !== thread.thread_id) continue;
      if (now - current.last_interaction_at < MIN_IDLE_MS) continue;
      if (!checkAiPermission(current.user_id, current.origin_guild_id, 'confidant').allowed) continue;
      const user = await client.users.fetch(thread.user_id);
      const dm = await user.createDM();
      await sendText(dm, text);
      setLastProactiveAt(thread.user_id, now);
      sent++;
    } catch (error) {
      if (isDmBlocked(error)) {
        invalidateConfidantUser(thread.user_id);
        setStatus(thread.user_id, 'paused');
      }
      console.error('[Confidant] Proactive send failed for thread:', error.message);
    }
  }
  return { sent, skipped: false };
}

function startConfidantProactive(client) {
  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(18, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    setTimeout(() => {
      runConfidantProactive(client).catch(error => console.error('[Confidant] Proactive job failed:', error.message));
      scheduleNext();
    }, next.getTime() - now.getTime());
  }
  scheduleNext();
}

module.exports = { runConfidantProactive, startConfidantProactive, MIN_IDLE_MS, PROACTIVE_COOLDOWN_MS };
