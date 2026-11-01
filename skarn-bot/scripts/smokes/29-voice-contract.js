// ===== VOICE CONTRACT =====
// Guards the two assets that teach Skarn's register: the contract that is injected into
// every system prompt, and the example dialogues that demonstrate it. Both are pure
// string assets, so this is deterministic — no LLM involved.
//
// Why a suite at all: the previous example set taught the opposite of the persona
// ("that's real", "i'm here", "you earned this win", "that's the definition of courage")
// for months without anything noticing. Few-shot examples outrank instructions, so a
// wrong example is worse than a missing one. This asserts the examples cannot contradict
// the contract they sit next to.
const { buildSystemPrompt } = require('../../persona/identity');
const { VOICE_CONTRACT, BANNED_OPENERS, BANNED_PHRASES } = require('../../persona/voice-contract');
const { EXAMPLE_DIALOGUES, buildExamplesLine } = require('../../persona/examples');

let asserts = 0;
let failed = 0;
function assert(label, cond) {
  asserts++;
  console.log(label + ':', cond);
  if (!cond) { failed++; process.exitCode = 1; }
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[\u2018\u2019']/g, "'");
}

// ===== The contract reaches every prompt =====
const prompt = buildSystemPrompt({});
assert('contract is in the assembled prompt', prompt.indexOf(VOICE_CONTRACT) !== -1);
assert('contract appears exactly once', prompt.split(VOICE_CONTRACT).length === 2);
assert('contract survives a populated assembly', buildSystemPrompt({ roleLine: 'x', socraticLine: 'y', pushbackLine: 'z' }).indexOf(VOICE_CONTRACT) !== -1);

// ===== The contract states its own lists =====
const contractText = normalize(VOICE_CONTRACT);
assert('every banned opener is quoted in the contract', BANNED_OPENERS.every(function(p) { return contractText.indexOf('"' + p + '"') !== -1; }));
assert('every banned phrase is quoted in the contract', BANNED_PHRASES.every(function(p) { return contractText.indexOf('"' + p + '"') !== -1; }));
assert('contract bans exclamation marks', contractText.indexOf('no exclamation marks') !== -1);
assert('contract caps replies at one question', contractText.indexOf('never ask two questions') !== -1);

// ===== The examples obey the contract =====
const examples = normalize(EXAMPLE_DIALOGUES);

const openerHits = BANNED_OPENERS.filter(function(p) { return examples.indexOf(p) !== -1; });
assert('no banned opener appears in the examples', openerHits.length === 0);
if (openerHits.length > 0) console.log('  offenders:', openerHits.join(', '));

const phraseHits = BANNED_PHRASES.filter(function(p) { return examples.indexOf(p) !== -1; });
assert('no banned phrase appears in the examples', phraseHits.length === 0);
if (phraseHits.length > 0) console.log('  offenders:', phraseHits.join(', '));

assert('examples contain no exclamation marks', EXAMPLE_DIALOGUES.indexOf('!') === -1);
assert('examples are not empty', EXAMPLE_DIALOGUES.trim().length > 200);

// Few-shot examples are the strongest register signal, so at least one must demonstrate
// disagreement — the old set never did, which is part of why pushback read as canned.
assert('examples demonstrate disagreement', examples.indexOf('maybe. but') !== -1);
assert('examples show grief without a comfort formula', examples.indexOf('a week is nothing') !== -1);

// Variety guard: if every example ends by asking something, the model learns to append
// questions to every reply (observed on the wisdom eval before this was rebalanced).
const skarnTurns = EXAMPLE_DIALOGUES.split('\n').filter(function(l) { return l.trim().indexOf('Skarn:') === 0; });
const questionTurns = skarnTurns.filter(function(l) { return l.trim().indexOf('?') !== -1; });
assert('all Skarn example turns are lowercase-open', skarnTurns.every(function(l) {
  const body = l.replace('Skarn:', '').trim();
  return body.length > 0 && body[0] === body[0].toLowerCase();
}));
assert('fewer than half of Skarn turns ask a question', skarnTurns.length > 0 && questionTurns.length * 2 < skarnTurns.length);

// ===== First-interaction variant stays warm but not gushing =====
const first = normalize(buildExamplesLine(true));
assert('first-interaction line is warm and informal', first.indexOf('welcome') !== -1);
assert('first-interaction line avoids banned phrases', BANNED_PHRASES.every(function(p) { return first.indexOf(p) === -1; }));

console.log('');
console.log('29-voice-contract: ' + (asserts - failed) + '/' + asserts + ' assertions passed');
