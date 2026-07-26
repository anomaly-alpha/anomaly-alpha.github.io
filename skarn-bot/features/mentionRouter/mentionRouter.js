const { canCall } = require('../../lib/rateLimit');
const { canRespond } = require('../../lib/aiStats');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { shouldReactOnly, pickReaction } = require('../authenticity/reactionController');
const { runPipeline } = require('../ai/sharedPipeline');

async function handleMention(message) {
  if (message.author.bot) return;

  // Respect opt-in
  const { canInteract } = require('../proactive/absenceDetector');
  const guildId = message.guild?.id ?? 'dm';
  if (!canInteract(message.author.id, guildId)) return;

  const userId = message.author.id;
  const channelId = message.channel.id;

  // Rate limit
  if (!canCall(userId, 'chat')) {
    await message.reply({ content: require('../../lib/rateLimit').getRateLimitMessage(userId, 'chat'), allowedMentions: { parse: ['users'] } });
    return;
  }

  // Hourly cap
  if (!canRespond(userId)) return;

  // Clean message (remove bot mention)
  const cleanMsg = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!cleanMsg) return;

  // Hostile content check
  const { isHostile, recordStrike, isSilenced, getDeEscalationLine } = require('../safety/slurFilter');
  if (isHostile(cleanMsg)) {
    recordStrike(userId);
    return message.reply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
  }

  if (isSilenced(userId)) return;

  // Reaction-only check (10% chance for casual messages)
  const sentiment = analyzeSentiment(cleanMsg);
  if (shouldReactOnly('casual')) {
    await message.react(pickReaction(sentiment));
    return;
  }

  await runPipeline(
    userId,
    guildId,
    channelId,
    cleanMsg,
    {
      channel: message.channel,
      threadType: 'channel',
      temperature: 0.85,
      chunkSize: 1900,
      roleName: 'consult',
      beforeSentiment: sentiment,

      sendReply: function(text) {
        return message.reply({ content: text, allowedMentions: { parse: ['users'] } });
      },
      sendFollowUp: function(text) {
        return message.channel.send({ content: text, allowedMentions: { parse: ['users'] } });
      },
      editReply: null,
      canEdit: false,
      onCrisis: async function() { /* silent return on crisis */ },
      sendError: function(text) {
        return message.reply({ content: text, allowedMentions: { parse: ['users'] } });
      },
      afterReply: async function() {
        try {
          const db = require('../../db/database');
          db.resetMsgCount(userId, guildId || '', channelId);
          db.upsertAttentionState(userId, guildId || '', channelId, {
            last_bot_reply_at: Date.now(),
            last_bot_channel_msg_at: Date.now(),
          });
        } catch (e) { /* non-critical */ }
      },
    }
  );
}

module.exports = { handleMention };
