// ===== Socratic trigger detection =====
// NARROWED 2026-11-01 (wisdom-pushback spec §3.7): 'how do i', 'would you' and
// 'what do you think' were removed — they fired on technical questions and
// polite requests, making Skarn withhold answers where an answer was wanted.
// 'what do you think' is a request for a take, not for Socratic withholding.

const ADVICE_TRIGGERS = [
  'should i', 'should we', 'what should', 'need advice', 'help me decide',
  'what would you do', 'what would you advise', 'can\'t decide', 'cant decide',
  'stuck between', 'help me think', 'talk me through it', 'i dont know what to do',
  'i don\'t know what to do', 'is it a good idea',
];

// How-to signals: the message is asking for an instruction, not for a decision.
// Suppression only matters when a trigger also matched, so this narrows rather
// than disables.
const HOWTO_SIGNALS = [/```/, /\berror\b/i, /\bwhy is\b/i, /\bhow does\b/i, /\bstack trace\b/i];

function looksLikeHowTo(message) {
  for (let i = 0; i < HOWTO_SIGNALS.length; i++) {
    if (HOWTO_SIGNALS[i].test(message)) return true;
  }
  return false;
}

function matchesAdviceTrigger(lower) {
  for (let i = 0; i < ADVICE_TRIGGERS.length; i++) {
    if (lower.indexOf(ADVICE_TRIGGERS[i]) !== -1) return true;
  }
  return false;
}

// Single-question hold. Prescriptive on purpose: the model's default is a read followed
// by two questions, which withholds nothing and helps less (measured on the wisdom eval,
// P02/P11 both scored mechanism 2/4 with the older, softer wording).
const SOCRATIC_LINE = 'They are asking for advice. Do not give them the answer. Ask exactly one question, then stop - pull them toward their own conclusion. Do not add a read first and do not ask a second question. If they push again, answer straight. '
  + 'One question, e.g. \"What have you considered?\" or \"What matters most to you here?\" or \"What does your gut say?\"';

// Structured form — carries whether the hold was requested so the stance veto
// and the callers can decide, instead of re-parsing a directive string.
function resolveSocratic(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return { requested: false, line: '' };
  if (looksLikeHowTo(userMessage)) return { requested: false, line: '' };

  const lower = userMessage.toLowerCase();
  if (!matchesAdviceTrigger(lower)) return { requested: false, line: '' };

  return { requested: true, line: SOCRATIC_LINE };
}

// Back-compatible string form (smoke 08 + audit-docs assert on this shape).
function getSocraticQuestion(userMessage) {
  return resolveSocratic(userMessage).line;
}

module.exports = { getSocraticQuestion, resolveSocratic, ADVICE_TRIGGERS };
