const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');
const { postProcess, splitMessage, ROLE_NATURE } = require('../discordNative/postProcess');
const { simulateTyping } = require('../discordNative/typingSim');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');

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

  try {
    const channelState = getChannelState(channelId, message.guild.id);
    const stateLine = getStateLine(channelState.current_state);

    const memory = getUserMemory(userId, message.guild.id, 5);
    const memoryLine = memory.length > 0
      ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
      : '';

    const systemPrompt = buildSystemPrompt({
      roleLine: roles.consult,
      stateLine,
      memoryLine,
    });

    const context = await getRecentContext(message.channel, 5);
    const contextualMessage = buildContextualPrompt(cleanMsg, context);

    recordCall(userId);
    cooldowns.set(key, Date.now());

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_completion_tokens: roleTokenBudgets.consult,
      temperature: 0.85,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.consult);

    await simulateTyping(message.channel, reply.length);

    const chunks = splitMessage(reply, 400);
    await message.reply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      await message.channel.send(chunks[i]);
    }
  } catch (error) {
    console.error('Mention reply error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await message.reply(errorMsg);
  }
}

module.exports = { handleMention };
