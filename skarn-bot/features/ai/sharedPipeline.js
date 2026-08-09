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
const { startTypingKeepalive, getTypingDelay } = require('../discordNative/typingSim');
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
const { getRelationship, addStory } = require('../../db/database');
const { extractMemory } = require('../memory/memoryExtractor');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { trackResponse } = require('../intelligence/responseLearner');
const { selectModel, checkKnowledgeMatch } = require('../intelligence/modelRouter');
const { getTools } = require('../tools/toolDefinitions');
const { runTool } = require('../tools/toolRunner');
const { storeMessage } = require('../conversation/messageStore');
const { findStoryTopic, getExistingStory, extractStoryFromReply } = require('../wisdom/storyEngine');
const { updateEmotion, applyAnalyzedEmotion } = require('../wisdom/emotionalIntelligence');

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

  try {
    const { runMessageAnalysis } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var analysis = await runMessageAnalysis(userId, guildId, channelId, message, 'casual');

    // Emotion write — AFTER the analyzer, awaited (grilled Q4): the prompt's
    // emotional line now reflects THIS message. Analyzed path uses the analyzer
    // result (no tone LLM call, stack 5→4); short/failed path falls back to tone.
    // Silent-swallow (grilled S2): emotion tracking is advisory — a write failure
    // logs and continues; it must never block the reply or trigger the apology path.
    // NOTE (accepted Q4 consequence, re-confirmed 2026-08-08): the fallback branch
    // below awaits a tone LLM call (updateEmotion → analyzeTone), adding latency to
    // short messages — deliberate trade for a race-free emotional line on every path.
    try {
      if (analysis) {
        await applyAnalyzedEmotion(userId, guildId, message, analysis);
      } else {
        await updateEmotion(userId, guildId, message);
      }
    } catch (e) { /* emotion tracking is advisory — never block the reply */ }

    const ctx = buildContext(userId, guildId, channelId, {
      roleNature: 'casual',
      userContent: message,
      interactionCount,
    });
    systemPrompt = buildSystemPrompt({ roleLine: roles[roleName] || roles.consult, ...ctx });
    contextualMessage = ctx.conversationLine
      ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${message}`
      : message;

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
    var usedRunCommand = false;
    var maxTurns = 3;
    var turnCount = 0;

    while (turnCount < maxTurns) {
      turnCount++;
      var result = await moderatedChatCompletion({
        model: selectModel(message, hasKnowledgeMatch, analysis ? analysis.complexityScore : undefined),
        messages: messages,
        max_tokens: getDeadpanBudget(roleTokenBudgets[roleName] || roleTokenBudgets.consult, userId, channelId),
        temperature: temperature,
        userId: userId,
        guildId: guildId,
        bucket: 'chat',
        ...(turnCount === 1 ? { tools: getTools(), tool_choice: 'auto' } : {}),
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
        if (tc.function.name === 'run_command') usedRunCommand = true;
        usedTool = true;
        var toolResult = await runTool(tc, { guildId, channelId, userId, sourceMessage: opts.sourceMessage, sourceInteraction: opts.sourceInteraction });
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
    const condensed = await condenseReply(reply, usedRunCommand ? 80 : target, roleName, userId, { usedTool, runCommandShort: usedRunCommand });
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
      const storyTopic = findStoryTopic(draft) || 'general';
      addStory(storyTopic, extractedStory);
    }

    // Detect follow-ups (non-blocking)
    try {
      const { detectFollowUps } = require('../intelligence/followUpEngine');
      detectFollowUps(userId, guildId, channelId, message);
    } catch (e) { /* non-critical */ }

    // One human-pacing delay, length-scaled. The keepalive already keeps the
    // indicator visible for the whole thinking duration (typingSim.js).
    await new Promise(resolve => setTimeout(resolve, getTypingDelay(reply.length)));
    if (channel) {
      await channel.sendTyping().catch(function() { /* permission — skip */ });
    }

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
    extractMemory(userId, guildId, message, reply, analysis).catch(() => {});
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
