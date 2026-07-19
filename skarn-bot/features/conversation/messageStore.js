const { getActiveThread, createThread, archiveThread, updateThreadActivity, updateThreadSentiment, insertMessage, getThreadMessages, db } = require('../../db/database');
const { analyzeSentiment } = require('./sentimentAnalyzer');
const { extractTopics, estimateTokens } = require('./topicExtractor');

const CHANNEL_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes for channels
const DM_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 hours for DMs

function getInactivityTimeout(threadType) {
  return threadType === 'dm' ? DM_INACTIVITY_MS : CHANNEL_INACTIVITY_MS;
}

async function computeThreadTopics(threadId) {
  const messages = getThreadMessages(threadId);
  if (messages.length === 0) return [];

  const topicCounts = {};
  for (const msg of messages) {
    const topics = JSON.parse(msg.topics || '[]');
    for (const t of topics) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }

  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, weight: count / messages.length, last_seen: Date.now() }));
}

async function findOrCreateThread(userId, guildId, channelId, threadType = 'channel') {
  const existing = getActiveThread(userId, guildId, channelId);
  if (existing) return existing;

  // Archive old thread if exists but expired
  const oldThread = db.prepare(
    'SELECT thread_id FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND archived_at IS NULL ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);

  if (oldThread) {
    const topics = await computeThreadTopics(oldThread.thread_id);
    db.prepare('UPDATE conversation_threads SET topic_tags = ? WHERE thread_id = ?')
      .run(JSON.stringify(topics), oldThread.thread_id);
    archiveThread(oldThread.thread_id);
  }

  return createThread(userId, guildId, channelId, threadType);
}

async function storeMessage(userId, guildId, channelId, role, content, opts = {}) {
  const threadType = opts.threadType || 'channel';
  const thread = await findOrCreateThread(userId, guildId, channelId, threadType);
  const sentiment = analyzeSentiment(content);
  const topics = await extractTopics(content);
  const tokensEst = estimateTokens(content);
  const isQuestion = content.includes('?');

  insertMessage(thread.thread_id, userId, guildId, channelId, role, content, {
    sentiment,
    topics,
    isQuestion,
    tokensEst,
  });

  updateThreadActivity(thread.thread_id);
  updateThreadSentiment(thread.thread_id, sentiment);

  return thread;
}

module.exports = { storeMessage, findOrCreateThread };
