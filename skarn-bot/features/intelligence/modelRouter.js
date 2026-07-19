const { getKnowledge } = require('../../db/database');

function selectModel(userMessage, hasKnowledgeMatch) {
  if (hasKnowledgeMatch) return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  if (userMessage && userMessage.length > 100 &&
      (userMessage.includes('?') || userMessage.toLowerCase().includes('explain'))) {
    return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  }
  return process.env.AI_MODEL || 'gpt-3.5-turbo';
}

function checkKnowledgeMatch(userId, guildId, userMessage) {
  if (!userId || !guildId || !userMessage) return false;
  const entities = getKnowledge(userId, guildId);
  if (!entities || entities.length === 0) return false;
  const lowerMsg = userMessage.toLowerCase();
  return entities.some(e =>
    e.entity_name &&
    e.entity_name.length > 2 &&
    e.confidence >= 0.5 &&
    lowerMsg.includes(e.entity_name.toLowerCase())
  );
}

module.exports = { selectModel, checkKnowledgeMatch };
