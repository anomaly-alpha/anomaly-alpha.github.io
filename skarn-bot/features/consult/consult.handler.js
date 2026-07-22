const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall, getRateLimitMessage, getUsage } = require('../../lib/rateLimit');
const { moderatedChatCompletion } = require('../../ai/client');
const { buildContext } = require('../promptContext');
const { splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { estimateDelay } = require('../authenticity/typingController');
const { simulateTyping } = require('../discordNative/typingSim');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
const { getRelationship, addStory } = require('../../db/database');
const { flagForApology } = require('../etiquette/etiquetteEngine');
const { extractMemory } = require('../memory/memoryExtractor');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { trackResponse } = require('../intelligence/responseLearner');
const { selectModel, checkKnowledgeMatch } = require('../intelligence/modelRouter');
const { storeMessage } = require('../conversation/messageStore');
const { shouldEdit, scheduleEdit } = require('../authenticity/messageEditor');
const { findStoryTopic, getExistingStory, extractStoryFromReply } = require('../wisdom/storyEngine');
const { updateEmotion } = require('../wisdom/emotionalIntelligence');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function execute(interaction) {
  await interaction.deferReply();

  // Rate limit check
  if (!canCall(interaction.user.id, 'chat')) {
    return interaction.deleteReply();
  }

  const rel = getRelationship(interaction.user.id, interaction.guild.id);
  const interactionCount = rel ? rel.interaction_count : 0;

  const { isHostile, recordStrike, isSilenced, getDeEscalationLine } = require('../safety/slurFilter');
  if (isSilenced(interaction.user.id)) {
    return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
  }

  try {
    const message = interaction.options.getString('message');
    if (isHostile(message)) {
      var state = recordStrike(interaction.user.id);
      if (state >= 3) {
        return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
      }
      return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
    }
    const beforeSentiment = analyzeSentiment(message);

    // Store user message
    storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'user', message, { threadType: 'consult' });

    const { runPipeline } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var pipelineResult;

    pipelineResult = await runPipeline(
      interaction.user.id, interaction.guild.id, interaction.channel.id,
      message, roles.consult, 'casual', null, { isSkipListCommand: false }
    );

    if (pipelineResult && !pipelineResult.skipped) {
      systemPrompt = pipelineResult.systemPrompt;
      contextualMessage = pipelineResult.contextualMessage;
    } else {
      // Fall through to existing flow
      const ctx = buildContext(interaction.user.id, interaction.guild.id, interaction.channel.id, {
        roleNature: 'casual',
        userContent: message,
        interactionCount,
      });
      systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });
      contextualMessage = ctx.conversationLine
        ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${message}`
        : message;
    }

    // Detect and track user emotion
    updateEmotion(interaction.user.id, interaction.guild.id, message);

    extendBanterChain(interaction.user.id, interaction.guild.id, interaction.channel.id);

    const hasKnowledgeMatch = checkKnowledgeMatch(interaction.user.id, interaction.guild.id, message);

    // Story engine: check if user message triggers a story topic
    const storyTopic = findStoryTopic(message);
    if (storyTopic) {
      const existingStory = getExistingStory(storyTopic);
      if (existingStory) {
        contextualMessage += `\n\n[Skarn recalls a tale about ${storyTopic}: "${existingStory}"]`;
      }
    }

    var result = await moderatedChatCompletion({
      model: selectModel(message, hasKnowledgeMatch, pipelineResult ? pipelineResult.analysis.complexityScore : undefined),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_tokens: getDeadpanBudget(roleTokenBudgets.consult, interaction.user.id, interaction.channel.id),
      temperature: 0.8,
      userId: interaction.user.id,
    });
    if (!result.success) {
      if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
      await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
      return;
    }
    recordCall(interaction.user.id, 'chat');
    var reply = result.completion.choices[0].message.content;

    // Store assistant response
    storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'assistant', reply, { threadType: 'consult' });

    // Track response sentiment shift (non-blocking)
    const afterSentiment = analyzeSentiment(reply);
    trackResponse(interaction.user.id, interaction.guild.id, beforeSentiment, afterSentiment);

    // Extract and store any new story from the AI reply (non-blocking)
    const extractedStory = extractStoryFromReply(reply);
    if (extractedStory) {
      const storyTopic = findStoryTopic(reply) || 'general';
      addStory(storyTopic, extractedStory);
    }

    const isPunchlineMsg = isPunchline(reply, interaction.channel.id, interaction.user.id);

    await simulateTyping(interaction.channel, reply.length);

    await new Promise(resolve => setTimeout(resolve, estimateDelay(reply)));

    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }

    var usage = getUsage(interaction.user.id, 'chat');
    if (usage.current >= 40) reply = reply + ' -# (' + usage.current + '/' + usage.max + ')';

    const chunks = splitMessage(reply, 400);
    if (chunks.length === 1) {
      const replyMsg = await interaction.editReply({ content: chunks[0], allowedMentions: { parse: ['users'] } });
      if (shouldEdit()) scheduleEdit(replyMsg, reply);
    } else {
      const replyMsg = await interaction.editReply({ content: chunks[0], allowedMentions: { parse: ['users'] } });
      if (shouldEdit()) scheduleEdit(replyMsg, reply);
      const tail = await maybeBurst(chunks.slice(1), interaction.channel);
      for (const chunk of tail) {
        await interaction.followUp({ content: chunk, allowedMentions: { parse: ['users'] } });
      }
    }

    // Auto-extract memory from conversation (non-blocking)
    extractMemory(interaction.user.id, interaction.guild.id, message, reply, pipelineResult ? pipelineResult.analysis : null).catch(() => {});

    // Follow-up detection (non-blocking)
    const { detectFollowUps } = require('../intelligence/followUpEngine');
    try { detectFollowUps(interaction.user.id, interaction.guild.id, interaction.channel.id, message); } catch (e) {
      console.error('[Consult] Follow-up detection failed:', e.message);
    }
  } catch (error) {
    flagForApology(interaction.user.id);
    console.error('Consult error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
    } else {
      await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
    }
  }
}

module.exports = { execute };
