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

async function moderateInput(text) {
  try {
    var c = getOpenAIClient();
    var result = await c.moderations.create({ model: 'omni-moderation-latest', input: text });
    var r = result.results[0];
    for (var i = 0; i < SELF_HARM_CATS.length; i++) {
      if (r.categories[SELF_HARM_CATS[i]]) return { action: 'crisis' };
    }
    if (r.flagged) return { action: 'block', categories: r.categories };
    return { action: 'pass' };
  } catch (e) {
    console.error('[Moderation] Input check failed:', e.message);
    return { action: 'block', unavailable: true };
  }
}

async function moderatedChatCompletion(params) {
  var userMessages = params.messages.filter(function(m) { return m.role === 'user'; });
  var userText = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

  var inputCheck = await moderateInput(userText);
  if (inputCheck.action === 'crisis') {
    console.log('[Moderation] Self-harm flagged for user', params.userId, '— crisis response');
    return { success: false, crisis: true };
  }
  if (inputCheck.action === 'block') {
    console.log('[Moderation] Input blocked for user', params.userId);
    return { success: false, safeMessage: getSafeMessage(inputCheck.categories, inputCheck.unavailable) };
  }

  try {
    var c = getOpenAIClient();
    var completion = await c.chat.completions.create({
      model: params.model,
      messages: params.messages,
      max_completion_tokens: params.max_tokens,
      temperature: params.temperature,
      moderation: { model: 'omni-moderation-latest' },
    });

    var outputMod = completion.moderation && completion.moderation.output;
    if (outputMod && outputMod.results && outputMod.results.length > 0) {
      var r = outputMod.results[0];
      for (var i = 0; i < SELF_HARM_CATS.length; i++) {
        if (r.categories[SELF_HARM_CATS[i]]) {
          console.log('[Moderation] Output flagged (self-harm) for user', params.userId);
          return { success: false, crisis: true };
        }
      }
      if (r.flagged) {
        console.log('[Moderation] Output blocked for user', params.userId);
        return { success: false, safeMessage: getSafeMessage(r.categories, false) };
      }
    } else if (outputMod && outputMod.error) {
      console.log('[Moderation] Output moderation error for user', params.userId, '— failing closed');
      return { success: false, safeMessage: getSafeMessage(null, true) };
    } else {
      console.log('[Moderation] Output moderation unavailable for user', params.userId, '— failing closed');
      return { success: false, safeMessage: getSafeMessage(null, true) };
    }

    return { success: true, completion: completion };
  } catch (e) {
    console.error('[Moderation] Generation failed:', e.message);
    return { success: false, safeMessage: getSafeMessage(null, true) };
  }
}

module.exports = getOpenAIClient;
module.exports.moderatedChatCompletion = moderatedChatCompletion;
