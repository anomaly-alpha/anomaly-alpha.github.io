// ===== Stance lever =====
// One behavioural lever per turn (wisdom-pushback spec §3.1). Precedence is total
// and fixed: support > challenge > match > observe, so a claim can never override
// someone who is hurting, and the hold only ever rides on the challenge stance.
const { resolveSocratic } = require('./socraticEngine');

const STANCE_LINES = {
  support: 'They are under pressure. Be steady and present - no pushback, and answer plainly instead of making them work it out.',
  challenge: 'They made a claim. Engage it directly - state your position and the reason for it.',
  match: 'The mood is light. Match their energy and keep it short.',
  observe: 'Reply short and stay out of the way - no pushback, no depth.',
};

const PUSHBACK_LINE = 'They just asserted something decisive. You may disagree, once, if the claim has a visible hole '
  + '(an ignored tradeoff, an unstated assumption, a conclusion that doesn\'t follow) or contradicts what they '
  + 'told you before. Name the specific hole. Never argue taste, never argue twice unless they push back, '
  + 'and if they hold their position after one exchange, let it go.';

// Jokes and taste are never argued (spec §3.2).
const JOKE_MARKERS = ['lol', 'lmao', 'haha', 'rofl'];
const TASTE_MARKERS = ['i like', 'i love', 'i prefer', 'my favourite', 'my favorite'];

// The generalising or evaluative half of a claim. Universal claims and directives
// aimed at a third party generalise on their own, so they count here as well.
const ASSERTION_PATTERNS = [
  /\b(is|are|was|were) (a joke|a waste|just|terrible|awful|trash|garbage|stupid|dumb|useless|pointless|worthless|rigged|broken)\b/,
  /\b(is|are|was|were) (a coward|a scam|a cult|a lie|insane|delusional|crazy|ridiculous|pathetic)\b/,
  /\b(anyone|anybody|people) who\b/,
  /\b(waste of|pointless|worthless|rigged|obviously|clearly|therefore|proves)\b/,
  /\b(everyone|everybody|nobody|no one|people are|all of|is just)\b/,
  /\b(just tell (them|him|her)|(he|she|they) needs? to|you should)\b/,
  /\b(i ?m (useless|worthless|a failure|pathetic)|i ?ll never|i always fail|nothing works)\b/,
];

// Spec §3.2 markers: decision, universal claim, third-party advice, certain self-assessment.
const CLAIM_MARKERS = [
  /\bi ?m (going to|gonna|quitting|leaving|done with)\b/,
  /\bi (decided|have decided|quit)\b/,
  /\bquitting\b/,
  /\bshould\b/,
  /\bnever\b/,
  /\balways\b/,
  /\beveryone\b/,
  /\beverybody\b/,
  /\bnobody\b/,
  /\ball of\b/,
  /\bpeople are\b/,
  /\bis just\b/,
  /\banyone who\b/,
  /\banybody who\b/,
  /\bworthless\b/,
  /\bpointless\b/,
  /\bjust tell (them|him|her)\b/,
  /\b(he|she|they) needs? to\b/,
  /\bi ?m (useless|worthless|a failure|pathetic)\b/,
  /\bi ?ll never\b/,
  /\bi always fail\b/,
];

// Apostrophes are stripped so "i'm quitting", "im quitting" and "i m quitting"
// all reduce to the same marker.
function normalizeText(text) {
  return text.toLowerCase().replace(/['\u2019]/g, '').replace(/\s+/g, ' ').trim();
}

function matchesAny(patterns, text) {
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(text)) return true;
  }
  return false;
}

function containsAny(markers, text) {
  for (let i = 0; i < markers.length; i++) {
    if (text.indexOf(markers[i]) !== -1) return true;
  }
  return false;
}

function isConsequentialClaim(userContent) {
  if (typeof userContent !== 'string') return false;
  const text = normalizeText(userContent);
  if (text.length < 12) return false;
  if (text.indexOf('?') !== -1) return false;
  if (containsAny(JOKE_MARKERS, text)) return false;
  if (containsAny(TASTE_MARKERS, text)) return false;
  return matchesAny(ASSERTION_PATTERNS, text) && matchesAny(CLAIM_MARKERS, text);
}

function normalizeEmotion(emotionState) {
  if (!emotionState) return '';
  const raw = typeof emotionState === 'string' ? emotionState : emotionState.emotional_state;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

// Settled = no emotional signal that either vetoes the hold or redirects the reply.
function isSettledEmotion(emotion) {
  return emotion !== 'sad' && emotion !== 'anxious' && emotion !== 'happy'
    && emotion !== 'stressed' && emotion !== 'angry';
}

function buildStance(stance, claim) {
  return {
    stance: stance,
    line: STANCE_LINES[stance],
    allowHold: stance === 'challenge',
    pushbackLine: stance === 'challenge' && claim ? PUSHBACK_LINE : '',
  };
}

// familiarity and volumeEnergy are accepted so every caller passes one shape, but
// neither sets the stance today: volume stays an energy read, not a lever.
function resolveStance(input) {
  const opts = input || {};
  const userContent = typeof opts.userContent === 'string' ? opts.userContent : '';
  const emotion = normalizeEmotion(opts.emotionState);

  // D9, broadened 2026-11-01 after the dry run: 'venting' includes stressed and
  // angry, not only sad and anxious. A stressed user asking for advice was being
  // handed a Socratic question, which is the coldest possible response.
  if (emotion === 'sad' || emotion === 'anxious' || emotion === 'stressed' || emotion === 'angry') {
    return buildStance('support', false);
  }

  if (isConsequentialClaim(userContent)) return buildStance('challenge', true);
  if (isSettledEmotion(emotion) && resolveSocratic(userContent).requested) return buildStance('challenge', false);

  if (emotion === 'happy') return buildStance('match', false);

  return buildStance('observe', false);
}

module.exports = { resolveStance, isConsequentialClaim, STANCE_LINES, PUSHBACK_LINE };
