const {
  db,
  deleteUserMemoryEntries,
  deleteUserConversation,
  forgetUserFromChannelSummaries,
  deleteChannelContextMessagesByAuthor,
} = require('../../db/database');

function forgetUserData(userId, guildId, scope) {
  if (!userId || !guildId) throw new TypeError('userId and guildId are required');
  scope = scope || 'all';
  if (!['memory', 'conversation', 'all'].includes(scope)) throw new TypeError('scope must be memory, conversation, or all');
  const tx = db.transaction(function() {
    if (scope !== 'conversation') deleteUserMemoryEntries(userId, guildId);
    if (scope !== 'memory') {
      deleteUserConversation(userId, guildId);
      db.prepare('DELETE FROM user_relationship WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      db.prepare('DELETE FROM user_emotional_context WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      db.prepare('DELETE FROM emotion_history WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      db.prepare('DELETE FROM relationship_milestones WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      db.prepare('DELETE FROM response_learning WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      db.prepare('DELETE FROM attention_state WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      db.prepare('DELETE FROM banter_chains WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
    }
    // Follow-ups and attributed channel-summary content are memory surfaces for every scope.
    db.prepare('DELETE FROM follow_ups WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
    db.prepare('DELETE FROM callbacks WHERE user_id = ? AND channel_id IN (SELECT channel_id FROM channel_state WHERE guild_id = ?)').run(userId, guildId);
    forgetUserFromChannelSummaries(userId, guildId);
    deleteChannelContextMessagesByAuthor(userId, guildId);
    const ragPrefix = 'rag_' + userId + ':';
    db.prepare('DELETE FROM app_state WHERE substr(key, 1, ?) = ?').run(ragPrefix.length, ragPrefix);
  });
  tx();
}

async function execute(interaction) {
  forgetUserData(interaction.user.id, interaction.guild.id, 'all');
  await interaction.reply({
    content: 'I deleted your personal memories, conversation history, and details attributed to you in channel summaries for this server. Raw channel context expires automatically within seven days.',
    flags: 64,
    allowedMentions: { parse: [] },
  });
}

module.exports = { execute, forgetUserData };
