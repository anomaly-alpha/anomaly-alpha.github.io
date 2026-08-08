// ===== Message Analysis for Routing =====
// Former 3-stage pipeline (analyzer → retriever → assembler) trimmed to the
// analyzer step only. The analyzer's output informs model routing and memory
// extraction — it never feeds prompt assembly (buildContext/buildSystemPrompt
// are the single prompt source). The cost gate mirrors isFullTier
// (promptContext.js:28) so short/banter messages skip the analyzer call.
var { analyzeMessage } = require('./analyzer');

function shouldAnalyze(messageText) {
  return messageText && (messageText.length >= 50 || messageText.indexOf('?') !== -1);
}

async function runMessageAnalysis(userId, guildId, channelId, messageText, roleNature) {
  if (!shouldAnalyze(messageText)) return null;
  var analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  if (!analysis) {
    // One retry with 100ms backoff
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
    analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  }
  return analysis || null;
}

module.exports = { runMessageAnalysis, shouldAnalyze };
