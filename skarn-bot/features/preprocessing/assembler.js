var { SKARN_CORE_IDENTITY } = require('../../persona/identity');

function assemblePrompt(roleLine, ctx, analysis, additionalContext) {
  var parts = [SKARN_CORE_IDENTITY];

  // Stable prefix (identical across calls)
  if (roleLine) parts.push(roleLine);

  // Analysis-informed context
  if (ctx.emotionalDirective) parts.push(ctx.emotionalDirective);
  if (ctx.memoryLine) parts.push(ctx.memoryLine);
  if (ctx.knowledgeLine) parts.push(ctx.knowledgeLine);
  if (ctx.kbLine) parts.push(ctx.kbLine);
  if (ctx.profileLine) parts.push(ctx.profileLine);
  if (additionalContext) parts.push(additionalContext);

  // Dynamic tail (changes every call)
  if (ctx.conversationLine) parts.push(ctx.conversationLine);
  if (ctx.channelLine) parts.push(ctx.channelLine);

  var systemPrompt = parts.join('\n\n');

  var contextualMessage = ctx.conversationLine
    ? 'Conversation context:\n' + ctx.conversationLine + '\n\nCurrent message: ' + analysis.raw
    : analysis.raw;

  return { systemPrompt, contextualMessage };
}

module.exports = { assemblePrompt };
