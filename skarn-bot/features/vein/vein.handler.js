const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall, getRateLimitMessage } = require('../../lib/rateLimit');
const { moderatedChatCompletion } = require('../../ai/client');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

const MAX_MESSAGES = 500;

async function execute(interaction) {
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: getRateLimitMessage(interaction.user.id), flags: 64, allowedMentions: { parse: ['users'] } });
  }

  await interaction.deferReply();

  try {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const hours = interaction.options.getInteger('timeframe') || 2;
    const focus = interaction.options.getString('focus');

    // Permission check
    const permissions = targetChannel.permissionsFor(interaction.member);
    if (!permissions || !permissions.has('ViewChannel')) {
      return interaction.editReply({ content: 'That stone is not yours to read.', allowedMentions: { parse: ['users'] } });
    }

    // Fetch messages
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    let allMessages = [];
    let lastId = null;
    const maxBatches = Math.min(Math.ceil(hours / 2), 10);

    for (let i = 0; i < maxBatches && allMessages.length < MAX_MESSAGES; i++) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const batch = await targetChannel.messages.fetch(options);
      if (batch.size === 0) break;

      const batchArray = [...batch.values()];
      const oldEnough = batchArray.filter(m => m.createdTimestamp < cutoff);
      allMessages.push(...batchArray.filter(m => m.createdTimestamp >= cutoff));

      if (oldEnough.length > 0) break;
      lastId = batchArray[batchArray.length - 1].id;
    }

    const sorted = allMessages.reverse();

    if (sorted.length === 0) {
      return interaction.editReply({ content: 'No messages found in this timeframe.', allowedMentions: { parse: ['users'] } });
    }

    // Build conversation text
    const conversation = sorted
      .filter(m => !m.author.bot)
      .map(m => `[${m.author.username}]: ${m.content}`)
      .join('\n');

    if (conversation.length === 0) {
      return interaction.editReply({ content: 'No user messages found.', allowedMentions: { parse: ['users'] } });
    }

    const truncated = conversation.length > 12000
      ? conversation.slice(0, 12000) + '\n... (truncated)'
      : conversation;

    // Build prompt
    const channelState = getChannelState(targetChannel.id, interaction.guild.id);
    const stateLine = getStateLine(channelState.current_state);

    const focusInstruction = focus ? `\nFocus the summary on: ${focus}` : '';

    const systemPrompt = buildSystemPrompt({
      roleLine: roles.vein + focusInstruction,
      stateLine,
      memoryLine: '',
    });

    var result = await moderatedChatCompletion({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Summarize this conversation from #${targetChannel.name}:\n\n${truncated}` },
      ],
      max_tokens: roleTokenBudgets.vein,
      temperature: 0.3,
      userId: interaction.user.id,
    });
    if (!result.success) {
      if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
      await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
      return;
    }
    recordCall(interaction.user.id);
    const summary = result.completion.choices[0].message.content;

    // Split if over 2000 chars
    if (summary.length <= 2000) {
      await interaction.editReply({ content: summary, allowedMentions: { parse: ['users'] } });
    } else {
      await interaction.editReply({ content: summary.slice(0, 1997) + '...', allowedMentions: { parse: ['users'] } });
      let remaining = summary.slice(1997);
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, 2000);
        remaining = remaining.slice(2000);
        await interaction.followUp({ content: chunk, allowedMentions: { parse: ['users'] } });
      }
    }
  } catch (error) {
    console.error('Vein error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
    } else {
      await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
    }
  }
}

module.exports = { execute };
