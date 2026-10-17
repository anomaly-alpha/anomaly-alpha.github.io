const OpenAI = require('openai');
const { getSafeMessage } = require('../features/safety/safeMessages');

var SELF_HARM_CATS = ['self-harm', 'self-harm/intent', 'self-harm/instructions'];
var client = null;

function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

async function moderateInput(text, signal) {
  try {
    var c = getOpenAIClient();
    var result = await c.moderations.create({ model: 'omni-moderation-latest', input: text }, signal ? { signal: signal } : undefined);
    var r = result.results[0];
    for (var i = 0; i < SELF_HARM_CATS.length; i++) {
      if (r.categories[SELF_HARM_CATS[i]]) return { action: 'crisis' };
    }
    if (r.flagged) {
      // Allow violence through — Skarn talks about battles in-character
      var ALLOWED_VIOLENCE = ['violence', 'violence/graphic', 'harassment'];
      var hasBlockedCat = false;
      for (var cat in r.categories) {
        if (r.categories[cat] && ALLOWED_VIOLENCE.indexOf(cat) === -1 && SELF_HARM_CATS.indexOf(cat) === -1) {
          hasBlockedCat = true;
          break;
        }
      }
      if (hasBlockedCat) return { action: 'block', categories: r.categories };
    }
    return { action: 'pass' };
  } catch (e) {
    console.error('[Moderation] Input check failed:', e.message);
    return { action: 'block', unavailable: true };
  }
}

async function moderatedChatCompletion(params) {
  var friendPermission = require('../features/friendTiers/friendPermission');
  var friendContext = friendPermission.getFriendContext() || {};
  var userId = params.userId || friendContext.userId;
  var guildId = params.guildId || friendContext.guildId;
  var surface = params.surface || friendContext.surface;
  var permission = friendPermission.checkAiPermission(userId, guildId, surface);
  if (!permission.allowed) return { success: false, safeMessage: permission.safeMessage, permissionDenied: permission.reason };

  var userMessages = params.messages.filter(function(m) { return m.role === 'user'; });
  var userText = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

  var { canCall, releaseCall, getRateLimitMessage } = require('../lib/rateLimit');
  var { isSilenced, getDeEscalationLine } = require('../features/safety/slurFilter');
  var bucket = params.bucket || 'command';

  if (isSilenced(userId)) {
    return { success: false, safeMessage: getDeEscalationLine() };
  }
  var multiplier = friendPermission.getRateMultiplier(userId, guildId);
  var reservationId = canCall(userId, bucket, multiplier);
  if (!reservationId) {
    return { success: false, safeMessage: getRateLimitMessage(userId, bucket, multiplier) };
  }

  var inputCheck = await moderateInput(userText, params.signal);
  if (inputCheck.action === 'crisis') {
    console.log('[Moderation] Self-harm flagged for user', userId, '— crisis response');
    releaseCall(userId, bucket, reservationId);
    return { success: false, crisis: true };
  }
  if (inputCheck.action === 'block') {
    console.log('[Moderation] Input blocked for user', userId);
    releaseCall(userId, bucket, reservationId);
    return { success: false, safeMessage: getSafeMessage(inputCheck.categories, inputCheck.unavailable) };
  }

  // Per-guild AI spend budget (chat buckets only) — checked AFTER moderation so
  // zero-token blocked calls never consume a slot; releases the per-user slot
  // when the guild is exhausted. budgetExhausted flag lets ambient callers
  // (interjection) skip silently instead of replying the budget message.
  var { tryReserveGuildCall, BUDGETED_BUCKETS } = require('../features/ai/guildBudget');
  if (guildId && BUDGETED_BUCKETS.indexOf(bucket) !== -1) {
    if (!tryReserveGuildCall(guildId)) {
      releaseCall(userId, bucket, reservationId);
      return { success: false, safeMessage: 'This server\'s reached its AI allowance for today. Try again tomorrow.', budgetExhausted: true };
    }
  }

  try {
    var c = getOpenAIClient();
    var apiParams = {
      model: params.model,
      messages: params.messages,
      max_completion_tokens: params.max_tokens,
      temperature: params.temperature,
      moderation: { model: 'omni-moderation-latest' },
    };
    // Pass through extra OpenAI params (response_format, stop, tools, etc.)
    // WARNING: any param consumed internally by the gate (userId, bucket) MUST be in
    // KNOWN or it leaks into the OpenAI request and fails with "Unknown parameter".
    var KNOWN = ['model', 'messages', 'max_tokens', 'temperature', 'userId', 'bucket', 'signal', 'guildId', 'surface'];
    for (var key in params) {
      if (KNOWN.indexOf(key) === -1) apiParams[key] = params[key];
    }
    // GPT-6 Luna requires reasoning_effort=none for Chat Completions function calling.
    if (params.model === 'gpt-6-luna') apiParams.reasoning_effort = 'none';
    var completion = await c.chat.completions.create(apiParams, params.signal ? { signal: params.signal } : undefined);

    var outputMod = completion.moderation && completion.moderation.output;
    if (outputMod && outputMod.results && outputMod.results.length > 0) {
      var r = outputMod.results[0];
      for (var i = 0; i < SELF_HARM_CATS.length; i++) {
        if (r.categories[SELF_HARM_CATS[i]]) {
          console.log('[Moderation] Output flagged (self-harm) for user', userId);
          releaseCall(userId, bucket, reservationId);
          return { success: false, crisis: true };
        }
      }
      if (r.flagged) {
        // Allow violence through — Skarn tells battle stories
        var ALLOWED_OUT = ['violence', 'violence/graphic', 'harassment'];
        var hasBlockedOut = false;
        for (var cat in r.categories) {
          if (r.categories[cat] && ALLOWED_OUT.indexOf(cat) === -1 && SELF_HARM_CATS.indexOf(cat) === -1) {
            hasBlockedOut = true;
            break;
          }
        }
        if (hasBlockedOut) {
          console.log('[Moderation] Output blocked for user', userId);
          releaseCall(userId, bucket, reservationId);
          return { success: false, safeMessage: getSafeMessage(r.categories, false) };
        }
      }
    } else if (outputMod && outputMod.error) {
      console.log('[Moderation] Output moderation error for user', userId, '— failing closed');
      releaseCall(userId, bucket, reservationId);
      return { success: false, safeMessage: getSafeMessage(null, true) };
    } else {
      console.log('[Moderation] Output moderation unavailable for user', userId, '— failing closed');
      releaseCall(userId, bucket, reservationId);
      return { success: false, safeMessage: getSafeMessage(null, true) };
    }

    return { success: true, completion: completion };
  } catch (e) {
    console.error('[Moderation] Generation failed:', e.message);
    releaseCall(userId, bucket, reservationId);
    return { success: false, safeMessage: getSafeMessage(null, true) };
  }
}

module.exports = getOpenAIClient;
module.exports.moderatedChatCompletion = moderatedChatCompletion;
