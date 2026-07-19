const { extractAndStore } = require('../intelligence/knowledgeGraph');
const { canCall } = require('../../lib/rateLimit');

async function extractMemory(userId, guildId, userMessage, aiResponse) {
  if (!userMessage || userMessage.length < 50) return;
  if (!canCall(userId)) return;
  await extractAndStore(userId, guildId, userMessage, aiResponse);
}

module.exports = { extractMemory };
