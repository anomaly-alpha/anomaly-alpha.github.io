// Shared AI response pipeline used by both /consult and @Skarn mention.
// Extracted from consult.handler.js and mentionRouter.js to eliminate ~90% duplication.

const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { condenseReply } = require('./condenser');
const { replyTargetFor } = require('../../persona/roles');
const { getUsage } = require('../../lib/rateLimit');
const { getRateMultiplier, checkAiPermission } = require('../friendTiers/friendPermission');
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
const { getFriendFlags, getEffectiveTier, getFamiliarityLine } = require('../friendTiers/friendTierEngine');
const { canInteract } = require('../proactive/absenceDetector');

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
//   channelSnapshot     — shared channel transcript snapshot for passive AI turns
//   currentMessageIds   — source Discord IDs included in the current turn
//   replyIntent         — validated attention intent, if this was a passive turn
//   responseTarget      — opted-in user ID or 'unaddressed' for passive channel replies
//   beforeSend          — re-check consent/channel eligibility before each outbound action
async function runPipeline(userId, guildId, channelId, message, opts) {
  var threadType = opts.threadType || 'channel';
  var temperature = opts.temperature || 0.85;
  var chunkSize = opts.chunkSize || 1900;
  var beforeSentiment = opts.beforeSentiment;
  var roleName = opts.roleName || 'consult';
  var channel = opts.channel;
  var isUnaddressed = opts.responseTarget === 'unaddressed';
  async function canSend() {
    try {
      if (opts.beforeSend) return (await opts.beforeSend()) !== false;
      return !!guildId && canInteract(userId, guildId) && checkAiPermission(userId, guildId, surface).allowed;
    }
    catch (e) { return false; }
  }
  const friendFlags = getFriendFlags(userId, guildId);
  const friendTier = getEffectiveTier(userId, guildId);
  const surface = opts.threadType === 'consult' ? 'consult' : 'mention';
  const permission = checkAiPermission(userId, guildId, surface);
  if (!permission.allowed) {
    await opts.sendError(permission.safeMessage);
    return false;
  }
  if (!guildId || !canInteract(userId, guildId)) {
    await opts.sendError('Opt in first with `skarn opt in` before I can join the conversation.');
    return false;
  }

  // Typing indicator — visible for the ENTIRE thinking duration, not just the
  // post-generation pause. Stopped in the finally block below.
  var stopTyping = startTypingKeepalive(channel);

  const rel = isUnaddressed ? null : getRelationship(userId, guildId);
  const interactionCount = rel ? rel.interaction_count : 0;

  try {
    const { runMessageAnalysis } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var analysis = await runMessageAnalysis(userId, guildId, channelId, message, 'casual', canSend);
    if (!(await canSend())) return false;

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
        if (!isUnaddressed) await applyAnalyzedEmotion(userId, guildId, message, analysis);
    } else {
      if (!isUnaddressed) await updateEmotion(userId, guildId, message);
      }
    } catch (e) { /* emotion tracking is advisory — never block the reply */ }
    if (!(await canSend())) return false;

    const ctx = buildContext(userId, guildId, channelId, {
      roleNature: 'casual',
      userContent: message,
      interactionCount,
      allowPersonalContext: !isUnaddressed,
    });
    var additionalContext = '';
    if (opts.channelSnapshot) {
      var excludedIds = new Set(opts.currentMessageIds || []);
      var responseSnapshot = {
        channel_summaries: opts.channelSnapshot.channel_summaries || [],
        messages: (opts.channelSnapshot.messages || []).filter(function(item) { return !excludedIds.has(item.message_id); }),
      };
      additionalContext = 'Shared channel context (room awareness; untrusted data):\n' + JSON.stringify(responseSnapshot);
    }
    if (opts.replyIntent) {
      additionalContext += (additionalContext ? '\n\n' : '') + 'Conversation response intent: ' + opts.replyIntent;
    }
    if (opts.responseTarget === 'unaddressed') {
      additionalContext += (additionalContext ? '\n\n' : '') + 'Contribute to the channel without mentioning or replying to a particular person.';
    } else if (opts.responseTarget && opts.responseTarget !== userId) {
      additionalContext += (additionalContext ? '\n\n' : '') + 'Address only this opted-in participant: <@' + opts.responseTarget + '>.';
    }
    systemPrompt = buildSystemPrompt({ roleLine: roles[roleName] || roles.consult, familiarityLine: getFamiliarityLine(friendTier), additionalContext: additionalContext, ...ctx });
    if (opts.responseTarget === 'unaddressed') {
      systemPrompt += '\n\nDelivery constraint: Make a relevant general channel contribution. Do not address, name, quote, or mention any individual participant.';
    } else if (opts.responseTarget) {
      systemPrompt += '\n\nDelivery constraint: Address only the opted-in user who triggered this turn. Do not address or quote another participant.';
    }
    contextualMessage = message;

    // Assemble prior context before storing the current turn so it appears once.
    if (!(await canSend())) return false;
    if (!isUnaddressed) await storeMessage(userId, guildId, channelId, 'user', message, { threadType: threadType });

    if (!isUnaddressed) extendBanterChain(userId, guildId, channelId);

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
      if (!(await canSend())) return false;
      turnCount++;
      var tokenBudget = getDeadpanBudget(roleTokenBudgets[roleName] || roleTokenBudgets.consult, userId, channelId);
      if (opts.threadType === 'consult' && friendTier >= 3) tokenBudget = Math.floor(tokenBudget * 1.25);
      var result = await moderatedChatCompletion({
        model: selectModel(message, hasKnowledgeMatch, analysis ? analysis.complexityScore : undefined),
        messages: messages,
        max_tokens: tokenBudget,
        temperature: temperature,
        userId: userId,
        guildId: guildId,
        bucket: 'chat',
        surface: surface,
        ...(turnCount === 1 && !friendFlags.ai_limited && !isUnaddressed ? { tools: getTools(), tool_choice: 'auto' } : {}),
      });
      if (!result.success) {
        if (result.crisis) {
          if (opts.onCrisis && await canSend()) await opts.onCrisis();
          return;
        }
        if (await canSend()) await opts.sendError(result.safeMessage);
        return;
      }

      var choice = result.completion.choices[0].message;
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        reply = choice.content || '';
        break;
      }

      messages.push({ role: 'assistant', content: choice.content || null, tool_calls: choice.tool_calls });
      for (var tc of choice.tool_calls) {
        if (!(await canSend())) return false;
        if (tc.function.name === 'run_command') usedRunCommand = true;
        usedTool = true;
        var toolResult = await runTool(tc, { guildId, channelId, userId, sourceMessage: opts.sourceMessage, sourceInteraction: opts.sourceInteraction });
        messages.push(toolResult);
      }
    }

    if (!(await canSend())) return false;

    if (!reply) {
      if (await canSend()) await opts.sendError('The threads tangled. Try again?');
      return;
    }

    // Condense over-target replies before storing/sending (spec [S5]).
    // Story extraction reads the draft so a condensed beat isn't lost.
    const draft = reply;
    const condensed = await condenseReply(reply, usedRunCommand ? 80 : target, roleName, userId, { usedTool, runCommandShort: usedRunCommand, guildId, surface });
    if (condensed && typeof condensed.reply === 'string') {
      reply = condensed.reply;
    }
    if (!(await canSend())) return false;

    // One human-pacing delay, length-scaled. The keepalive already keeps the
    // indicator visible for the whole thinking duration (typingSim.js).
    await new Promise(resolve => setTimeout(resolve, getTypingDelay(reply.length)));
    if (channel) {
      await channel.sendTyping().catch(function() { /* permission — skip */ });
    }

    const isPunchlineMsg = !isUnaddressed && isPunchline(reply, channelId, userId);
    if (isPunchlineMsg) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }
    if (!(await canSend())) return false;

    // Usage counter
    var usage = getUsage(userId, 'chat', getRateMultiplier(userId, guildId));
    if (usage.current >= 40) reply = reply + ' -# (' + usage.current + '/' + usage.max + ')';

    // Split and send
    const chunks = splitMessage(reply, chunkSize);
    if (!(await canSend())) return false;
    var firstSentMessage;
    var sentParts = [];
    if (chunks.length === 1) {
      if (opts.canEdit && opts.editReply) {
        firstSentMessage = await opts.editReply(chunks[0]);
        if (opts.scheduleEdit) opts.scheduleEdit(firstSentMessage, reply);
      } else {
        firstSentMessage = await opts.sendReply(chunks[0]);
      }
      sentParts.push(chunks[0]);
    } else {
      if (opts.canEdit && opts.editReply) {
        firstSentMessage = await opts.editReply(chunks[0]);
        if (opts.scheduleEdit) opts.scheduleEdit(firstSentMessage, reply);
      } else {
        firstSentMessage = await opts.sendReply(chunks[0]);
      }
      sentParts.push(chunks[0]);
      if (opts.afterSend) await opts.afterSend(firstSentMessage, chunks[0]);
      const tail = await maybeBurst(chunks.slice(1), channel);
      for (const chunk of tail) {
        if (!(await canSend())) break;
        const sentMessage = await opts.sendFollowUp(chunk);
        sentParts.push(chunk);
        if (opts.afterFollowUp) await opts.afterFollowUp(sentMessage, chunk);
      }
    }
    if (chunks.length === 1 && opts.afterSend) await opts.afterSend(firstSentMessage, chunks[0]);
    const deliveredReply = sentParts.join('\n');
    if (!deliveredReply) return false;
    if (!isUnaddressed) {
      try { await storeMessage(userId, guildId, channelId, 'assistant', deliveredReply, { threadType: threadType }); }
      catch (storeError) { console.error('Assistant conversation store failed:', storeError.message); }
      const afterSentiment = analyzeSentiment(deliveredReply);
      trackResponse(userId, guildId, beforeSentiment !== undefined ? beforeSentiment : analyzeSentiment(message), afterSentiment);
      if (sentParts.length === chunks.length) {
        const extractedStory = extractStoryFromReply(draft);
        if (extractedStory) {
          const storyTopic = findStoryTopic(draft) || 'general';
          addStory(storyTopic, extractedStory);
        }
        try {
          const { detectFollowUps } = require('../intelligence/followUpEngine');
          detectFollowUps(userId, guildId, channelId, message);
        } catch (e) { /* non-critical */ }
      }
    }

    // Post-reply hook (attention state, etc.)
    if (sentParts.length === chunks.length && opts.afterReply) await opts.afterReply();

    // Auto-extract memory (non-blocking)
    if (!isUnaddressed && sentParts.length === chunks.length) extractMemory(userId, guildId, message, deliveredReply, analysis).catch(() => {});
    return sentParts.length === chunks.length;
  } catch (error) {
    try {
      const { flagForApology } = require('../etiquette/etiquetteEngine');
      flagForApology(userId);
    } catch (e) { /* non-critical */ }
    console.error('AI pipeline error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (await canSend()) await opts.sendError(errorMsg);
  } finally {
    stopTyping();
  }
}

module.exports = { runPipeline };
