const { insertSignal, isOptedOut } = require('./signalStore');

// ===== Reaction spike detection =====
// In-memory counter per message — ephemeral, pruned hourly
const reactionCounters = new Map();
const REACTION_THRESHOLD = 5;
const COUNTER_TTL = 60 * 60 * 1000;

function initReactionTracking(client) {
  client.on('messageReactionAdd', function(reaction, user) {
    if (user.bot) return;
    var message = reaction.message;
    var channel = reaction.message.channel;
    if (!channel || !message.guild) return;

    var stateTracker;
    try { stateTracker = require('../channelState/stateTracker'); } catch(e) { return; }
    var getChannelState = stateTracker.getChannelState;
    if (getChannelState && getChannelState(channel.id) === 'Weathering') return;

    var key = message.guild.id + ':' + channel.id + ':' + message.id;
    var existing = reactionCounters.get(key);
    if (existing) {
      existing.count++;
      if (existing.count === REACTION_THRESHOLD) {
        var summary = (message.content || '').substring(0, 200);
        var authorId = message.author ? message.author.id : null;
        if (authorId && isOptedOut(authorId, message.guild.id)) {
          authorId = null; // anonymize per [S6]
        }
        insertSignal(message.guild.id, channel.id, 'reaction_spike', summary, authorId);
      }
    } else {
      reactionCounters.set(key, { count: 1, firstReactionAt: Date.now() });
    }
  });
}

function pruneReactionCounters() {
  var cutoff = Date.now() - COUNTER_TTL;
  reactionCounters.forEach(function(val, key) {
    if (val.firstReactionAt < cutoff) reactionCounters.delete(key);
  });
}

function logSignal(guildId, channelId, signalType, summaryText, sourceUserId) {
  if (signalType === 'realm_milestone' && sourceUserId) {
    if (isOptedOut(sourceUserId, guildId)) return;
  }
  insertSignal(guildId, channelId, signalType, summaryText, sourceUserId);
}

module.exports = { initReactionTracking, pruneReactionCounters, logSignal };
