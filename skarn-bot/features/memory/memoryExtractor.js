var { postProcessConversation } = require('../preprocessing/postProcessor');
var { canInteract } = require('../proactive/absenceDetector');

async function extractMemory(userId, guildId, userMessage, aiResponse, analysis) {
  if (!guildId || !canInteract(userId, guildId) || !userMessage || userMessage.length < 50) return;
  await postProcessConversation(userId, guildId, null, userMessage, aiResponse, analysis || null);
}

module.exports = { extractMemory };
