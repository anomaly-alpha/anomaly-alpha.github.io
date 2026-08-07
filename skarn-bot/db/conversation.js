// ===== db: conversation =====
const { db, sanitizeFtsQuery } = require('./db');

// ===== Conversation Threads =====

const CHANNEL_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes for channels
const DM_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 hours for DMs

function getActiveThread(userId, guildId, channelId) {
  const now = Date.now();
  const row = db.prepare(
    'SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND archived_at IS NULL ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);
  if (!row) return null;

  const timeout = row.thread_type === 'dm' ? DM_INACTIVITY_MS : CHANNEL_INACTIVITY_MS;
  if ((now - row.last_active_at) < timeout) return row;
  return null;
}

function createThread(userId, guildId, channelId, threadType) {
  const threadId = `thread_${userId}_${guildId}_${Date.now()}`;
  const now = Date.now();
  db.prepare(
    'INSERT INTO conversation_threads (thread_id, user_id, guild_id, channel_id, thread_type, started_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(threadId, userId, guildId, channelId, threadType, now, now);
  return { thread_id: threadId, user_id: userId, guild_id: guildId, channel_id: channelId, thread_type: threadType, started_at: now, last_active_at: now };
}

function archiveThread(threadId) {
  db.prepare('UPDATE conversation_threads SET archived_at = ? WHERE thread_id = ?').run(Date.now(), threadId);
}

function updateThreadActivity(threadId) {
  db.prepare('UPDATE conversation_threads SET last_active_at = ?, message_count = message_count + 1 WHERE thread_id = ?').run(Date.now(), threadId);
}

function updateThreadSentiment(threadId, sentiment) {
  const row = db.prepare('SELECT sentiment_start FROM conversation_threads WHERE thread_id = ?').get(threadId);
  if (row && row.sentiment_start === null) {
    db.prepare('UPDATE conversation_threads SET sentiment_start = ? WHERE thread_id = ?').run(sentiment, threadId);
  }
  db.prepare('UPDATE conversation_threads SET sentiment_end = ? WHERE thread_id = ?').run(sentiment, threadId);
}

// ===== Conversation Messages =====

function insertMessage(threadId, userId, guildId, channelId, role, content, opts = {}) {
  const { sentiment = 0, topics = [], isQuestion = false, tokensEst = 0 } = opts;
  const result = db.prepare(
    'INSERT INTO conversation_messages (thread_id, user_id, guild_id, channel_id, role, content, sentiment, topics, is_question, tokens_est, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(threadId, userId, guildId, channelId, role, content, sentiment, JSON.stringify(topics), isQuestion ? 1 : 0, tokensEst, Date.now());

  // Index in FTS for search (best effort)
  try {
    db.prepare(
      'INSERT INTO conversation_fts (rowid, content, thread_id, user_id, guild_id, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(result.lastInsertRowid, content, threadId, userId, guildId, role);
  } catch {
    // FTS may fail if not created yet — silently continue
  }

  return result;
}

function getRecentMessages(userId, guildId, channelId, limit = 20, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return db.prepare(
    `SELECT m.* FROM conversation_messages m
     JOIN conversation_threads t ON m.thread_id = t.thread_id
     WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ?
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(userId, guildId, channelId, cutoff, limit).reverse();
}

// Matches the inline full-tier/lightweight queries in promptContext.js: includes
// the user's own messages AND assistant replies (getRecentMessages above filters
// only user_id — it cannot express the role OR clause without changing reads).
function getRecentAssistantOrUserMessages(userId, guildId, channelId, limit = 15, maxAgeMs = 365 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return db.prepare(
    `SELECT m.* FROM conversation_messages m
     JOIN conversation_threads t ON m.thread_id = t.thread_id
     WHERE m.guild_id = ? AND m.channel_id = ? AND (m.role = ? OR m.user_id = ?) AND m.created_at > ?
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(guildId, channelId, 'assistant', userId, cutoff, limit).reverse();
}

// Server buzz: recent user messages guild-wide (matches promptContext.js 7-day window).
function getServerBuzz(guildId, sinceMs, limit = 10) {
  return db.prepare(
    'SELECT content FROM conversation_messages WHERE guild_id = ? AND created_at > ? AND role = ? ORDER BY created_at DESC LIMIT ?'
  ).all(guildId, sinceMs, 'user', limit);
}

// ===== Conversation Summaries =====

function insertSummary(threadId, summaryText, coversFrom, coversTo, messageCount) {
  db.prepare(
    'INSERT INTO conversation_summaries (thread_id, summary_text, covers_from, covers_to, message_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(threadId, summaryText, coversFrom, coversTo, messageCount, Date.now());
}

function getOlderSummaries(userId, guildId, channelId, limit = 3) {
  return db.prepare(
    `SELECT s.* FROM conversation_summaries s
     JOIN conversation_threads t ON s.thread_id = t.thread_id
     WHERE t.user_id = ? AND t.guild_id = ? AND t.channel_id = ?
     ORDER BY s.covers_to DESC LIMIT ?`
  ).all(userId, guildId, channelId, limit);
}

function getThreadsNeedingSummary(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  return db.prepare(
    'SELECT * FROM conversation_threads WHERE archived_at IS NOT NULL AND archived_at < ? AND topic_summary IS NULL AND message_count >= 3'
  ).all(cutoff);
}

function getThreadMessages(threadId) {
  return db.prepare('SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at').all(threadId);
}

function updateThreadSummary(threadId, summaryText) {
  db.prepare('UPDATE conversation_threads SET topic_summary = ? WHERE thread_id = ?').run(summaryText, threadId);
}

// ===== Pruning =====

function pruneOldMessages(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  const stale = db.prepare('SELECT id FROM conversation_messages WHERE created_at < ?').all(cutoff);
  const tx = db.transaction(() => {
    // Clear referencing rows first — FK enforcement throws otherwise
    db.prepare('DELETE FROM conversation_embeddings WHERE message_id IN (SELECT id FROM conversation_messages WHERE created_at < ?)').run(cutoff);
    db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
    db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
    // Keep FTS in sync — orphaned FTS rows break /find
    for (const row of stale) {
      db.prepare('DELETE FROM conversation_fts WHERE rowid = ?').run(row.id);
    }
  });
  tx();
}

// ===== Privacy =====

function deleteUserConversation(userId, guildId) {
  const threads = db.prepare('SELECT thread_id FROM conversation_threads WHERE user_id = ? AND guild_id = ?').all(userId, guildId);
  const tx = db.transaction(() => {
    for (const t of threads) {
      db.prepare(
        'DELETE FROM conversation_embeddings WHERE message_id IN (SELECT id FROM conversation_messages WHERE thread_id = ?)'
      ).run(t.thread_id);
      db.prepare('DELETE FROM conversation_messages WHERE thread_id = ?').run(t.thread_id);
      db.prepare('DELETE FROM conversation_summaries WHERE thread_id = ?').run(t.thread_id);
      db.prepare('DELETE FROM conversation_fts WHERE thread_id = ?').run(t.thread_id);
    }
    db.prepare('DELETE FROM conversation_threads WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
    db.prepare('DELETE FROM user_profile WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
  });
  tx();
}

// ===== Full-Text Search =====

function searchConversations(query, guildId, limit = 10) {
  if (!query || query.length < 2) return [];
  const safe = sanitizeFtsQuery(query);
  if (!safe) return [];
  return db.prepare(
    `SELECT c.id, c.content, c.role, c.user_id, c.created_at, c.thread_id
     FROM conversation_fts f
     JOIN conversation_messages c ON f.rowid = c.id
     WHERE f.guild_id = ? AND conversation_fts MATCH ?
     ORDER BY c.created_at DESC LIMIT ?`
  ).all(guildId, safe, limit);
}

// ===== Conversation Stats =====

function getConversationStats(userId, guildId) {
  const totalMessages = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const firstMessage = db.prepare(
    'SELECT MIN(created_at) as first_seen FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const questionCount = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND role = ? AND is_question = 1'
  ).get(userId, guildId, 'user');

  const byChannel = db.prepare(
    'SELECT channel_id, COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ? GROUP BY channel_id ORDER BY count DESC LIMIT 5'
  ).all(userId, guildId);

  const topWords = db.prepare(
    `SELECT c.content FROM conversation_messages c WHERE c.user_id = ? AND c.guild_id = ? AND c.role = 'user' ORDER BY c.created_at DESC LIMIT 500`
  ).all(userId, guildId);

  return { totalMessages, firstMessage, questionCount, byChannel, topWords };
}

// ===== Conversation Embeddings (RAG) =====

function saveEmbedding(messageId, embedding) {
  try {
    db.prepare('INSERT OR REPLACE INTO conversation_embeddings (message_id, embedding, created_at) VALUES (?, ?, ?)')
      .run(messageId, Buffer.from(JSON.stringify(embedding)), Date.now());
  } catch (e) {
    console.error('[Embedding] Save failed:', e.message);
  }
}

function getEmbedding(messageId) {
  const row = db.prepare('SELECT embedding FROM conversation_embeddings WHERE message_id = ?').get(messageId);
  if (!row) return null;
  try { return JSON.parse(row.embedding.toString()); } catch { return null; }
}

function getRecentMessageEmbeddings(guildId, limit) {
  return db.prepare(
    `SELECT e.message_id, e.embedding, m.content, m.user_id, m.created_at, m.role
     FROM conversation_embeddings e
     JOIN conversation_messages m ON e.message_id = m.id
     WHERE m.guild_id = ? AND m.role = 'user'
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(guildId, limit || 100);
}

module.exports = {
  getActiveThread,
  createThread,
  archiveThread,
  updateThreadActivity,
  updateThreadSentiment,
  insertMessage,
  getRecentMessages,
  getRecentAssistantOrUserMessages,
  getServerBuzz,
  insertSummary,
  getOlderSummaries,
  getThreadsNeedingSummary,
  getThreadMessages,
  updateThreadSummary,
  pruneOldMessages,
  deleteUserConversation,
  searchConversations,
  getConversationStats,
  saveEmbedding,
  getEmbedding,
  getRecentMessageEmbeddings,
};