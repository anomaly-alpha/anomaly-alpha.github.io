const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'skarn.db');
const SCHEMA_PATH = path.join(__dirname, 'skarn-schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Run schema on startup
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Migration v1: reset stale opt-in defaults (legacy rows from before opt-in system)
db.prepare("UPDATE user_preferences SET proactive_opt_out = 1 WHERE proactive_opt_out = 0").run();

// ===== User Memory =====

function getUserMemory(userId, guildId, limit = 5) {
  return db.prepare(
    'SELECT fact_text FROM user_memory WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, guildId, limit);
}

function addUserMemory(userId, guildId, factText) {
  db.prepare(
    'INSERT INTO user_memory (user_id, guild_id, fact_text, created_at) VALUES (?, ?, ?, ?)'
  ).run(userId, guildId, factText, Date.now());
}

function deleteUserMemory(userId, guildId) {
  db.prepare('DELETE FROM user_memory WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

// ===== Channel State =====

function getChannelState(channelId, guildId) {
  const row = db.prepare('SELECT * FROM channel_state WHERE channel_id = ?').get(channelId);
  if (row) return row;
  // Create default row
  const now = Date.now();
  db.prepare(
    'INSERT INTO channel_state (channel_id, guild_id, current_state, last_message_at, last_transition_at, recent_message_count, count_window_started_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(channelId, guildId, 'Attentive', now, now, 0, now);
  return db.prepare('SELECT * FROM channel_state WHERE channel_id = ?').get(channelId);
}

function updateChannelState(channelId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(channelId);
  db.prepare(`UPDATE channel_state SET ${sets} WHERE channel_id = ?`).run(...values);
}

// ===== User Relationship =====

function getRelationship(userId, guildId) {
  const row = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (row) return row;
  const now = Date.now();
  db.prepare(
    'INSERT INTO user_relationship (user_id, guild_id, familiarity, banter_level, interaction_count, last_interaction_at, tags, preferred_tone) VALUES (?, ?, 0, ?, 0, ?, ?, ?)'
  ).run(userId, guildId, 'match', now, '[]', 'neutral');
  return db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function updateRelationshipField(userId, guildId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(userId, guildId);
  db.prepare(`UPDATE user_relationship SET ${sets} WHERE user_id = ? AND guild_id = ?`).run(...values);
}

function getGuildInteractionStats(guildId, since) {
  return db.prepare(
    'SELECT COUNT(*) as total_users, AVG(familiarity) as avg_familiarity, SUM(interaction_count) as total_interactions FROM user_relationship WHERE guild_id = ? AND last_interaction_at > ?'
  ).get(guildId, since);
}

// ===== Guild Mood =====

function getGuildMood(guildId) {
  const row = db.prepare('SELECT * FROM guild_mood WHERE guild_id = ?').get(guildId);
  if (row) return row;
  const now = Date.now();
  db.prepare(
    'INSERT INTO guild_mood (guild_id, current_mood, last_activity_at, last_mood_shift_at) VALUES (?, ?, ?, ?)'
  ).run(guildId, 'neutral', now, now);
  return db.prepare('SELECT * FROM guild_mood WHERE guild_id = ?').get(guildId);
}

function updateGuildMood(guildId, mood) {
  db.prepare('INSERT OR REPLACE INTO guild_mood (guild_id, current_mood, last_activity_at, last_mood_shift_at) VALUES (?, ?, ?, ?)')
    .run(guildId, mood, Date.now(), Date.now());
}

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

// ===== User Profile =====

function getUserProfile(userId, guildId) {
  return db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function upsertUserProfile(userId, guildId, data) {
  const existing = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (existing) {
    const keys = Object.keys(data);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    db.prepare(`UPDATE user_profile SET ${sets}, last_profile_update_at = ? WHERE user_id = ? AND guild_id = ?`).run(...values, Date.now(), userId, guildId);
  } else {
    const keys = ['last_profile_update_at', ...Object.keys(data)];
    const values = [Date.now(), ...Object.values(data)];
    db.prepare(`INSERT INTO user_profile (user_id, guild_id, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})`).run(userId, guildId, ...values);
  }
}

// ===== Knowledge Graph =====

const KNOWLEDGE_DECAY = 0.95;
const KNOWLEDGE_DECAY_DAYS = 30;
const KNOWLEDGE_MIN_CONFIDENCE = 0.2;

function addKnowledge(userId, guildId, entityType, entityName, context, confidence) {
  confidence = confidence ?? 0.5;
  const now = Date.now();
  const existing = db.prepare(
    'SELECT id, confidence FROM knowledge_graph WHERE user_id = ? AND guild_id = ? AND entity_type = ? AND entity_name = ?'
  ).get(userId, guildId, entityType, entityName);
  if (existing) {
    const newConf = Math.min(1, existing.confidence + 0.1);
    db.prepare(
      'UPDATE knowledge_graph SET confidence = ?, context = ?, last_seen_at = ? WHERE id = ?'
    ).run(newConf, context ?? existing.context, now, existing.id);
  } else {
    db.prepare(
      'INSERT INTO knowledge_graph (user_id, guild_id, entity_type, entity_name, context, confidence, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, guildId, entityType, entityName, context ?? null, confidence, now, now);
  }
}

function getKnowledge(userId, guildId) {
  return db.prepare(
    'SELECT * FROM knowledge_graph WHERE user_id = ? AND guild_id = ? ORDER BY confidence DESC'
  ).all(userId, guildId);
}

function decayKnowledge() {
  const cutoff = Date.now() - KNOWLEDGE_DECAY_DAYS * 24 * 60 * 60 * 1000;
  db.prepare('UPDATE knowledge_graph SET confidence = confidence * ? WHERE last_seen_at < ?').run(KNOWLEDGE_DECAY, cutoff);
  db.prepare('DELETE FROM knowledge_graph WHERE confidence < ?').run(KNOWLEDGE_MIN_CONFIDENCE);
  return db.prepare('SELECT changes()').get();
}

// ===== User Preferences =====

function getUserPreferences(userId, guildId) {
  const row = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (row) return row;
  db.prepare(
    'INSERT INTO user_preferences (user_id, guild_id, proactive_opt_in) VALUES (?, ?, 0)'
  ).run(userId, guildId);
  return db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function setUserPreference(userId, guildId, key, value) {
  const validKeys = ['proactive_opt_in', 'preferred_tone', 'max_response_length', 'allow_nickname', 'nickname', 'timezone'];
  if (!validKeys.includes(key)) return;
  // Upsert: ensure row exists first
  getUserPreferences(userId, guildId);
  db.prepare(`UPDATE user_preferences SET ${key} = ? WHERE user_id = ? AND guild_id = ?`).run(value, userId, guildId);
}

// ===== Follow Ups =====

function createFollowUp(userId, guildId, channelId, topic, context, dueAfter) {
  const result = db.prepare(
    'INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, channelId, topic, context ?? null, Date.now(), Date.now() + dueAfter);
  return { id: result.lastInsertRowid };
}

function getPendingFollowUps() {
  return db.prepare(
    "SELECT * FROM follow_ups WHERE due_after < ? AND status = 'pending'"
  ).all(Date.now());
}

function markFollowUpSent(id) {
  db.prepare("UPDATE follow_ups SET status = 'sent', sent_at = ? WHERE id = ?").run(Date.now(), id);
}

// ===== Relationship Milestones =====

function addMilestone(userId, guildId, type, name, context) {
  const result = db.prepare(
    'INSERT INTO relationship_milestones (user_id, guild_id, milestone_type, milestone_name, achieved_at, context) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, type, name, Date.now(), context ?? null);
  return { id: result.lastInsertRowid };
}

function getMilestones(userId, guildId) {
  return db.prepare(
    'SELECT * FROM relationship_milestones WHERE user_id = ? AND guild_id = ? ORDER BY achieved_at DESC'
  ).all(userId, guildId);
}

// ===== Pruning =====

function pruneOldMessages(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
}

// ===== Privacy =====

function deleteUserConversation(userId, guildId) {
  const threads = db.prepare('SELECT thread_id FROM conversation_threads WHERE user_id = ? AND guild_id = ?').all(userId, guildId);
  for (const t of threads) {
    db.prepare('DELETE FROM conversation_messages WHERE thread_id = ?').run(t.thread_id);
    db.prepare('DELETE FROM conversation_summaries WHERE thread_id = ?').run(t.thread_id);
    db.prepare('DELETE FROM conversation_fts WHERE thread_id = ?').run(t.thread_id);
  }
  db.prepare('DELETE FROM conversation_threads WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
  db.prepare('DELETE FROM user_profile WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

// ===== Full-Text Search =====

function searchConversations(query, guildId, limit = 10) {
  if (!query || query.length < 2) return [];
  // Escape special FTS5 characters
  const safe = query.replace(/['"()*^$~`]/g, '').trim();
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

// ===== Knowledge Base =====

function addKnowledgeBase(topic, summary, source, confidence) {
  const now = Date.now();
  confidence = confidence ?? 0.5;
  db.prepare(
    `INSERT INTO knowledge_base (topic, summary, source, confidence, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, '[]', ?, ?)
     ON CONFLICT(topic) DO UPDATE SET
       summary = excluded.summary,
       source = excluded.source,
       confidence = excluded.confidence,
       updated_at = excluded.updated_at`
  ).run(topic, summary, source ?? null, confidence, now, now);
  // Sync to FTS
  const row = db.prepare('SELECT id FROM knowledge_base WHERE topic = ?').get(topic);
  if (row) {
    try {
      db.prepare('DELETE FROM knowledge_fts WHERE rowid = ?').run(row.id);
      db.prepare('INSERT INTO knowledge_fts (rowid, topic, summary) VALUES (?, ?, ?)').run(row.id, topic, summary);
    } catch {
      // FTS sync is best-effort
    }
  }
}

function searchKnowledgeBase(query) {
  if (!query || query.length < 2) return [];
  const safe = query.replace(/['"()*^$~`]/g, '').trim();
  if (!safe) return [];
  return db.prepare(
    `SELECT k.* FROM knowledge_fts f
     JOIN knowledge_base k ON f.rowid = k.id
     WHERE knowledge_fts MATCH ?
     ORDER BY k.confidence DESC`
  ).all(safe);
}

function getKnowledgeBase(topic) {
  return db.prepare('SELECT * FROM knowledge_base WHERE topic = ?').get(topic);
}

// ===== User Emotional Context =====

function getUserEmotion(userId, guildId) {
  return db.prepare(
    'SELECT * FROM user_emotional_context WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
}

function setUserEmotion(userId, guildId, state) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO user_emotional_context (user_id, guild_id, emotional_state, topics_emotional, last_mood_check)
     VALUES (?, ?, ?, '{}', ?)
     ON CONFLICT(user_id, guild_id) DO UPDATE SET
       emotional_state = excluded.emotional_state,
       topics_emotional = excluded.topics_emotional,
       last_mood_check = excluded.last_mood_check`
  ).run(userId, guildId, state, now);
}

// ===== Skarn Stories =====

function addStory(topic, storyText) {
  const result = db.prepare(
    'INSERT INTO skarn_stories (topic, story_text, created_at) VALUES (?, ?, ?)'
  ).run(topic, storyText, Date.now());
  return { id: result.lastInsertRowid };
}

function getStoriesByTopic(topic) {
  return db.prepare(
    'SELECT * FROM skarn_stories WHERE topic = ? ORDER BY created_at DESC'
  ).all(topic);
}

function incrementStoryUse(storyId) {
  db.prepare(
    'UPDATE skarn_stories SET used_count = used_count + 1, last_used_at = ? WHERE id = ?'
  ).run(Date.now(), storyId);
}

// ===== Memory Entries =====

function addMemoryEntry(userId, guildId, source, type, content, confidence, context) {
  const now = Date.now();
  const existing = db.prepare(
    'SELECT id, confidence, context FROM memory_entries WHERE user_id = ? AND guild_id = ? AND type = ? AND content = ?'
  ).get(userId, guildId, type, content);
  if (existing) {
    const newConf = source === 'etch' ? 1.0 : Math.min(1, existing.confidence + 0.1);
    db.prepare(
      'UPDATE memory_entries SET confidence = ?, context = ?, last_seen_at = ?, updated_at = ? WHERE id = ?'
    ).run(newConf, context ?? existing.context, now, now, existing.id);
    return;
  }
  db.prepare(
    'INSERT INTO memory_entries (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, source, type, content, confidence, context ?? null, now, now, now);
}

function getMemoryEntries(userId, guildId, limit = 10) {
  return db.prepare(
    'SELECT * FROM memory_entries WHERE user_id = ? AND guild_id = ? ORDER BY confidence DESC, last_seen_at DESC LIMIT ?'
  ).all(userId, guildId, limit);
}

function getMemoryByType(userId, guildId, type, limit = 5) {
  return db.prepare(
    'SELECT * FROM memory_entries WHERE user_id = ? AND guild_id = ? AND type = ? ORDER BY confidence DESC, last_seen_at DESC LIMIT ?'
  ).all(userId, guildId, type, limit);
}

function deleteUserMemoryEntries(userId, guildId) {
  db.prepare('DELETE FROM memory_entries WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

function decayMemoryEntries() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  db.prepare("UPDATE memory_entries SET confidence = confidence * 0.95 WHERE source = 'extracted' AND last_seen_at < ?").run(cutoff);
  db.prepare("DELETE FROM memory_entries WHERE source = 'extracted' AND confidence < 0.2").run();
  return db.prepare('SELECT changes()').get();
}

// ===== Rate Limits =====

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 10;

function canMakeCall(userId) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  const count = db.prepare('SELECT COUNT(*) as count FROM rate_limits WHERE user_id = ? AND timestamp > ?').get(userId, cutoff);
  return count.count < RATE_LIMIT_MAX_CALLS;
}

function recordCall(userId) {
  db.prepare('INSERT INTO rate_limits (user_id, timestamp) VALUES (?, ?)').run(userId, Date.now());
}

function pruneRateLimits() {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  db.prepare('DELETE FROM rate_limits WHERE timestamp < ?').run(cutoff);
}

// ===== Cooldowns =====

function checkMentionCooldown(userId, channelId) {
  const row = db.prepare('SELECT expires_at FROM mention_cooldowns WHERE user_id = ? AND channel_id = ?').get(userId, channelId);
  return row && row.expires_at > Date.now();
}

function setMentionCooldown(userId, channelId, ttlMs = 1000) {
  db.prepare('INSERT OR REPLACE INTO mention_cooldowns (user_id, channel_id, expires_at) VALUES (?, ?, ?)').run(userId, channelId, Date.now() + ttlMs);
}

function checkInterjectionCooldown(channelId) {
  const row = db.prepare('SELECT expires_at FROM interjection_cooldowns WHERE channel_id = ?').get(channelId);
  return row && row.expires_at > Date.now();
}

function setInterjectionCooldown(channelId, ttlMs = 300000) {
  db.prepare('INSERT OR REPLACE INTO interjection_cooldowns (channel_id, expires_at) VALUES (?, ?)').run(channelId, Date.now() + ttlMs);
}

function checkActiveListenCooldown(channelId) {
  const row = db.prepare('SELECT expires_at FROM active_listen_cooldowns WHERE channel_id = ?').get(channelId);
  return row && row.expires_at > Date.now();
}

function setActiveListenCooldown(channelId, ttlMs = 300000) {
  db.prepare('INSERT OR REPLACE INTO active_listen_cooldowns (channel_id, expires_at) VALUES (?, ?)').run(channelId, Date.now() + ttlMs);
}

// ===== Sentiment Buffers =====

function getSentimentBuffer(channelId) {
  const row = db.prepare('SELECT messages FROM sentiment_buffers WHERE channel_id = ?').get(channelId);
  return row ? JSON.parse(row.messages) : [];
}

function pushSentimentBuffer(channelId, content, maxSize = 5) {
  const existing = getSentimentBuffer(channelId);
  existing.push(content);
  if (existing.length > maxSize) existing.shift();
  db.prepare('INSERT OR REPLACE INTO sentiment_buffers (channel_id, messages, updated_at) VALUES (?, ?, ?)').run(channelId, JSON.stringify(existing), Date.now());
}

function pruneSentimentBuffers(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM sentiment_buffers WHERE updated_at < ?').run(cutoff);
}

// ===== App Flags =====

function setFlag(key, value, ttlMs) {
  try {
    db.prepare('INSERT OR REPLACE INTO app_flags (flag_key, flag_value, created_at, expires_at) VALUES (?, ?, ?, ?)').run(key, value, Date.now(), ttlMs ? Date.now() + ttlMs : null);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

function getFlag(key) {
  try {
    const row = db.prepare('SELECT flag_value FROM app_flags WHERE flag_key = ? AND (expires_at IS NULL OR expires_at > ?)').get(key, Date.now());
    return row ? row.flag_value : null;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return null;
    throw e;
  }
}

function deleteFlag(key) {
  try {
    db.prepare('DELETE FROM app_flags WHERE flag_key = ?').run(key);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

function hasFlag(key) {
  try {
    const row = db.prepare('SELECT 1 FROM app_flags WHERE flag_key = ? AND (expires_at IS NULL OR expires_at > ?)').get(key, Date.now());
    return !!row;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return false;
    throw e;
  }
}

function pruneExpiredFlags() {
  try {
    db.prepare('DELETE FROM app_flags WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

// ===== App State =====

function getAppState(key) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setAppState(key, value) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, Date.now());
}

// ===== Banter Chains =====

function getBanterChain(userId, guildId, channelId) {
  return db.prepare('SELECT * FROM banter_chains WHERE user_id = ? AND guild_id = ? AND channel_id = ? ORDER BY last_active_at DESC LIMIT 1').get(userId, guildId, channelId);
}

function upsertBanterChain(userId, guildId, channelId, chainData) {
  const existing = getBanterChain(userId, guildId, channelId);
  const now = Date.now();
  if (existing) {
    db.prepare('UPDATE banter_chains SET chain_data = ?, last_active_at = ? WHERE id = ?').run(chainData, now, existing.id);
  } else {
    db.prepare('INSERT INTO banter_chains (user_id, guild_id, channel_id, chain_data, started_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, guildId, channelId, chainData, now, now);
  }
}

function pruneBanterChains(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM banter_chains WHERE last_active_at < ?').run(cutoff);
}

// ===== Callbacks =====

function addCallback(channelId, userId, message) {
  db.prepare('INSERT INTO callbacks (channel_id, user_id, message, created_at) VALUES (?, ?, ?, ?)').run(channelId, userId, message, Date.now());
}

function getCallbacks(channelId, limit = 5) {
  return db.prepare('SELECT * FROM callbacks WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?').all(channelId, limit);
}

function pruneCallbacks(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM callbacks WHERE created_at < ?').run(cutoff);
}

module.exports = {
  db,
  getUserMemory,
  addUserMemory,
  deleteUserMemory,
  getChannelState,
  updateChannelState,
  getRelationship,
  updateRelationshipField,
  getGuildInteractionStats,
  getGuildMood,
  updateGuildMood,
  addNGram,
  getTopNGrams,
  getActiveThread,
  createThread,
  archiveThread,
  updateThreadActivity,
  updateThreadSentiment,
  insertMessage,
  getRecentMessages,
  insertSummary,
  getOlderSummaries,
  getThreadsNeedingSummary,
  getThreadMessages,
  updateThreadSummary,
  getUserProfile,
  upsertUserProfile,
  pruneOldMessages,
  deleteUserConversation,
  searchConversations,
  getConversationStats,
  addKnowledge,
  getKnowledge,
  decayKnowledge,
  getUserPreferences,
  setUserPreference,
  createFollowUp,
  getPendingFollowUps,
  markFollowUpSent,
  addMilestone,
  getMilestones,
  addKnowledgeBase,
  searchKnowledgeBase,
  getKnowledgeBase,
  getUserEmotion,
  setUserEmotion,
  addStory,
  getStoriesByTopic,
  incrementStoryUse,
  addMemoryEntry,
  getMemoryEntries,
  getMemoryByType,
  deleteUserMemoryEntries,
  decayMemoryEntries,
  canMakeCall,
  recordCall,
  pruneRateLimits,
  checkMentionCooldown,
  setMentionCooldown,
  checkInterjectionCooldown,
  setInterjectionCooldown,
  checkActiveListenCooldown,
  setActiveListenCooldown,
  getSentimentBuffer,
  pushSentimentBuffer,
  pruneSentimentBuffers,
  setFlag,
  getFlag,
  deleteFlag,
  hasFlag,
  pruneExpiredFlags,
  getAppState,
  setAppState,
  getBanterChain,
  upsertBanterChain,
  pruneBanterChains,
  addCallback,
  getCallbacks,
  pruneCallbacks,
};
