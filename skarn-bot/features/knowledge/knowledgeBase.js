const { db } = require('../../db/database');

function searchKnowledge(query) {
  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3);
  if (words.length === 0) return null;
  const ftsQuery = words.join(' AND ');
  try {
    return db.prepare(
      `SELECT k.topic, k.summary, k.source FROM knowledge_fts f JOIN knowledge_base k ON f.rowid = k.id WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 1`
    ).get(ftsQuery) || null;
  } catch {
    return null;
  }
}

function formatKnowledgeSnippet(knowledge) {
  if (!knowledge) return '';
  const sourceIcon = knowledge.source === 'wikipedia' ? '📚' :
    knowledge.source === 'user_taught' ? '👤' : '💡';
  return `${sourceIcon} **${knowledge.topic}**: ${knowledge.summary}`;
}

module.exports = { searchKnowledge, formatKnowledgeSnippet };
