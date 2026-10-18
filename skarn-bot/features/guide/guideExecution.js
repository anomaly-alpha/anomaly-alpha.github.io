const { runTool } = require('../tools/toolRunner');
const { canCall, releaseCall } = require('../../lib/rateLimit');
const { checkGuideAccess } = require('./guideAccess');
const { isSensitiveMemoryCandidate } = require('../memory/memorySafety');
const { isHostile, isSilenced, recordStrike } = require('../safety/slurFilter');
const { getExample, getDedicatedToolNames, buildToolArguments } = require('./guideCatalog');

async function executeGuideExample(input) {
  const example = getExample(input && input.exampleId);
  if (!example || getDedicatedToolNames().indexOf(example.toolName) === -1) {
    return { ok: false, reason: 'invalid_example', content: 'That guide example is unavailable.' };
  }

  const context = input.context || {};
  const access = checkGuideAccess(context);
  if (!access.allowed) return { ok: false, reason: access.reason, access: access };

  if (example.sideEffect === 'writes_personal_state' && input.confirmed !== true) {
    return { ok: false, reason: 'confirmation_required', content: 'Confirm this change before running it.' };
  }

  let args;
  try { args = buildToolArguments(example.id, input.values || {}); }
  catch (error) { return { ok: false, reason: 'invalid_input', content: error.message }; }
  if (isSilenced(context.userId)) return { ok: false, reason: 'silenced', content: 'The guide is unavailable to you right now.' };
  const freeText = Object.values(args).filter(value => typeof value === 'string').join(' ');
  if (isHostile(freeText)) {
    recordStrike(context.userId);
    return { ok: false, reason: 'unsafe_input', content: 'That input cannot be used in a guide example.' };
  }
  if (example.toolName === 'etch_memory' && (isSensitiveMemoryCandidate(args.fact) || String(args.fact || '').toLowerCase().includes('allerg'))) {
    return { ok: false, reason: 'sensitive_memory', content: 'Please do not save sensitive personal information as a memory.' };
  }

  let reservationId = 0;
  try { reservationId = canCall(context.userId, 'guide'); }
  catch (error) { return { ok: false, reason: 'rate_limit_unavailable', content: 'The guide is unavailable right now. Try again shortly.' }; }
  if (!reservationId) return { ok: false, reason: 'rate_limited', content: 'You have used the guide examples too quickly. Try again in a few minutes.' };

  try {
    const result = await runTool({
      id: 'guide-' + String(input.interactionId || example.id),
      type: 'function',
      function: { name: example.toolName, arguments: JSON.stringify(args) },
    }, {
      userId: context.userId,
      guildId: context.guildId,
      channelId: context.channelId,
    });
    return { ok: true, example: example, content: result && result.content ? result.content : 'The example ran, but returned no details.' };
  } catch (error) {
    releaseCall(context.userId, 'guide', reservationId);
    console.error('[Guide] Example execution failed:', error.message);
    return { ok: false, reason: 'execution_failed', content: 'Skarn could not run that example. Try again.' };
  }
}

module.exports = { executeGuideExample };
