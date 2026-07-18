const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const openai = require('../../ai/client');

const RATE_LIMIT_MSG = 'Even a Warmaster paces himself. Give it a moment.';

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function execute(interaction) {
  // Rate limit check
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: RATE_LIMIT_MSG, ephemeral: true });
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

    recordCall(interaction.user.id);

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: roleTokenBudgets.consult,
      temperature: 0.8,
    });

    const reply = completion.choices[0].message.content;

    // Split if over 2000 chars
    if (reply.length <= 2000) {
      await interaction.editReply(reply);
    } else {
      await interaction.editReply(reply.slice(0, 1997) + '...');
      let remaining = reply.slice(1997);
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, 2000);
        remaining = remaining.slice(2000);
        await interaction.followUp(chunk);
      }
    }
  } catch (error) {
    console.error('Consult error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true });
    }
  }
}

module.exports = { execute };
