// ===== Pending question state =====
// The prompt says "offer the answer only when asked twice". This is the state
// that makes "twice" real: a question Skarn asked is stored per user+channel,
// the next turn classifies the reply, and a dodge escalates to the answer
// instead of a third question.
//
// Same shape as getPatienceLine (warmthManager.js:84) - a small JSON buffer with
// a TTL. State lives in app_state, never in a module-level Map.
// Deterministic: no LLM call, ever, and nothing here throws outward.

const { db, getAppState, setAppState } = require('../../db/database');

const PENDING_TTL_MS = 30 * 60 * 1000; // a question asked yesterday is trivia, not conversation
const QUESTION_CAP = 200;
const DODGE_MIN_LENGTH = 8;            // shorter than this is not an answer to anything
const PARTIAL_MIN_CONTENT = 12;        // filler left over after a dodge phrase is not new content

// Unambiguous "I am not engaging, give me the answer" demands. These override the
// partial-content rule: "idk, just tell me what to do" is the second ask, not a
// contribution, even though 23 characters of filler survive the dodge-phrase strip.
const DODGE_DEMANDS = ['just tell me', 'tell me what to do', 'just give me the answer', 'stop asking questions'];

const DODGE_PHRASES = [
  'idk',
  "i don't know",
  'i dont know',
  'dunno',
  'you tell me',
  'just answer',
  'stop asking',
  'no idea',
];

// dodges >= 1 means the answer is owed: answer, say why once, and stop asking.
const ANSWER_NOW_LINE = 'They dodged the question you asked, so that counts as asking twice. Answer it now, in two sentences at most, then one line on why that is your read. Do not ask them another question.';

const SENTENCE_SPLIT = /(?<=[.!?\n])\s+/;

function noneResult() {
  return { status: 'none', line: '' };
}

function pendingQuestionKey(userId, channelId) {
  return 'pendingq:' + String(userId || '') + ':' + String(channelId || '');
}

// First sentence that actually contains a question mark, trimmed and capped.
function extractQuestion(replyText) {
  if (!replyText || typeof replyText !== 'string') return '';
  const segments = replyText.split(SENTENCE_SPLIT);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (segment.indexOf('?') !== -1) return segment.slice(0, QUESTION_CAP);
  }
  return '';
}

function matchesDodgePhrase(lower) {
  for (let i = 0; i < DODGE_PHRASES.length; i++) {
    if (lower.indexOf(DODGE_PHRASES[i]) !== -1) return true;
  }
  return false;
}

// What is left once the dodge phrases are removed - used to tell "idk" apart
// from "idk, but my rent went up so option A".
function remainingContent(lower) {
  let rest = lower;
  for (let i = 0; i < DODGE_PHRASES.length; i++) rest = rest.split(DODGE_PHRASES[i]).join(' ');
  return rest.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function readPendingQuestion(userId, channelId) {
  try {
    const raw = getAppState(pendingQuestionKey(userId, channelId));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.askedAt !== 'number') return null;
    return entry;
  } catch (e) {
    return null;
  }
}

function clearPendingQuestion(userId, channelId) {
  try {
    db.prepare('DELETE FROM app_state WHERE key = ?').run(pendingQuestionKey(userId, channelId));
  } catch (e) {
    // Best effort - a stale row expires on its own TTL on the next read.
  }
}

// Overwrites any outstanding question: the newest question is the live one.
function recordPendingQuestion(userId, channelId, replyText) {
  try {
    if (!userId || !channelId) return null;
    const question = extractQuestion(replyText);
    if (!question) return null;
    const entry = { question: question, askedAt: Date.now(), dodges: 0 };
    setAppState(pendingQuestionKey(userId, channelId), JSON.stringify(entry));
    return entry;
  } catch (e) {
    return null;
  }
}

function classifyPendingQuestion(userId, channelId, incomingText) {
  try {
    if (!userId || !channelId) return noneResult();
    const entry = readPendingQuestion(userId, channelId);
    if (!entry) return noneResult();

    if (Date.now() - entry.askedAt > PENDING_TTL_MS) {
      clearPendingQuestion(userId, channelId);
      return noneResult();
    }

    const text = typeof incomingText === 'string' ? incomingText.trim() : '';
    const lower = text.toLowerCase();
    const hasDodgePhrase = matchesDodgePhrase(lower);
    const hasDemand = DODGE_DEMANDS.some(function(phrase) { return lower.indexOf(phrase) !== -1; });

    // Dodge phrase plus real new information: they engaged, so the question is spent.
    if (!hasDemand && hasDodgePhrase && remainingContent(lower).length >= PARTIAL_MIN_CONTENT) {
      clearPendingQuestion(userId, channelId);
      return { status: 'partial', line: '' };
    }

    // Dodge - the answer is now owed. State is kept so a second dodge still
    // escalates to the answer instead of a third question.
    if (hasDemand || hasDodgePhrase || text.length < DODGE_MIN_LENGTH) {
      setAppState(pendingQuestionKey(userId, channelId), JSON.stringify({
        question: entry.question,
        askedAt: entry.askedAt,
        dodges: (entry.dodges || 0) + 1,
      }));
      return { status: 'dodged', line: ANSWER_NOW_LINE };
    }

    // Answered. The 8-14 character band lands here too: a terse answer is still
    // an answer, so it clears instead of nagging.
    clearPendingQuestion(userId, channelId);
    return { status: 'answered', line: '' };
  } catch (e) {
    return noneResult();
  }
}

module.exports = {
  PENDING_TTL_MS,
  DODGE_PHRASES,
  DODGE_DEMANDS,
  ANSWER_NOW_LINE,
  pendingQuestionKey,
  recordPendingQuestion,
  classifyPendingQuestion,
  clearPendingQuestion,
};
