const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');
const { collectContext } = require('../promptContext');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { simulateTyping } = require('../discordNative/typingSim');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
const { getRelationship } = require('../../db/database');
const { flagForApology } = require('../etiquette/etiquetteEngine');
const { extractMemory } = require('../memory/memoryExtractor');
const { storeMessage } = require('../conversation/messageStore');
const { assembleContext } = require('../conversation/contextAssembler');

const COOLDOWN_MS = 1 * 1000; // 1 second per user per channel
const cooldowns = new Map(); // `${userId}:${channelId}` -> timestamp

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function handleMention(message, client) {
  if (message.author.bot) return;

  const userId = message.author.id;
  const channelId = message.channel.id;
  const key = `${userId}:${channelId}`;

  // Cooldown check
  const lastReply = cooldowns.get(key) || 0;
  if (Date.now() - lastReply < COOLDOWN_MS) return; // Silently ignore

  // Rate limit check
  if (!canCall(userId)) {
    await message.reply('Even a Warmaster paces himself. Give it a moment.');
    return;
  }

  // Clean message content (remove bot mention)
  const cleanMsg = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!cleanMsg) return;

  // Store user message and assemble conversation context
  storeMessage(userId, message.guild.id, channelId, 'user', cleanMsg, { threadType: 'channel' });
  const conversationContext = assembleContext(userId, message.guild.id, channelId);

  const rel = getRelationship(userId, message.guild.id);
  const interactionCount = rel ? rel.interaction_count : 0;

  try {
    const ctx = collectContext(userId, message.guild.id, channelId, {
      roleNature: 'casual',
      userContent: cleanMsg,
      interactionCount,
    });
    const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

    const contextualMessage = conversationContext
      ? `Conversation context:\n${conversationContext}\n\nCurrent message: ${cleanMsg}`
      : cleanMsg;

    recordCall(userId);
    extendBanterChain(userId, message.guild.id, channelId);
    cooldowns.set(key, Date.now());

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_completion_tokens: getDeadpanBudget(roleTokenBudgets.consult, userId, channelId),
      temperature: 0.85,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.consult);

    // Store assistant response
    storeMessage(userId, message.guild.id, channelId, 'assistant', reply, { threadType: 'channel' });

    const isPunchlineMsg = isPunchline(reply, channelId, userId);

    await simulateTyping(message.channel, reply.length);

    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }

    const chunks = splitMessage(reply, 400);
    await message.reply(chunks[0]);
    const tail = await maybeBurst(chunks.slice(1), message.channel);
    for (const chunk of tail) {
      await message.channel.send(chunk);
    }

    // Auto-extract memory from conversation (non-blocking)
    extractMemory(userId, message.guild.id, cleanMsg, reply, channelId).catch(() => {});
  } catch (error) {
    flagForApology(userId);
    console.error('Mention reply error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await message.reply(errorMsg);
  }
}

module.exports = { handleMention };
