const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');

const COOLDOWN_MS = 15 * 1000; // 15 seconds per user per channel
const cooldowns = new Map(); // `${userId}:${channelId}` -> timestamp

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function handleMention(message, client) {
  // Only handle mentions of the bot
  if (!message.mentions.has(client.user)) return;
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

    recordCall(userId);
    cooldowns.set(key, Date.now());

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanMsg },
      ],
      max_tokens: roleTokenBudgets.consult,
      temperature: 0.8,
    });

    const reply = completion.choices[0].message.content;
    await message.reply(reply);
  } catch (error) {
    console.error('Mention reply error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await message.reply(errorMsg);
  }
}

module.exports = { handleMention };
