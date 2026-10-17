const { db } = require('../../db/database');
const { randomUUID } = require('crypto');

function getThread(userId) {
  return db.prepare('SELECT * FROM confidant_threads WHERE user_id = ?').get(userId) || null;
}

function createThread(userId, guildId, now = Date.now()) {
  db.prepare('INSERT INTO confidant_threads (user_id, thread_id, status, origin_guild_id, started_at, last_interaction_at, message_count, last_grounding_at, running_summary) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
    .run(userId, randomUUID(), 'active', guildId, now, now, now, '');
  return getThread(userId);
}

function setStatus(userId, status) {
  if (!['active', 'paused', 'ended'].includes(status)) throw new Error('Invalid Confidant status');
  db.prepare('UPDATE confidant_threads SET status = ? WHERE user_id = ?').run(status, userId);
}

function appendMessage(userId, role, content, now = Date.now()) {
  if (!['user', 'skarn'].includes(role)) throw new Error('Invalid Confidant message role');
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO confidant_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(userId, role, content, now);
    db.prepare('UPDATE confidant_threads SET message_count = message_count + 1, last_interaction_at = ? WHERE user_id = ?').run(now, userId);
  });
  tx();
}

function appendExchange(userId, userContent, assistantContent, now = Date.now(), expectedThread) {
  const tx = db.transaction(() => {
    const current = db.prepare('SELECT status, started_at, origin_guild_id FROM confidant_threads WHERE user_id = ?').get(userId);
    if (!current || current.status !== 'active') return false;
    if (expectedThread && current.thread_id !== expectedThread.thread_id) return false;
    db.prepare('INSERT INTO confidant_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(userId, 'user', userContent, now);
    db.prepare('INSERT INTO confidant_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(userId, 'skarn', assistantContent, now + 1);
    db.prepare('UPDATE confidant_threads SET message_count = message_count + 2, last_interaction_at = ? WHERE user_id = ?').run(now, userId);
    return true;
  });
  return tx();
}

function getRecentMessages(userId, limit = 20) {
  return db.prepare('SELECT role, content, created_at FROM confidant_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit).reverse();
}

function getOldestMessages(userId, limit = 20) {
  return db.prepare('SELECT id, role, content, created_at FROM confidant_messages WHERE user_id = ? ORDER BY id ASC LIMIT ?').all(userId, limit);
}

function getStoredMessageCount(userId) {
  return db.prepare('SELECT COUNT(*) AS count FROM confidant_messages WHERE user_id = ?').get(userId).count;
}

function updateSummary(userId, summary, removeThroughId, expectedThread) {
  const tx = db.transaction(() => {
    const current = db.prepare('SELECT status, started_at, origin_guild_id FROM confidant_threads WHERE user_id = ?').get(userId);
    if (!current || current.status !== 'active') return false;
    if (expectedThread && current.thread_id !== expectedThread.thread_id) return false;
    db.prepare('UPDATE confidant_threads SET running_summary = ? WHERE user_id = ?').run(summary, userId);
    if (removeThroughId) db.prepare('DELETE FROM confidant_messages WHERE user_id = ? AND id <= ?').run(userId, removeThroughId);
    return true;
  });
  return tx();
}

function setLastGroundingAt(userId, at) {
  db.prepare('UPDATE confidant_threads SET last_grounding_at = ? WHERE user_id = ?').run(at, userId);
}

function setLastProactiveAt(userId, at) {
  db.prepare('UPDATE confidant_threads SET last_proactive_at = ? WHERE user_id = ?').run(at, userId);
}

function getActiveThreads() {
  return db.prepare("SELECT * FROM confidant_threads WHERE status = 'active'").all();
}

function deleteThread(userId) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM confidant_messages WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM confidant_threads WHERE user_id = ?').run(userId);
  });
  tx();
}

function resetThread(userId, guildId, now = Date.now()) {
  deleteThread(userId);
  return createThread(userId, guildId, now);
}

module.exports = { getThread, createThread, setStatus, appendMessage, appendExchange, getRecentMessages, getOldestMessages, getStoredMessageCount, updateSummary, setLastGroundingAt, setLastProactiveAt, getActiveThreads, deleteThread, resetThread };
