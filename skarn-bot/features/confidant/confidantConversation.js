const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { moderatedChatCompletion } = require('../../ai/client');
const { splitMessage } = require('../discordNative/postProcess');
const { getEffectiveTier, getFamiliarityLine, TIERS } = require('../friendTiers/friendTierEngine');
const { recordFriendActivity } = require('../friendTiers/friendActivity');
const { runWithFriendContext, checkAiPermission } = require('../friendTiers/friendPermission');
const {
  getThread,
  appendExchange,
  getRecentMessages,
  setLastGroundingAt,
} = require('./confidantStore');
const { buildHistoryContext, compressHistory } = require('./confidantMemory');
const { reserve } = require('./confidantRateLimit');
const { hasDistressSignal, needsGrounding, getCrisisReply, getGroundingLine } = require('./confidantSafety');

const processing = new Set();
const pending = new Map();
const crisisResponseAt = new Map();
const generations = new Map();
const requestControllers = new Map();
const CRISIS_RESPONSE_INTERVAL_MS = 60 * 1000;
const MAX_QUEUED_MESSAGES = 4;
const MAX_QUEUE_ITEM_CHARS = 2000;
const MAX_QUEUED_CHARS = 4000;

async function sendText(channel, text) {
  const chunks = splitMessage(String(text || '').slice(0, 6000), 1900);
  for (const chunk of chunks) await channel.send({ content: chunk, allowedMentions: { parse: [] } });
}

function invalidateConfidantUser(userId) {
  generations.set(userId, (generations.get(userId) || 0) + 1);
  const controller = requestControllers.get(userId);
  if (controller) controller.abort();
  requestControllers.delete(userId);
  if (!processing.has(userId) && !pending.has(userId)) generations.delete(userId);
}

function isCurrentTurn(userId, thread, generation) {
  if ((generations.get(userId) || 0) !== generation) return false;
  const current = getThread(userId);
  return !!current && current.status === 'active' && current.thread_id === thread.thread_id;
}

async function handleOneMessage(message, userText, thread, generation) {
  const userId = message.author.id;
  const guildId = thread.origin_guild_id;
  if (!isCurrentTurn(userId, thread, generation)) return;
  if (hasDistressSignal(userText)) {
    const lastCrisisReply = crisisResponseAt.get(userId) || 0;
    if (Date.now() - lastCrisisReply < CRISIS_RESPONSE_INTERVAL_MS) return;
    if (!isCurrentTurn(userId, thread, generation)) return;
    crisisResponseAt.set(userId, Date.now());
    if (crisisResponseAt.size > 1000) {
      const cutoff = Date.now() - CRISIS_RESPONSE_INTERVAL_MS;
      for (const [id, at] of crisisResponseAt) if (at < cutoff) crisisResponseAt.delete(id);
      while (crisisResponseAt.size > 1000) crisisResponseAt.delete(crisisResponseAt.keys().next().value);
    }
    const crisisReply = getCrisisReply();
    await sendText(message.channel, crisisReply);
    setLastGroundingAt(userId, Date.now());
    try { recordFriendActivity(userId, guildId); }
    catch (error) { console.error('[FriendTiers] Could not record Confidant crisis response:', error.message); }
    return;
  }

  const permission = checkAiPermission(userId, guildId, 'confidant');
  if (!permission.allowed) {
    if (!isCurrentTurn(userId, thread, generation)) return;
    await sendText(message.channel, permission.safeMessage);
    return;
  }

  const tier = getEffectiveTier(userId, guildId);
  const limits = reserve(userId, TIERS[tier].multiplier);
  if (!limits.allowed) {
    const reply = limits.reason === 'global'
      ? 'More than I can hold today. Try again tomorrow.'
      : "Let's pick this back up tomorrow — I don't want to rush this.";
    if (!isCurrentTurn(userId, thread, generation)) return;
    await sendText(message.channel, reply);
    try { recordFriendActivity(userId, guildId); }
    catch (error) { console.error('[FriendTiers] Could not record Confidant limit response:', error.message); }
    return;
  }

  const freshThread = getThread(userId);
  const previous = getRecentMessages(userId, 20);
  const historyContext = buildHistoryContext(freshThread, previous);
  const shouldGround = needsGrounding(userText) || Date.now() - (freshThread.last_grounding_at || freshThread.started_at) >= 30 * 86400000;
  const systemPrompt = buildSystemPrompt({
    roleLine: roles.confidant,
    memoryLine: historyContext,
    familiarityLine: getFamiliarityLine(tier),
    guidanceLine: shouldGround ? getGroundingLine() : '',
  });

  const controller = new AbortController();
  requestControllers.set(userId, controller);
  let result;
  try {
    result = await runWithFriendContext({ userId, guildId, surface: 'confidant' }, () => moderatedChatCompletion({
      userId,
      guildId,
      surface: 'confidant',
      bucket: 'confidant',
      model: process.env.AI_MODEL || 'gpt-6-luna',
      max_tokens: roleTokenBudgets.confidant,
      temperature: 0.75,
      signal: controller.signal,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }));
  } finally {
    if (requestControllers.get(userId) === controller) requestControllers.delete(userId);
  }

  const reply = result.success
    ? result.completion.choices[0]?.message?.content || "Something's not reaching me right now. Try again in a bit."
    : result.safeMessage || "Something's not reaching me right now. Try again in a bit.";
  if (!isCurrentTurn(userId, thread, generation)) return;
  await sendText(message.channel, reply);
  const saved = appendExchange(userId, userText, reply, Date.now(), thread);
  if (!saved) return;
  try { recordFriendActivity(userId, guildId); }
  catch (error) { console.error('[FriendTiers] Could not record Confidant reply:', error.message); }
  if (shouldGround) setLastGroundingAt(userId, Date.now());

  const updatedThread = getThread(userId);
  if (updatedThread && isCurrentTurn(userId, thread, generation) && updatedThread.message_count > 20 && updatedThread.message_count % 20 === 0) {
    const compressionController = new AbortController();
    requestControllers.set(userId, compressionController);
    try { await compressHistory(userId, guildId, updatedThread, compressionController.signal); }
    catch (error) { console.error('[Confidant] Compression failed; history retained:', error.message); }
    finally { if (requestControllers.get(userId) === compressionController) requestControllers.delete(userId); }
  }
}

