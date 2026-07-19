const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');
const { collectContext } = require('../promptContext');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { estimateDelay } = require('../authenticity/typingController');
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
const { assembleContext } = require('../conversation/contextAssembler');
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
  if (!canInteract(message.author.id, message.guild?.id)) return;

  const userId = message.author.id;
  const channelId = message.channel.id;

  // Rate limit check
  if (!canCall(userId)) {
    await message.reply('Even a Warmaster paces himself. Give it a moment.');
    return;
  }

  // Clean message content (remove bot mention)
  const cleanMsg = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!cleanMsg) return;

  // Reaction-only check — skip AI for casual/sharing messages (10% chance)
  const sentiment = analyzeSentiment(cleanMsg);
  if (shouldReactOnly('casual')) {
    await message.react(pickReaction(sentiment));
    return;
  }

  // Store user message and assemble conversation context
  storeMessage(userId, message.guild.id, channelId, 'user', cleanMsg, { threadType: 'channel' });
  const conversationContext = assembleContext(userId, message.guild.id, channelId);

  const rel = getRelationship(userId, message.guild.id);
  const interactionCount = rel ? rel.interaction_count : 0;

  // Detect and track user emotion
  updateEmotion(userId, message.guild.id, cleanMsg);

  try {
    const ctx = collectContext(userId, message.guild.id, channelId, {
      roleNature: 'casual',
      userContent: cleanMsg,
      interactionCount,
    });
    const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

    let contextualMessage = conversationContext
      ? `Conversation context:\n${conversationContext}\n\nCurrent message: ${cleanMsg}`
      : cleanMsg;

    recordCall(userId);
    extendBanterChain(userId, message.guild.id, channelId);

    const hasKnowledgeMatch = checkKnowledgeMatch(userId, message.guild.id, cleanMsg);

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
      model: selectModel(cleanMsg, hasKnowledgeMatch),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextualMessage },
      ],
      max_completion_tokens: getDeadpanBudget(roleTokenBudgets.consult, userId, channelId),
      temperature: 0.85,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.consult);

    // Store assistant response
    storeMessage(userId, message.guild.id, channelId, 'assistant', reply, { threadType: 'channel' });

    // Track response sentiment shift (non-blocking)
    const afterSentiment = analyzeSentiment(reply);
    trackResponse(userId, message.guild.id, sentiment, afterSentiment);

    // Extract and store any new story from the AI reply (non-blocking)
    const extractedStory = extractStoryFromReply(reply);
    if (extractedStory) {
      const storyTopic = findStoryTopic(reply) || 'general';
      addStory(storyTopic, extractedStory);
    }

    // Detect time-bound statements and unanswered questions (non-blocking)
    detectFollowUps(userId, message.guild.id, channelId, cleanMsg);

    const isPunchlineMsg = isPunchline(reply, channelId, userId);

    await new Promise(resolve => setTimeout(resolve, estimateDelay(reply)));

    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }

    const chunks = splitMessage(reply, 400);
    await message.reply(chunks[0]);
    const tail = await maybeBurst(chunks.slice(1), message.channel);
    for (const chunk of tail) {
      await message.channel.send(chunk);
    }

    // Auto-extract memory from conversation (non-blocking)
    extractMemory(userId, message.guild.id, cleanMsg, reply, channelId).catch(() => {});
  } catch (error) {
    flagForApology(userId);
    console.error('Mention reply error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await message.reply(errorMsg);
  }
}

module.exports = { handleMention };
