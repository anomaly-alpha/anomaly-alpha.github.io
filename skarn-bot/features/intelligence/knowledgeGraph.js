const { getMemoryByType, decayMemoryEntries } = require('../../db/database');

function formatKnowledge(userId, guildId) {
  const interests = getMemoryByType(userId, guildId, 'interest', 5);
  const projects = getMemoryByType(userId, guildId, 'project', 3);
  const events = getMemoryByType(userId, guildId, 'event', 3);

  if (!interests.length && !projects.length && !events.length) return '';

  const parts = [];
  if (interests.length > 0) parts.push(`Interests: ${interests.map(e => e.content).join(', ')}`);
  if (projects.length > 0) parts.push(`Projects: ${projects.map(e => `${e.content} (${e.context || 'mentioned'})`).join('; ')}`);
  if (events.length > 0) parts.push(`Life events: ${events.map(e => e.context || e.content).join('; ')}`);

  return parts.join('\n');
}

function runKnowledgeDecay() {
  decayMemoryEntries();
}

module.exports = { formatKnowledge, runKnowledgeDecay };
