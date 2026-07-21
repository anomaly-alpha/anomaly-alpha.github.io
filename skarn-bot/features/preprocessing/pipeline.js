var { analyzeMessage } = require('./analyzer');
var { retrieveContext } = require('./retriever');
var { assemblePrompt } = require('./assembler');

var CHEAP_COMMANDS = ['joke', 'roast', 'insult', 'pickup', 'compliment', 'meme', 'vein', 'search'];

async function runPipeline(userId, guildId, channelId, messageText, roleLine, roleNature, additionalContext, opts) {
  opts = opts || {};

  // Skip check
  if (opts.isSkipListCommand) return null;
  if (!messageText || messageText.length < 10) return null;

  // Stage 1: Analyze (with retry)
  var analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  if (!analysis) {
    // One retry with 100ms backoff
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
    analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  }
  if (!analysis) return null; // fall through

  // Safety gate from analyzer
  if (analysis.safetyFlags.length > 0) {
    return { safetyBlocked: true, safetyFlags: analysis.safetyFlags };
  }

  // Stage 2: Retrieve
  var ctx = await retrieveContext(userId, guildId, channelId, analysis, messageText);

  // Stage 3: Assemble
  var prompt = assemblePrompt(roleLine, ctx, analysis, additionalContext);

  return {
    systemPrompt: prompt.systemPrompt,
    contextualMessage: prompt.contextualMessage,
    analysis: analysis,
    context: ctx,
    skipped: false,
  };
}

module.exports = { runPipeline, CHEAP_COMMANDS };
