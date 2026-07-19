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

const RATE_LIMIT_MSG = 'Even a Warmaster paces himself. Give it a moment.';

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function execute(interaction) {
  // Rate limit check
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: RATE_LIMIT_MSG, flags: 64 });
  }

  await interaction.deferReply();

  const rel = getRelationship(interaction.user.id, interaction.guild.id);
  const interactionCount = rel ? rel.interaction_count : 0;

  try {
    const message = interaction.options.getString('message');

    // Store user message
    storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'user', message, { threadType: 'consult' });

    // Assemble context with conversation history
    const conversationContext = assembleContext(interaction.user.id, interaction.guild.id, interaction.channel.id);

    const ctx = collectContext(interaction.user.id, interaction.guild.id, interaction.channel.id, {
      roleNature: 'casual',
      userContent: message,
      interactionCount,
    });
    const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

    const contextualMessage = conversationContext
      ? `Conversation context:\n${conversationContext}\n\nCurrent message: ${message}`
      : message;

    recordCall(interaction.user.id);
    extendBanterChain(interaction.user.id, interaction.guild.id, interaction.channel.id);

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_completion_tokens: getDeadpanBudget(roleTokenBudgets.consult, interaction.user.id, interaction.channel.id),
      temperature: 0.8,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.consult);

    // Store assistant response
    storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'assistant', reply, { threadType: 'consult' });

    const isPunchlineMsg = isPunchline(reply, interaction.channel.id, interaction.user.id);

    await simulateTyping(interaction.channel, reply.length);

    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }

    const chunks = splitMessage(reply, 400);
    if (chunks.length === 1) {
      await interaction.editReply(chunks[0]);
    } else {
      await interaction.editReply(chunks[0]);
      const tail = await maybeBurst(chunks.slice(1), interaction.channel);
      for (const chunk of tail) {
        await interaction.followUp(chunk);
      }
    }

    // Auto-extract memory from conversation (non-blocking)
    extractMemory(interaction.user.id, interaction.guild.id, message, reply, interaction.channel.id).catch(() => {});
  } catch (error) {
    flagForApology(interaction.user.id);
    console.error('Consult error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply({ content: errorMsg, flags: 64 });
    }
  }
}

module.exports = { execute };
