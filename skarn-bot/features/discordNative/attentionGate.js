var getOpenAIClient = require('../../ai/client');
var db = require('../../db/database');
var detectEmotion = require('../../features/wisdom/emotionalIntelligence').detectEmotion;

var RECENCY_MS = 120000;      // 2 min
var CHANNEL_WARM_MS = 30000;  // 30s

async function shouldRespond(message, client) {
  if (!message.content) return false;

  // === Early-exit signals (always respond) ===

  // 1. Reply-to-bot — user explicitly replied to one of Skarn's messages
  if (message.reference && message.reference.messageId) {
    try {
      var refMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (refMsg.author.id === client.user.id) return true;
    } catch (e) { /* ignore fetch failure */ }
  }

  var userId = message.author.id;
  var guildId = message.guild ? message.guild.id : '';
  var channelId = message.channel.id;
  var state = db.getAttentionState(userId, guildId, channelId);
  if (!state) state = { last_bot_reply_at: 0, last_bot_channel_msg_at: 0, msgs_since_response: 0 };
  var now = Date.now();

  // 2. Recency boost — bot responded to this user within 2 min
  if (state.last_bot_reply_at > 0 && (now - state.last_bot_reply_at) < RECENCY_MS) return true;

  // 3. Channel warm — bot spoke in this channel within 30s
  if (state.last_bot_channel_msg_at > 0 && (now - state.last_bot_channel_msg_at) < CHANNEL_WARM_MS) return true;

  // === Stacking signals (probability-based) ===
  var probability = 0.0;
  var content = message.content;

  // Question/skarn heuristic
  if (content.includes('?') || /\bskarn\b/i.test(content)) probability += 0.6;

  // Message count escalation — 0.6 at 3 msgs, 1.0 at 5
  var escalation = Math.min((state.msgs_since_response || 0) / 5, 1.0);
  probability += escalation;

  // Channel activity decay — slow channels get a boost
  try {
    var activity = db.getChannelActivity(channelId, 30) || 0;
    var rate = activity / 30;
    var decay = Math.max(0, 0.3 - (rate * 0.1));
    probability += decay;
  } catch (e) { /* ignore */ }

  // Sentiment boost — reuse existing emotion detection
  try {
    if (detectEmotion) {
      var detected = detectEmotion(content);
      if (['angry', 'stressed', 'sad'].includes(detected)) probability += 0.4;
      else if (detected === 'anxious') probability += 0.2;
    }
  } catch (e) { /* ignore */ }

  if (Math.random() < Math.min(probability, 1.0)) return true;

  // === Fallback: tiny AI YES/NO call ===
  try {
    var openai = getOpenAIClient();
    var completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: 'A Discord bot is watching a channel. Message: "' + content.slice(0, 200) + '". Would the bot have something relevant to say? Answer only YES or NO.'
      }],
      max_tokens: 5,
      temperature: 0.1,
    });
    return completion.choices[0].message.content.trim() === 'YES';
  } catch {
    return false;
  }
}

module.exports = { shouldRespond };
