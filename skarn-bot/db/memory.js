// ===== db: memory =====
const { db, sanitizeFtsQuery } = require('./db');

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

function getUserFacts(userId, guildId, limit = 5) {
  return db.prepare(
    "SELECT content, confidence FROM memory_entries WHERE user_id = ? AND guild_id = ? AND source = 'etch' AND type = 'fact' ORDER BY updated_at DESC LIMIT ?"
  ).all(userId, guildId, limit);
}

function getExtractedEntities(userId, guildId, limit = 20) {
  return db.prepare(
    "SELECT content, confidence, type FROM memory_entries WHERE user_id = ? AND guild_id = ? AND source = 'extracted' ORDER BY confidence DESC, last_seen_at DESC LIMIT ?"
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
  const safe = sanitizeFtsQuery(query);
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

module.exports = {
  addMemoryEntry,
  getMemoryEntries,
  getUserFacts,
  getExtractedEntities,
  getMemoryByType,
  deleteUserMemoryEntries,
  decayMemoryEntries,
  addKnowledgeBase,
  searchKnowledgeBase,
  getKnowledgeBase,
};