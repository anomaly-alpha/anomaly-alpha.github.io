const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');
const { postProcess, splitMessage, ROLE_NATURE } = require('../discordNative/postProcess');
const { simulateTyping } = require('../discordNative/typingSim');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');

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

  try {
    const message = interaction.options.getString('message');
    const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
    const stateLine = getStateLine(channelState.current_state);

    const memory = getUserMemory(interaction.user.id, interaction.guild.id, 5);
    const memoryLine = memory.length > 0
      ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
      : '';

    const systemPrompt = buildSystemPrompt({
      roleLine: roles.consult,
      stateLine,
      memoryLine,
    });

    const context = await getRecentContext(interaction.channel, 5);
    const contextualMessage = buildContextualPrompt(message, context);

    recordCall(interaction.user.id);

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_completion_tokens: roleTokenBudgets.consult,
      temperature: 0.8,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.consult);

    await simulateTyping(interaction.channel, reply.length);

    const chunks = splitMessage(reply, 400);
    if (chunks.length === 1) {
      await interaction.editReply(chunks[0]);
    } else {
      await interaction.editReply(chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i]);
      }
    }
  } catch (error) {
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
