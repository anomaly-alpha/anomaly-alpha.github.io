// ===== db: channel =====
const { db } = require('./db');

// ===== Server Culture =====

function addNGram(guildId, channelId, ngram) {
  const existing = db.prepare('SELECT frequency FROM server_culture WHERE guild_id = ? AND channel_id = ? AND ngram = ?').get(guildId, channelId, ngram);
  if (existing) {
    db.prepare('UPDATE server_culture SET frequency = frequency + 1, last_seen_at = ? WHERE guild_id = ? AND channel_id = ? AND ngram = ?')
      .run(Date.now(), guildId, channelId, ngram);
  } else {
    db.prepare('INSERT INTO server_culture (guild_id, channel_id, ngram, frequency, first_seen_at, last_seen_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run(guildId, channelId, ngram, Date.now(), Date.now());
  }
}

function getTopNGrams(guildId, channelId, limit) {
  return db.prepare('SELECT ngram, frequency FROM server_culture WHERE guild_id = ? AND channel_id = ? ORDER BY frequency DESC LIMIT ?')
    .all(guildId, channelId, limit || 5);
}

// ===== Sentiment & Climate =====

function getSentimentTrend(channelId, limit) {
  return db.prepare(
    `SELECT m.content, m.sentiment, m.created_at
     FROM conversation_messages m
     JOIN conversation_threads t ON m.thread_id = t.thread_id
     WHERE m.channel_id = ? AND m.role = 'user'
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(channelId, limit || 5);
}

function getServerClimate(guildId) {
  var users = db.prepare(
    'SELECT emotional_state, COUNT(*) as count FROM user_emotional_context WHERE guild_id = ? AND emotional_state != ? GROUP BY emotional_state ORDER BY count DESC'
  ).all(guildId, 'neutral');
  var total = db.prepare(
    "SELECT COUNT(*) as count FROM user_emotional_context WHERE guild_id = ? AND emotional_state != 'neutral'"
  ).get(guildId);
  return { distribution: users, totalDistinct: total ? total.count : 0 };
}

// ===== Attention State =====

function getAttentionState(userId, guildId, channelId) {
  const row = db.prepare('SELECT * FROM attention_state WHERE user_id = ? AND guild_id = ? AND channel_id = ?').get(userId, guildId || '', channelId);
  return row || { last_bot_reply_at: 0, last_bot_channel_msg_at: 0, msgs_since_response: 0, last_user_msg_at: 0 };
}

function resetMsgCount(userId, guildId, channelId) {
  db.prepare('UPDATE attention_state SET msgs_since_response = 0 WHERE user_id = ? AND guild_id = ? AND channel_id = ?').run(userId, guildId || '', channelId);
}

function incrementMsgCount(userId, guildId, channelId) {
  db.prepare('INSERT INTO attention_state (user_id, guild_id, channel_id, msgs_since_response, last_user_msg_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(user_id, guild_id, channel_id) DO UPDATE SET msgs_since_response = msgs_since_response + 1, last_user_msg_at = ?').run(userId, guildId || '', channelId, Date.now(), Date.now());
}

function getChannelActivity(channelId, windowMinutes) {
  const cutoff = Date.now() - (windowMinutes * 60 * 1000);
  const row = db.prepare('SELECT COUNT(*) as count FROM conversation_messages WHERE channel_id = ? AND created_at > ?').get(channelId, cutoff);
  return row ? row.count : 0;
}

// ===== Sentiment Buffers =====

function pruneSentimentBuffers(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM sentiment_buffers WHERE updated_at < ?').run(cutoff);
}

module.exports = {
  addNGram,
  getTopNGrams,
  getSentimentTrend,
  getServerClimate,
  getAttentionState,
  resetMsgCount,
  incrementMsgCount,
  getChannelActivity,
  pruneSentimentBuffers,
};