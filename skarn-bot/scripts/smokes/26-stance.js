// ===== STANCE RESOLUTION =====
// Pure-function coverage for features/wisdom/stance.js (wisdom-pushback spec
// §3.1-§3.3). No database: the stance lever takes its inputs as arguments, so
// this suite needs no SKARN_DB_PATH isolation.
const { resolveStance, isConsequentialClaim, STANCE_LINES, PUSHBACK_LINE } = require('../../features/wisdom/stance');

let passed = 0;

function assert(label, cond) {
  passed++;
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

function stanceOf(userContent, emotionState) {
  return resolveStance({ userContent: userContent, emotionState: emotionState, familiarity: 30, volumeEnergy: 'neutral' });
}

// ===== CLAIM DETECTOR: POSITIVES =====
assert('claim: decision + evaluative verdict', isConsequentialClaim('i m quitting my job, that place is a joke') === true);
assert('claim: apostrophe-free and contracted forms agree', isConsequentialClaim("i'm going to quit, that whole plan is pointless") === true);
assert('claim: universal claim about a group', isConsequentialClaim('everyone at that company is incompetent') === true);
assert('claim: third-party directive', isConsequentialClaim('you should just tell them the truth, they need to hear it') === true);
assert('claim: certain self-assessment', isConsequentialClaim("i'll never get better, i always fail") === true);
assert('claim: decision marker alone is not enough', isConsequentialClaim('i decided to move the meeting to thursday') === false);

// ===== CLAIM DETECTOR: NEGATIVE CONTROLS =====
assert('no claim: taste statement (i like)', isConsequentialClaim('i like pizza') === false);
assert('no claim: taste statement (i prefer)', isConsequentialClaim('i prefer the second option honestly') === false);
assert('no claim: taste statement with a generaliser attached', isConsequentialClaim('i love that everyone shows up early') === false);
assert('no claim: joke marker', isConsequentialClaim('lmao i quit that place was a joke') === false);
assert('no claim: any question mark', isConsequentialClaim('should i quit my job, everyone there is useless?') === false);
// 11 chars, and both halves of the rule match — only the length floor excludes it.
assert('no claim: under 12 characters', isConsequentialClaim('is just bad') === false);
// Both directions of the AND rule: each half alone is not a claim.
assert('no claim: marker without an assertion', isConsequentialClaim('it should work now') === false);
assert('no claim: evaluative assertion without a marker', isConsequentialClaim('the weather is terrible again today') === false);
assert('no claim: empty input', isConsequentialClaim('') === false && isConsequentialClaim(undefined) === false);
assert('no claim: taste statement yields no pushback on the resolve path', stanceOf('i like pizza', 'neutral').pushbackLine === '' && stanceOf('i like pizza', 'neutral').stance !== 'challenge');

// ===== RESOLVE: PRECEDENCE support > challenge > match > observe =====
const sadClaim = stanceOf('i m quitting my job, that place is a joke', 'sad');
assert('sad + claim resolves to support', sadClaim.stance === 'support');
assert('sad + claim never pushes back', sadClaim.pushbackLine === '' && sadClaim.allowHold === false);
assert('anxious + claim resolves to support', stanceOf('everyone is lying to me about the layoffs', 'anxious').stance === 'support');
assert('claim beats a happy signal per fixed precedence', stanceOf('everyone here is just faking it', 'happy').stance === 'challenge');

// ===== RESOLVE: challenge + claim emits the pushback =====
const challengeClaim = stanceOf('i m quitting my job, that place is a joke', 'neutral');
assert('claim + settled emotion resolves to challenge', challengeClaim.stance === 'challenge');
assert('challenge permits the hold', challengeClaim.allowHold === true);
assert('challenge + claim emits the pushback line', challengeClaim.pushbackLine === PUSHBACK_LINE);
assert('pushback line names both permitted grounds', PUSHBACK_LINE.indexOf('You may disagree, once') !== -1 && PUSHBACK_LINE.indexOf('Name the specific hole') !== -1);
assert('pushback line forbids arguing taste', PUSHBACK_LINE.indexOf('Never argue taste') !== -1);

// ===== RESOLVE: advice request with a settled state goes challenge, no pushback =====
const advice = stanceOf('i cant decide between two jobs, what would you advise?', null);
assert('advice request with no emotion row resolves to challenge', advice.stance === 'challenge');
assert('advice request permits the hold', advice.allowHold === true);
assert('advice request without a claim emits no pushback', advice.pushbackLine === '');
assert('how-to question is not an advice request', stanceOf('how do i fix this error in the build', 'neutral').stance === 'observe');

// ===== RESOLVE: match and observe =====
const happy = stanceOf('the launch went out and the team nailed it', 'happy');
assert('happy resolves to match', happy.stance === 'match');
assert('match never holds or pushes back', happy.allowHold === false && happy.pushbackLine === '');
const observe = stanceOf('yo', 'neutral');
assert('short casual message resolves to observe', observe.stance === 'observe');
assert('observe never holds or pushes back', observe.allowHold === false && observe.pushbackLine === '');
assert('tolerance: emotion row object is accepted', resolveStance({ userContent: 'i m done with all of it', emotionState: { emotional_state: 'sad' } }).stance === 'support');

// ===== LINES =====
const stances = ['support', 'challenge', 'match', 'observe'];
assert('every stance has a directive line', stances.every(function(s) { return typeof STANCE_LINES[s] === 'string' && STANCE_LINES[s].length > 0; }));
assert('the four directive lines are distinct', new Set(stances.map(function(s) { return STANCE_LINES[s]; })).size === 4);
assert('directive lines stay prompt-sized', stances.every(function(s) { return STANCE_LINES[s].length <= 120; }));
assert('directive lines carry no therapy-speak', stances.every(function(s) { return STANCE_LINES[s].indexOf('I hear') === -1 && STANCE_LINES[s].indexOf('feeling') === -1; }));
assert('resolveStance returns exactly the four contract keys', Object.keys(sadClaim).sort().join(',') === 'allowHold,line,pushbackLine,stance');

console.log('Stance smoke passed - ' + passed + ' assertions');
