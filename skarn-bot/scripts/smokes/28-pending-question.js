// ===== SMOKE: PENDING QUESTION STATE =====
// Guards "offer the answer only when asked twice" being real state (spec
// wisdom-pushback §3.5): write/read roundtrip, first-question extraction and
// the 200-char cap, TTL expiry, every dodge phrase incrementing, dodge ->
// answer-now line, partial/answered clearing with no line, and the negative
// control that a normal answer never produces a directive.
if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const { db, getAppState, setAppState } = require('../../db/database');
const {
  PENDING_TTL_MS,
  DODGE_PHRASES,
  ANSWER_NOW_LINE,
  pendingQuestionKey,
  recordPendingQuestion,
  classifyPendingQuestion,
  clearPendingQuestion,
} = require('../../features/wisdom/pendingQuestion');

const userId = 'pendingq-user';
const channelId = 'pendingq-channel';
const key = pendingQuestionKey(userId, channelId);

let checks = 0;
let failures = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures++;
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

function storedEntry() {
  const raw = getAppState(key);
  return raw ? JSON.parse(raw) : null;
}

// Rewrite askedAt through the same app_state helper instead of a test-only TTL override.
function agePendingQuestion(ageMs) {
  const entry = storedEntry();
  entry.askedAt = Date.now() - ageMs;
  setAppState(key, JSON.stringify(entry));
}

function reset() {
  clearPendingQuestion(userId, channelId);
}

// ===== SURFACE =====
assert('PENDING_TTL_MS is 30 minutes', PENDING_TTL_MS === 30 * 60 * 1000);
assert('dodge phrase list carries all 8 phrases', DODGE_PHRASES.length === 8);
assert('answer-now line says answer now and forbids another question',
  ANSWER_NOW_LINE.indexOf('Answer it now') !== -1 && ANSWER_NOW_LINE.indexOf('Do not ask them another question') !== -1);

// ===== WRITE -> READ ROUNDTRIP =====
reset();
const recorded = recordPendingQuestion(userId, channelId, 'Fine, that is the tradeoff. Which one are you actually going to take?');
assert('first question sentence is the one stored', !!recorded && recorded.question === 'Which one are you actually going to take?');
assert('askedAt is stamped at write time', !!recorded && typeof recorded.askedAt === 'number' && Math.abs(Date.now() - recorded.askedAt) < 5000);
assert('dodges starts at zero', !!recorded && recorded.dodges === 0);
const persisted = storedEntry();
assert('state roundtrips through app_state', !!persisted && persisted.question === recorded.question && persisted.dodges === 0);

// ===== EXTRACTION: CAP AND NO-QUESTION NO-OP =====
reset();
const longQuestion = 'Why ' + 'really '.repeat(40) + 'though?';
const capped = recordPendingQuestion(userId, channelId, longQuestion);
assert('question is capped at 200 chars', !!capped && capped.question.length === 200 && longQuestion.length > 200);

reset();
assert('reply with no question mark writes nothing', recordPendingQuestion(userId, channelId, 'Understood. No question in this reply.') === null);
assert('nothing is stored when there is no question', getAppState(key) === null);
assert('a null reply does not throw', recordPendingQuestion(userId, channelId, null) === null);
assert('an unknown user+channel classifies as none', classifyPendingQuestion('nobody', 'nowhere', 'idk').status === 'none');

// ===== TTL EXPIRY =====
reset();
recordPendingQuestion(userId, channelId, 'Would you rather be right, or be kind?');
agePendingQuestion(PENDING_TTL_MS + 1000);
const expired = classifyPendingQuestion(userId, channelId, 'idk');
assert('TTL-expired entry reports none', expired.status === 'none' && expired.line === '');
assert('TTL-expired entry is cleared', getAppState(key) === null);
assert('cleared expiry cannot resurrect on the next dodge', classifyPendingQuestion(userId, channelId, 'idk').status === 'none');

reset();
recordPendingQuestion(userId, channelId, 'Would you rather be right, or be kind?');
agePendingQuestion(PENDING_TTL_MS - 60000);
assert('an entry inside the TTL is still tracked', classifyPendingQuestion(userId, channelId, 'idk').status === 'dodged');
reset();

// ===== DODGES =====
for (let i = 0; i < DODGE_PHRASES.length; i++) {
  reset();
  recordPendingQuestion(userId, channelId, 'What would you actually do here?');
  const result = classifyPendingQuestion(userId, channelId, DODGE_PHRASES[i]);
  const entry = storedEntry();
  assert('dodge phrase "' + DODGE_PHRASES[i] + '" yields the answer-now line',
    result.status === 'dodged' && result.line === ANSWER_NOW_LINE);
  assert('dodge phrase "' + DODGE_PHRASES[i] + '" increments dodges to 1 and persists',
    !!entry && entry.dodges === 1 && entry.question === 'What would you actually do here?');
}

reset();
recordPendingQuestion(userId, channelId, 'What would you actually do here?');
const firstDodge = classifyPendingQuestion(userId, channelId, 'idk');
const secondDodge = classifyPendingQuestion(userId, channelId, 'dunno');
assert('a second dodge still answers instead of asking a third question',
  firstDodge.status === 'dodged' && secondDodge.status === 'dodged'
  && firstDodge.line === ANSWER_NOW_LINE && secondDodge.line === ANSWER_NOW_LINE);
assert('dodges accumulate across turns', storedEntry().dodges === 2);

reset();
recordPendingQuestion(userId, channelId, 'What would you actually do here?');
const veryShort = classifyPendingQuestion(userId, channelId, 'meh');
assert('a reply under 8 chars counts as a dodge', veryShort.status === 'dodged' && veryShort.line === ANSWER_NOW_LINE);

// ===== PARTIAL AND ANSWERED =====
reset();
recordPendingQuestion(userId, channelId, 'Which offer are you taking?');
const partial = classifyPendingQuestion(userId, channelId, "idk, but my rent went up and the first one has better hours");
assert('a dodge phrase plus new content is partial with no line', partial.status === 'partial' && partial.line === '');
assert('partial clears state', getAppState(key) === null);

reset();
recordPendingQuestion(userId, channelId, 'Which offer are you taking?');
const answered = classifyPendingQuestion(userId, channelId, 'I am going to take the second one, it pays more.');
assert('a normal answer reports answered', answered.status === 'answered');
assert('NEGATIVE CONTROL: a normal answer produces no line', answered.line === '');
assert('answered clears state', getAppState(key) === null);
assert('NEGATIVE CONTROL: the next dodge gets no line once the question is settled',
  classifyPendingQuestion(userId, channelId, 'idk').line === '');

reset();
recordPendingQuestion(userId, channelId, 'Which offer are you taking?');
const terse = classifyPendingQuestion(userId, channelId, 'the second');
assert('a short non-dodge reply clears instead of nagging', terse.status === 'answered' && terse.line === '');
assert('short non-dodge reply clears state', getAppState(key) === null);

// ===== CLEAR HELPER =====
reset();
recordPendingQuestion(userId, channelId, 'Which offer are you taking?');
clearPendingQuestion(userId, channelId);
assert('clearPendingQuestion removes the row', getAppState(key) === null);
assert('cleared state produces no line on the next dodge',
  classifyPendingQuestion(userId, channelId, 'idk').status === 'none');

db.close();
console.log('assertions:', checks, 'failed:', failures);
console.log('Pending question smoke passed');
