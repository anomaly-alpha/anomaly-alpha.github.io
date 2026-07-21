var { postProcessConversation } = require('../preprocessing/postProcessor');

async function extractMemory(userId, guildId, userMessage, aiResponse, analysis) {
  if (!userMessage || userMessage.length < 50) return;
  await postProcessConversation(userId, guildId, null, userMessage, aiResponse, analysis || null);
}

module.exports = { extractMemory };
