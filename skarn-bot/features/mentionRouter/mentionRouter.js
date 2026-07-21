const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall, getRateLimitMessage, getUsage } = require('../../lib/rateLimit');
const { canRespond } = require('../../lib/aiStats');
const getOpenAIClient = require('../../ai/client');
const { buildContext } = require('../promptContext');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { estimateDelay } = require('../authenticity/typingController');
const { simulateTyping } = require('../discordNative/typingSim');
const { shouldReactOnly, pickReaction } = require('../authenticity/reactionController');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
const { getRelationship, addStory } = require('../../db/database');
const { flagForApology } = require('../etiquette/etiquetteEngine');
const { extractMemory } = require('../memory/memoryExtractor');
const { detectFollowUps } = require('../intelligence/followUpEngine');
const { trackResponse } = require('../intelligence/responseLearner');
const { selectModel, checkKnowledgeMatch } = require('../intelligence/modelRouter');
const { storeMessage } = require('../conversation/messageStore');
const { findStoryTopic, getExistingStory, extractStoryFromReply } = require('../wisdom/storyEngine');
const { updateEmotion } = require('../wisdom/emotionalIntelligence');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function handleMention(message, client) {
  if (message.author.bot) return;

  // Respect opt-in: only respond if user has enabled interactions
  const { canInteract } = require('../proactive/absenceDetector');
  const guildId = message.guild?.id ?? 'dm';
  if (!canInteract(message.author.id, guildId)) return;

  const userId = message.author.id;
  const channelId = message.channel.id;

  // Rate limit check
  if (!canCall(userId, 'chat')) {
    await message.reply(getRateLimitMessage(userId, 'chat'));
    return;
  }

  // Hourly cap check — silently drop if user hit 50/hr
  if (!canRespond(userId)) {
    return;
  }

  // Clean message content (remove bot mention)
  const cleanMsg = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!cleanMsg) return;

  // Hostile content detection — 3 strikes = silence with de-escalation
  const { isHostile, recordStrike, isSilenced, getDeEscalationLine, checkOutput } = require('../safety/slurFilter');
  if (isHostile(cleanMsg)) {
    var state = recordStrike(userId);
    if (state >= 3) {
      return message.reply(getDeEscalationLine());
    }
    return message.reply(getDeEscalationLine());
  }

  // Pre-generation silence check
  if (isSilenced(userId)) {
    return;
  }

  // Reaction-only check — skip AI for casual/sharing messages (10% chance)
  const sentiment = analyzeSentiment(cleanMsg);
  if (shouldReactOnly('casual')) {
    await message.react(pickReaction(sentiment));
    return;
  }

  // Store user message
  storeMessage(userId, guildId, channelId, 'user', cleanMsg, { threadType: 'channel' });

  const rel = getRelationship(userId, guildId);
  const interactionCount = rel ? rel.interaction_count : 0;

  // Detect and track user emotion
  updateEmotion(userId, guildId, cleanMsg);

  try {
    const { runPipeline } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var pipelineResult;

    pipelineResult = await runPipeline(
      userId, guildId, channelId,
      cleanMsg, roles.consult, 'casual', null, { isSkipListCommand: false }
    );

    if (pipelineResult && !pipelineResult.skipped) {
      systemPrompt = pipelineResult.systemPrompt;
      contextualMessage = pipelineResult.contextualMessage;
    } else {
      // Fall through to existing flow
      const ctx = buildContext(userId, guildId, channelId, {
        roleNature: 'casual',
        userContent: cleanMsg,
        interactionCount,
      });
      systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });
      contextualMessage = ctx.conversationLine
        ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${cleanMsg}`
        : cleanMsg;
    }

    recordCall(userId, 'chat');
    extendBanterChain(userId, guildId, channelId);

    const hasKnowledgeMatch = checkKnowledgeMatch(userId, guildId, cleanMsg);

    // Story engine: check if user message triggers a story topic
    const storyTopic = findStoryTopic(cleanMsg);
    let storyContext = '';
    if (storyTopic) {
      const existingStory = getExistingStory(storyTopic);
      if (existingStory) {
        storyContext = `\n\n[Skarn recalls a tale about ${storyTopic}: "${existingStory}"]`;
      }
    }
    if (storyContext) {
      contextualMessage += storyContext;
    }

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: selectModel(cleanMsg, hasKnowledgeMatch, pipelineResult ? pipelineResult.analysis.complexityScore : undefined),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_completion_tokens: getDeadpanBudget(roleTokenBudgets.consult, userId, channelId),
      temperature: 0.85,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.consult);

    // Post-generation gate check (Gates 2+3)
    var filterResult = await checkOutput(reply, userId);
    if (!filterResult.allowed) {
      storeMessage(userId, guildId, channelId, 'assistant', '[BLOCKED]', { threadType: 'channel' });
      if (filterResult.line) {
        await message.reply(filterResult.line);
      } else {
        await message.reply(getDeEscalationLine());
      }
      return;
    }

    // Store assistant response
    storeMessage(userId, guildId, channelId, 'assistant', reply, { threadType: 'channel' });

    // Track response sentiment shift (non-blocking)
    const afterSentiment = analyzeSentiment(reply);
    trackResponse(userId, guildId, sentiment, afterSentiment);

    // Extract and store any new story from the AI reply (non-blocking)
    const extractedStory = extractStoryFromReply(reply);
    if (extractedStory) {
      const storyTopic = findStoryTopic(reply) || 'general';
      addStory(storyTopic, extractedStory);
    }

    // Detect time-bound statements and unanswered questions (non-blocking)
    detectFollowUps(userId, guildId, channelId, cleanMsg);

    const isPunchlineMsg = isPunchline(reply, channelId, userId);

    await simulateTyping(message.channel, reply.length);

    await new Promise(resolve => setTimeout(resolve, estimateDelay(reply)));

    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }

    var usage = getUsage(userId, 'chat');
    if (usage.current >= 40) reply = reply + ' -# (' + usage.current + '/' + usage.max + ')';

    const chunks = splitMessage(reply, 1900);
    await message.reply(chunks[0]);
    const tail = await maybeBurst(chunks.slice(1), message.channel);
    for (const chunk of tail) {
      await message.channel.send(chunk);
    }

    // Update attention state
    try {
      var db = require('../../db/database');
      db.resetMsgCount(userId, guildId || '', channelId);
      db.upsertAttentionState(userId, guildId || '', channelId, {
        last_bot_reply_at: Date.now(),
        last_bot_channel_msg_at: Date.now(),
      });
    } catch (e) { /* non-critical */ }

    // Auto-extract memory from conversation (non-blocking)
    extractMemory(userId, guildId, cleanMsg, reply, pipelineResult ? pipelineResult.analysis : null).catch(() => {});
  } catch (error) {
    flagForApology(userId);
    console.error('Mention reply error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await message.reply(errorMsg);
  }
}

module.exports = { handleMention };
