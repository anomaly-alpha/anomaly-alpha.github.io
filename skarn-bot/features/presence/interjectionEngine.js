const { getRelationship, checkInterjectionCooldown, setInterjectionCooldown } = require('../../db/database');
const { canCall, recordCall } = require('../../lib/rateLimit');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const getOpenAIClient = require('../../ai/client');
const { collectContext } = require('../promptContext');

const FALLBACK_REPLIES = ['bruh moment 😔', 'based', 'i saw that 👀', 'interesting...', 'noted 📝', 'wait what', 'i am confusion', 'fr'];

function isBanterMessage(content) {
  const lower = content.toLowerCase();
  const words = ['lmao', 'lmfao', 'lol', 'rofl', 'haha', 'hehe', 'bruh', 'fr', 'ngl', 'based', 'cringe'];
  return words.some(w => lower.includes(w));
}

async function maybeInterject(message, client) {
  if (message.author.bot) return;

  // Respect opt-in
  const { canInteract } = require('../proactive/absenceDetector');
  if (!canInteract(message.author.id, message.guild?.id)) return;

  const channelId = message.channel.id;
  if (checkInterjectionCooldown(channelId)) return;

  const rel = getRelationship(message.author.id, message.guild.id);
  const tags = JSON.parse(rel.tags || '[]');

  let chance = 0.005;
  if (tags.includes('regular') && isBanterMessage(message.content)) chance = 0.10;
  else if (tags.includes('veteran') && message.content.includes('?')) chance = 0.08;
  else if (tags.length === 0 && Math.random() > 0.005) return;

  if (Math.random() > chance) return;

  if (!canCall(message.author.id)) {
    await message.reply(FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]);
    return;
  }

  setInterjectionCooldown(channelId);

  try {
    const ctx = collectContext(message.author.id, message.guild.id, message.channel.id);
    const systemPrompt = buildSystemPrompt({
      roleLine: 'You are reacting to a message in passing. One short line, in character. No emoji overload. Just a quick reaction. Be natural — like a server member glancing up and saying something.',
      ...ctx,
    });

    recordCall(message.author.id);
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.content },
      ],
      max_completion_tokens: 100,
      temperature: 0.85,
    });

    const reply = completion.choices[0].message.content;
    if (reply) await message.reply(reply);
  } catch {
    await message.reply(FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]);
  }
}

module.exports = { maybeInterject };
