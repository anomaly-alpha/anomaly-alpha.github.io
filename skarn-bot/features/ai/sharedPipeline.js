// Shared AI response pipeline used by both /consult and @Skarn mention.
// Extracted from consult.handler.js and mentionRouter.js to eliminate ~90% duplication.

const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { condenseReply } = require('./condenser');
const { replyTargetFor } = require('../../persona/roles');
const { getUsage } = require('../../lib/rateLimit');
const { moderatedChatCompletion } = require('../../ai/client');
const { buildContext } = require('../promptContext');
const { splitMessage, maybeBurst } = require('../discordNative/postProcess');
const { estimateDelay } = require('../authenticity/typingController');
const { simulateTyping, startTypingKeepalive } = require('../discordNative/typingSim');
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
const { getRelationship, addStory } = require('../../db/database');
const { extractMemory } = require('../memory/memoryExtractor');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { trackResponse } = require('../intelligence/responseLearner');
const { selectModel, checkKnowledgeMatch } = require('../intelligence/modelRouter');
const { tools } = require('../tools/toolDefinitions');
const { runTool } = require('../tools/toolRunner');
const { storeMessage } = require('../conversation/messageStore');
const { findStoryTopic, getExistingStory, extractStoryFromReply } = require('../wisdom/storyEngine');
const { updateEmotion } = require('../wisdom/emotionalIntelligence');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

