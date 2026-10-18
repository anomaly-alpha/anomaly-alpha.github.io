const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { shouldEdit, scheduleEdit } = require('../authenticity/messageEditor');
const { runPipeline } = require('../ai/sharedPipeline');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { moderatedChatCompletion } = require('../../ai/client');

async function executeAdvice(interaction) {
  const { canInteract } = require('../proactive/absenceDetector');
  if (!interaction.guildId || !canInteract(interaction.user.id, interaction.guildId)) {
    return interaction.reply({ content: 'Opt in first with `skarn opt in` before I can join the conversation.', flags: 64, allowedMentions: { parse: [] } });
  }
  await interaction.deferReply({ flags: 64 });
  const question = interaction.options.getString('question');
  try {
    const memories = require('../../db/database').getMemoryEntries(interaction.user.id, interaction.guildId, 5);
    const memoryContext = memories.filter(m => m.source === 'etch').map(m => m.content).join('; ');
    const userMessage = memoryContext ? 'Context about me: ' + memoryContext + '\n\nMy question: ' + question : question;
    const result = await moderatedChatCompletion({
      model: process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-6-luna',
      messages: [{ role: 'system', content: buildSystemPrompt({ roleLine: roles.advice }) }, { role: 'user', content: userMessage }],
      max_tokens: roleTokenBudgets.advice,
      temperature: 0.85,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      surface: 'command',
    });
    if (!result.success) throw new Error('AI failed');
    if (!canInteract(interaction.user.id, interaction.guildId)) return interaction.editReply({ content: 'Opted out. Use skarn opt in if you want me to answer.', allowedMentions: { parse: [] } });
    await interaction.editReply({ content: result.completion.choices[0].message.content, allowedMentions: { parse: [] } });
  } catch {
    await interaction.editReply({ content: 'Even the Warmaster needs a moment. Try again in a bit.', allowedMentions: { parse: [] } });
  }
}

async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'advice') return executeAdvice(interaction);
  const { canInteract } = require('../proactive/absenceDetector');
  if (!interaction.guildId || !canInteract(interaction.user.id, interaction.guildId)) {
    return interaction.reply({ content: 'Opt in first with `skarn opt in` before I can join the conversation.', flags: 64, allowedMentions: { parse: [] } });
  }
  await interaction.deferReply();

  if (!interaction.guild) {
    return interaction.editReply({ content: 'The Warmaster\'s counsel is best given among your people. Use this in a server.', flags: 64, allowedMentions: { parse: ['users'] } });
  }

  // Silence + hostile checks (consult-specific entry)
  const { isHostile, recordStrike, isSilenced, getDeEscalationLine } = require('../safety/slurFilter');
  if (isSilenced(interaction.user.id)) {
    return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
  }

  const message = interaction.options.getString('message');
  if (isHostile(message)) {
    var state = recordStrike(interaction.user.id);
    return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
  }

  const beforeSentiment = analyzeSentiment(message);
  const { getGuildConfig } = require('../../db/database');
  const channelContext = require('../../db/channelContext');
  const aiChannels = getGuildConfig(interaction.guild.id, 'aiChannels') || [];
  const recordSharedContext = Array.isArray(aiChannels) && aiChannels.includes(interaction.channel.id);
  const contextMessageId = 'consult:' + interaction.id;
  let channelSnapshot = null;
  if (recordSharedContext) {
    channelContext.insertChannelContextMessage({
      messageId: contextMessageId,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      authorId: interaction.user.id,
      authorName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
      content: message,
      createdAt: interaction.createdTimestamp || Date.now(),
      capturedAt: Date.now(),
      referenceMessageId: null,
    });
    try {
      channelSnapshot = (await require('../conversation/channelTranscript').buildChannelSnapshot(interaction.guild.id, interaction.channel.id, interaction.user.id, {
        preserveMessageIds: [contextMessageId],
      })).snapshot;
    } catch (error) { console.error('[ChannelContext] Could not build consult context:', error.message); }
  }

  await runPipeline(
    interaction.user.id,
    interaction.guild.id,
    interaction.channel.id,
    message,
    {
      channel: interaction.channel,
      sourceInteraction: interaction,
      threadType: 'consult',
      temperature: 0.8,
      chunkSize: 400,
      roleName: 'consult',
      beforeSentiment: beforeSentiment,
      channelSnapshot: channelSnapshot,
      currentMessageIds: recordSharedContext ? [contextMessageId] : [],
      responseTarget: interaction.user.id,

      sendReply: function(text) {
        return interaction.editReply({ content: text, allowedMentions: { users: [interaction.user.id] } });
      },
      sendFollowUp: function(text) {
        return interaction.followUp({ content: text, allowedMentions: { users: [interaction.user.id] } });
      },
      editReply: function(text) {
        return interaction.editReply({ content: text, allowedMentions: { users: [interaction.user.id] } });
      },
      afterSend: function(sentMessage, content) {
        if (!recordSharedContext) return;
        try { recordConsultResponse(sentMessage, interaction, content); }
        catch (error) { console.error('[ChannelContext] Consult reply capture failed:', error.message); }
      },
      afterFollowUp: function(sentMessage, content) {
        if (!recordSharedContext) return;
        try { recordConsultResponse(sentMessage, interaction, content); }
        catch (error) { console.error('[ChannelContext] Consult follow-up capture failed:', error.message); }
      },
      canEdit: true,
      scheduleEdit: function(msg, fullText) {
        if (shouldEdit()) scheduleEdit(msg, fullText);
      },
      onCrisis: async function() {
        var crisis = require('../safety/crisisResponse').getCrisisResponse();
        await interaction.editReply({ content: crisis.content, flags: 64, allowedMentions: { parse: ['users'] } });
      },
      sendError: function(text) {
        var opts = { content: text, flags: 64, allowedMentions: { parse: ['users'] } };
        return interaction.editReply(opts);
      },
    }
  );
}

function recordConsultResponse(sentMessage, interaction, content) {
  if (!sentMessage || !sentMessage.id || typeof content !== 'string') return;
  const database = require('../../db/database');
  const enabledChannels = database.getGuildConfig(interaction.guild.id, 'aiChannels') || [];
  if (!Array.isArray(enabledChannels) || !enabledChannels.includes(interaction.channel.id)) return;
  const botUser = interaction.client.user;
  require('../../db/channelContext').insertChannelContextMessage({
    messageId: sentMessage.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    authorId: botUser.id,
    authorName: botUser.username || 'Skarn',
    content: content,
    createdAt: sentMessage.createdTimestamp || Date.now(),
    capturedAt: Date.now(),
    referenceMessageId: sentMessage.reference && sentMessage.reference.messageId || null,
    relatedUserId: interaction.user.id,
    isSkarn: true,
  });
}

module.exports = { execute };
