// ===== Reply Condenser =====
// Post-generation pass that tightens an over-target reply to the role's char
// target. Always short-circuits (zero LLM call) when already within target.
// Fails open: on any error it returns the original text. (spec [S5]/[S7])

const { moderatedChatCompletion } = require('../../ai/client');
const { roles, ROLE_NATURE } = require('../../persona/roles');

// ==== Constants ====
const CONDENSER_MODEL = 'gpt-4.1-mini';
const CONDENSER_MAX_TOKENS = 140;
const CONDENSER_TEMP = 0.3;
const MINIMUM_REASONABLE_FRACTION = 0.16; // reject output shorter than 16% of target
// Only real code fences / markdown tables trigger a skip — single backticks do not.
const STRUCTURED_FENCE = /```|<\/?table|^\s*\|.*\|/m;

function hasFenceOrTable(text) {
  return STRUCTURED_FENCE.test(text);
}

async function condenseReply(text, target, role, userId, opts) {
  if (!text || typeof text !== 'string' || text.length === 0) return { reply: text };
  if (text.length <= target) return { reply: text }; // short-circuit — zero LLM call
  if (opts && opts.usedTool) return { reply: text }; // tool-driven replies stay intact
  if (hasFenceOrTable(text)) return { reply: text };

  // Voice is load-bearing: inherit the exact role line + nature so the
  // condenser stays in-character (CONTEXT.md §7.1, spec [S11] + [S9]-verification).
  const roleLine = roles[role] || '';
  const nature = ROLE_NATURE[role] || 'casual';

  try {
    const system =
      (roleLine ? roleLine + '\n\n' : '') +
      'Tighten the reply below to ' + target + ' characters or fewer. Keep Skarn\'s voice. ' +
      'Keep ALL key points. Never invent facts, never add markdown or list formatting, ' +
      'stay ' + nature + ' in register, and never lecture or add an apology. ' +
      'If shortening would lose meaning, return the original reply unchanged.';

    const result = await moderatedChatCompletion({
      userId: userId,
      bucket: 'condense',
      model: CONDENSER_MODEL,
      max_tokens: CONDENSER_MAX_TOKENS,
      temperature: CONDENSER_TEMP,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Original Skarn reply:\n' + text },
      ],
    });
    if (!result.success) return { reply: text };

    const condensed = result.completion.choices[0] && result.completion.choices[0].message
      ? result.completion.choices[0].message.content
      : '';
    if (!condensed || typeof condensed !== 'string') return { reply: text };
    if (condensed.length < target * MINIMUM_REASONABLE_FRACTION) {
      // Too aggressive — prefer the safer original.
      return { reply: text };
    }
    return { reply: condensed };
  } catch (e) {
    console.error('[Condenser] error:', e.message);
    return { reply: text };
  }
}

module.exports = { condenseReply, CONDENSER_MODEL };