async function handleConfidantMessage(message) {
  if (!message || message.author?.bot || message.guild) return false;
  const userId = message.author.id;
  const thread = getThread(userId);
  if (!thread || thread.status !== 'active') return false;

  let queue = pending.get(userId);
  if (!queue) {
    queue = [];
    pending.set(userId, queue);
  }
  const content = (message.content || '').trim();
  if (!content) return true;
  const generation = generations.get(userId) || 0;
  if (queue.length < MAX_QUEUED_MESSAGES) queue.push({ message, content: content.slice(0, MAX_QUEUE_ITEM_CHARS), generation });
  else queue[queue.length - 1].content = (queue[queue.length - 1].content + String.fromCharCode(10) + content).slice(0, MAX_QUEUED_CHARS);
  if (processing.has(userId)) return true;

  processing.add(userId);
  try {
    while (queue.length) {
      const currentGeneration = generations.get(userId) || 0;
      const batch = queue.splice(0, queue.length).filter(item => item.generation === currentGeneration);
      if (!batch.length) continue;
      const combined = batch.map(item => item.content).join(String.fromCharCode(10)).slice(0, MAX_QUEUED_CHARS);
      const lastMessage = batch[batch.length - 1].message;
      const currentThread = getThread(userId);
      if (!currentThread || currentThread.status !== 'active') break;
      try { await handleOneMessage(lastMessage, combined, currentThread, currentGeneration); }
      catch (error) {
        console.error('[Confidant] Conversation turn failed:', error.message);
        try { await sendText(lastMessage.channel, "Something's not reaching me right now. Try again in a bit."); }
        catch (sendError) { console.error('[Confidant] Could not send fallback reply:', sendError.message); }
      }
    }
  } finally {
    processing.delete(userId);
    if (pending.get(userId) === queue) pending.delete(userId);
    if (!requestControllers.has(userId)) generations.delete(userId);
  }
  return true;
}

module.exports = { handleConfidantMessage, handleOneMessage, sendText, invalidateConfidantUser };
