const { canRespond } = require('../../lib/aiStats');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { runPipeline } = require('../ai/sharedPipeline');

async function handleMention(message, turnOptions) {
  turnOptions = turnOptions || {};
  if (message.author.bot) return;

  const { checkAiPermission } = require('../friendTiers/friendPermission');
  const permission = checkAiPermission(message.author.id, message.guild?.id, 'mention');
  if (!permission.allowed) {
    await message.reply({ content: permission.safeMessage, allowedMentions: { parse: [] } });
    return false;
  }

  const guildId = message.guild?.id ?? 'dm';
  const userId = message.author.id;
  const channelId = message.channel.id;

  // Clean message (remove bot mention)
  const rawContent = typeof turnOptions.content === 'string' ? turnOptions.content : message.content;
  const cleanMsg = rawContent.replace(/<@!?\d+>/g, '').trim();

  // Hostile content check
  const { isHostile, recordStrike, isSilenced, getDeEscalationLine } = require('../safety/slurFilter');
  if (isHostile(cleanMsg)) {
    recordStrike(userId);
    await message.reply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
    return false;
  }

  if (isSilenced(userId)) return false;

  // Explicit mentions/replies do not count as opt-in, but eligible users get a
  // clear path to enable conversation. Do this after safety checks and without
  // consuming an AI call or hourly AI-response slot.
  const { canInteract } = require('../proactive/absenceDetector');
  if (!canInteract(userId, guildId)) {
    await message.reply({
      content: 'I only join the conversation when you opt in. Say `skarn opt in` to enable replies and occasional check-ins.',
      allowedMentions: { parse: [] },
    });
    return false;
  }
  if (!cleanMsg) return false;

  // Hourly cap
  if (!canRespond(userId)) return false;

  // Direct mentions/replies are explicit requests; don't randomly substitute a reaction.
  const sentiment = analyzeSentiment(cleanMsg);

  return runPipeline(
    userId,
    guildId,
    channelId,
    cleanMsg,
    {
      channel: message.channel,
      sourceMessage: message,
      threadType: 'channel',
      temperature: 0.85,
      chunkSize: 1900,
      roleName: 'consult',
      beforeSentiment: sentiment,
      channelSnapshot: turnOptions.channelSnapshot,
      currentMessageIds: turnOptions.currentMessageIds,
      replyIntent: turnOptions.replyIntent,
      responseTarget: turnOptions.responseTarget,
      beforeSend: turnOptions.beforeSend,

      afterSend: function(sentMessage, content) {
        if (!turnOptions.recordSharedContext) return;
        try { recordSkarnChannelMessage(sentMessage, message, content); }
        catch (e) { console.error('[ChannelContext] Skarn reply capture failed:', e.message); }
      },
      afterFollowUp: function(sentMessage, content) {
        if (!turnOptions.recordSharedContext) return;
        try { recordSkarnChannelMessage(sentMessage, message, content); }
        catch (e) { console.error('[ChannelContext] Skarn follow-up capture failed:', e.message); }
      },

      sendReply: function(text) {
        if (turnOptions.responseTarget === 'unaddressed') {
          return message.channel.send({ content: text, allowedMentions: { parse: [] } });
        }
        if (turnOptions.responseTarget && turnOptions.responseTarget !== userId) {
          return message.channel.send({ content: '<@' + turnOptions.responseTarget + '> ' + text, allowedMentions: { users: [turnOptions.responseTarget] } });
        }
        return message.reply({ content: text, allowedMentions: { users: [userId] } });
      },
      sendFollowUp: function(text) {
        const target = turnOptions.responseTarget || userId;
        return message.channel.send({ content: text, allowedMentions: turnOptions.responseTarget === 'unaddressed' ? { parse: [] } : { users: [target] } });
      },
      editReply: null,
      canEdit: false,
      onCrisis: async function() { /* silent return on crisis */ },
      sendError: function(text) {
        return message.reply({ content: text, allowedMentions: { parse: [] } });
      },
      afterReply: async function() {
        if (turnOptions.responseTarget === 'unaddressed') return;
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

function recordSkarnChannelMessage(sentMessage, sourceMessage, content) {
  if (!sentMessage || !sentMessage.id || typeof content !== 'string') return;
  const database = require('../../db/database');
  const enabledChannels = database.getGuildConfig(sourceMessage.guild.id, 'aiChannels') || [];
  if (!Array.isArray(enabledChannels) || !enabledChannels.includes(sourceMessage.channel.id)) return;
  const botUser = sourceMessage.client && sourceMessage.client.user;
  const botId = botUser && botUser.id;
  if (!botId) return;
  require('../../db/channelContext').insertChannelContextMessage({
    messageId: sentMessage.id,
    guildId: sourceMessage.guild.id,
    channelId: sourceMessage.channel.id,
    authorId: botId,
    authorName: botUser.username || 'Skarn',
    content: content,
    createdAt: sentMessage.createdTimestamp || Date.now(),
    capturedAt: Date.now(),
    referenceMessageId: sentMessage.reference && sentMessage.reference.messageId || null,
    relatedUserId: sourceMessage.author.id,
    isSkarn: true,
  });
}

module.exports = { handleMention };