// opts:
//   channel         — Discord channel object (for typing sim, burst)
//   sendReply(text)     — send first message chunk
//   sendFollowUp(text)  — send subsequent chunks
//   editReply(text)     — edit reply (consult) or null
//   canEdit             — enable message editing
//   scheduleEdit(msg, fullText) — schedule an edit for later
//   onCrisis()          — content crisis handler
//   sendError(text)     — error message handler
//   afterReply()        — called after reply sent (for attention state, etc.)
//   chunkSize           — 400 (consult) | 1900 (mention)
//   threadType          — 'consult' | 'channel'
//   temperature         — 0.8 | 0.85
//   beforeSentiment     — pre-computed sentiment (optional)
//   roleName            — role in roles.js (default 'consult')
async function runPipeline(userId, guildId, channelId, message, opts) {
  var threadType = opts.threadType || 'channel';
  var temperature = opts.temperature || 0.85;
  var chunkSize = opts.chunkSize || 1900;
  var beforeSentiment = opts.beforeSentiment;
  var roleName = opts.roleName || 'consult';
  var channel = opts.channel;

  // Typing indicator — visible for the ENTIRE thinking duration, not just the
  // post-generation pause. Stopped in the finally block below.
  var stopTyping = startTypingKeepalive(channel);

  // Store user message
  await storeMessage(userId, guildId, channelId, 'user', message, { threadType: threadType });

  const rel = getRelationship(userId, guildId);
  const interactionCount = rel ? rel.interaction_count : 0;

  // Detect and track user emotion
  updateEmotion(userId, guildId, message).catch(function() {});

  try {
    const { runPipeline: runPreprocessing } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var pipelineResult;

    pipelineResult = await runPreprocessing(
      userId, guildId, channelId,
      message, roles[roleName] || roles.consult, 'casual', null, { isSkipListCommand: false }
    );

    if (pipelineResult && !pipelineResult.skipped) {
      systemPrompt = pipelineResult.systemPrompt;
      contextualMessage = pipelineResult.contextualMessage;
    } else {
      const ctx = buildContext(userId, guildId, channelId, {
        roleNature: 'casual',
        userContent: message,
        interactionCount,
      });
      systemPrompt = buildSystemPrompt({ roleLine: roles[roleName] || roles.consult, ...ctx });
      contextualMessage = ctx.conversationLine
        ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${message}`
        : message;
    }

    extendBanterChain(userId, guildId, channelId);

    const hasKnowledgeMatch = checkKnowledgeMatch(userId, guildId, message);

    // Story engine injection
    const storyTopic = findStoryTopic(message);
    if (storyTopic) {
      const existingStory = getExistingStory(storyTopic);
      if (existingStory) {
        contextualMessage += `\n\n[Skarn recalls a tale about ${storyTopic}: "${existingStory}"]`;
      }
    }

    const target = replyTargetFor(roleName);
    if (target > 0) {
      systemPrompt += '\n\nAim for roughly ' + target + ' characters. Only go longer when you actually need to.';
    }

    // ===== Tool-enabled AI call =====
    var messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextualMessage },
    ];
    var reply = '';
    var usedTool = false;
    var maxTurns = 3;
    var turnCount = 0;

    while (turnCount < maxTurns) {
      turnCount++;
      var result = await moderatedChatCompletion({
        model: selectModel(message, hasKnowledgeMatch, pipelineResult ? pipelineResult.analysis.complexityScore : undefined),
        messages: messages,
        max_tokens: getDeadpanBudget(roleTokenBudgets[roleName] || roleTokenBudgets.consult, userId, channelId),
        temperature: temperature,
        userId: userId,
        bucket: 'chat',
        ...(turnCount === 1 ? { tools: tools, tool_choice: 'auto' } : {}),
      });
      if (!result.success) {
        if (result.crisis) {
          if (opts.onCrisis) await opts.onCrisis();
          return;
        }
        await opts.sendError(result.safeMessage);
        return;
      }

      var choice = result.completion.choices[0].message;
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        reply = choice.content || '';
        break;
      }

      messages.push({ role: 'assistant', content: choice.content || null, tool_calls: choice.tool_calls });
      for (var tc of choice.tool_calls) {
        usedTool = true;
        var toolResult = await runTool(tc, { guildId, channelId, userId });
        messages.push(toolResult);
      }
    }

    if (!reply) {
      await opts.sendError('The threads tangled. Try again?');
      return;
    }

    // Condense over-target replies before storing/sending (spec [S5]).
    // Story extraction reads the draft so a condensed beat isn't lost.
    const draft = reply;
    const condensed = await condenseReply(reply, target, roleName, userId, { usedTool });
    if (condensed && typeof condensed.reply === 'string') {
      reply = condensed.reply;
    }

    // Store assistant response — awaited so the reply is committed before the
    // interaction ends; a fast follow-up must see Skarn's own last words.
    await storeMessage(userId, guildId, channelId, 'assistant', reply, { threadType: threadType });

    // Track response sentiment shift (non-blocking)
    const afterSentiment = analyzeSentiment(reply);
    trackResponse(userId, guildId, beforeSentiment !== undefined ? beforeSentiment : analyzeSentiment(message), afterSentiment);

    // Extract and store any new story from the AI reply (non-blocking)
    const extractedStory = extractStoryFromReply(draft);
    if (extractedStory) {
      const storyTopic = findStoryTopic(reply) || 'general';
      addStory(storyTopic, extractedStory);
    }

    // Detect follow-ups (non-blocking)
    try {
      const { detectFollowUps } = require('../intelligence/followUpEngine');
      detectFollowUps(userId, guildId, channelId, message);
    } catch (e) { /* non-critical */ }

    // Typing simulation — keep the pre-send pacing (the keepalive already keeps
    // the indicator visible; this adds the "drafting" beat before sending)
    if (channel) {
      await simulateTyping(channel, reply.length);
    }

    await new Promise(resolve => setTimeout(resolve, estimateDelay(reply)));

    const isPunchlineMsg = isPunchline(reply, channelId, userId);
    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }

    // Usage counter
    var usage = getUsage(userId, 'chat');
    if (usage.current >= 40) reply = reply + ' -# (' + usage.current + '/' + usage.max + ')';

    // Split and send
    const chunks = splitMessage(reply, chunkSize);
    if (chunks.length === 1) {
      if (opts.canEdit && opts.editReply) {
        const replyMsg = await opts.editReply(chunks[0]);
        if (opts.scheduleEdit) opts.scheduleEdit(replyMsg, reply);
      } else {
        await opts.sendReply(chunks[0]);
      }
    } else {
      if (opts.canEdit && opts.editReply) {
        const replyMsg = await opts.editReply(chunks[0]);
        if (opts.scheduleEdit) opts.scheduleEdit(replyMsg, reply);
      } else {
        await opts.sendReply(chunks[0]);
      }
      const tail = await maybeBurst(chunks.slice(1), channel);
      for (const chunk of tail) {
        await opts.sendFollowUp(chunk);
      }
    }

    // Post-reply hook (attention state, etc.)
    if (opts.afterReply) await opts.afterReply();

    // Auto-extract memory (non-blocking)
    extractMemory(userId, guildId, message, reply, pipelineResult ? pipelineResult.analysis : null).catch(() => {});
  } catch (error) {
    try {
      const { flagForApology } = require('../etiquette/etiquetteEngine');
      flagForApology(userId);
    } catch (e) { /* non-critical */ }
    console.error('AI pipeline error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await opts.sendError(errorMsg);
  } finally {
    stopTyping();
  }
}

module.exports = { runPipeline };
