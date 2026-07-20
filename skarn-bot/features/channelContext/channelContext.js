const { db } = require('../../db/database');

function getChannelActivity(guildId, channelId, excludeUserId) {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes ago
  const rows = db.prepare(`
    SELECT user_id, content FROM conversation_messages
    WHERE guild_id = ? AND channel_id = ? AND user_id != ? AND role = 'user' AND created_at > ?
    ORDER BY created_at DESC LIMIT 10
  `).all(guildId, channelId, excludeUserId, cutoff).reverse();

  if (rows.length === 0) return '';

  return 'Channel activity:\n' + rows.map(function(r) {
    return '<@' + r.user_id.slice(0, 4) + '>: ' + r.content.slice(0, 100);
  }).join('\n');
}

module.exports = { getChannelActivity };
