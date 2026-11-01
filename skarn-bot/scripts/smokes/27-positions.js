// ===== POSITIONS (prefixed preference store) =====
// Guards WP2: a position is a 'preference' row whose content starts with
// 'position: '. Covers write→read roundtrip, the prefix/type filters, overlap
// selection, no-overlap silence, UNIQUE dedupe, capping, and that a bad
// positions payload can never drop the entity batch (CONTEXT.md §9.7).
if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const { db, addMemoryEntry, getMemoryEntries, setUserPreference } = require('../../db/database');
const { POSITION_PREFIX, POSITION_LIMIT, getPositions, matchPosition, buildPositionLine, formatPosition } = require('../../features/wisdom/positions');

let passed = 0;
let failed = 0;

function assert(label, cond) {
  console.log(label + ':', cond);
  if (cond) passed++;
  else { failed++; process.exitCode = 1; }
}

function rowsFor(userId, guildId, content) {
  return db.prepare('SELECT COUNT(*) AS c FROM memory_entries WHERE user_id = ? AND guild_id = ? AND content = ?').get(userId, guildId, content).c;
}

// ===== Contract =====

assert("POSITION_PREFIX is 'position: '", POSITION_PREFIX === 'position: ');
assert('POSITION_LIMIT is a sane cap (<= 25)', POSITION_LIMIT > 0 && POSITION_LIMIT <= 25);

// ===== Write → read roundtrip =====

const userId = 'position-user';
const guildId = 'position-guild';

addMemoryEntry(userId, guildId, 'extracted', 'preference', POSITION_PREFIX + 'capitalism is fundamentally broken', 0.5, 'arguing about markets');
addMemoryEntry(userId, guildId, 'extracted', 'preference', POSITION_PREFIX + 'remote work is a mistake for junior engineers', 0.5, 'talking about jobs');

let stored = getPositions(userId, guildId);
assert('roundtrip: two positions stored and read back', stored.length === 2);
assert('roundtrip: prefix is stripped from the claim',
  stored.some(function(p) { return p.claim === 'capitalism is fundamentally broken'; }));
assert('roundtrip: no claim retains the prefix',
  stored.every(function(p) { return p.claim.indexOf(POSITION_PREFIX.trim()) !== 0; }));
assert('roundtrip: context is carried', stored.some(function(p) { return p.context === 'arguing about markets'; }));
assert('roundtrip: createdAt is a number', stored.every(function(p) { return typeof p.createdAt === 'number' && p.createdAt > 0; }));

// ===== Filters: prefix and type =====

addMemoryEntry(userId, guildId, 'extracted', 'preference', 'likes dark coffee', 0.5, null);
addMemoryEntry(userId, guildId, 'extracted', 'preference', 'tone_subtext: sounded tired', 0.4, null);
// NEGATIVE CONTROL: the prefix on a non-'preference' row must not surface.
db.prepare('INSERT INTO memory_entries (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(userId, guildId, 'extracted', 'fact', POSITION_PREFIX + 'plants run the world economy', 0.5, null, Date.now(), Date.now(), Date.now());

stored = getPositions(userId, guildId);
assert('filter: ordinary preference row excluded', stored.every(function(p) { return p.claim !== 'likes dark coffee'; }));
assert('filter: tone_subtext row excluded', stored.every(function(p) { return p.claim.indexOf('tone_subtext') === -1; }));
assert("filter: prefixed row of type 'fact' excluded", stored.every(function(p) { return p.claim !== 'plants run the world economy'; }));
assert('filter: still exactly the two real positions', stored.length === 2);

// ===== Overlap selects one, the best =====

const overlapMessage = 'i think remote work is destroying junior engineers';
const match = matchPosition(overlapMessage, stored);
assert('overlap: matchPosition returns an object', Boolean(match));
assert('overlap: picks the remote-work position, not capitalism',
  match && match.claim === 'remote work is a mistake for junior engineers');
assert('overlap: claim carries no prefix and no quotes',
  match && match.claim.indexOf(POSITION_PREFIX.trim()) !== 0 && match.claim.indexOf('"') === -1);
assert('overlap: instruction is non-empty bot-authored text',
  match && typeof match.instruction === 'string' && match.instruction.indexOf('name the contradiction') !== -1);
assert('overlap: instruction never contains the claim', match && match.instruction.indexOf(match.claim) === -1);
assert('overlap: buildPositionLine composes claim + instruction once',
  buildPositionLine(overlapMessage, stored) === formatPosition(match.claim));
assert('overlap: never dumps the list', buildPositionLine(overlapMessage, stored).indexOf('capitalism') === -1);

// ===== No overlap returns silence =====

assert("no overlap: matchPosition returns null", matchPosition('what time does the shop close', stored) === null);
assert("no overlap: buildPositionLine returns ''", buildPositionLine('what time does the shop close', stored) === '');
assert("empty list: buildPositionLine returns ''", buildPositionLine(overlapMessage, []) === '');
assert('missing list: buildPositionLine returns the empty string', buildPositionLine(overlapMessage, null) === '');
assert("empty message: buildPositionLine returns ''", buildPositionLine('', stored) === '');

// NEGATIVE CONTROL: a claim made only of sub-4-char tokens can never match.
const shortClaimUser = 'position-short';
addMemoryEntry(shortClaimUser, 'g', 'extracted', 'preference', POSITION_PREFIX + 'war is bad', 0.5, null);
const shortClaim = getPositions(shortClaimUser, 'g');
assert("no overlap: tokens under 4 chars never match", buildPositionLine('war is bad', shortClaim) === '');

// ===== UNIQUE dedupe =====

const dupClaim = POSITION_PREFIX + 'capitalism is fundamentally broken';
const countBefore = rowsFor(userId, guildId, dupClaim);
addMemoryEntry(userId, guildId, 'extracted', 'preference', dupClaim, 0.5, 'said it again');
addMemoryEntry(userId, guildId, 'extracted', 'preference', dupClaim, 0.5, 'and again');
const countAfter = rowsFor(userId, guildId, dupClaim);
assert('dedupe: identical claim written three times stays one row', countBefore === 1 && countAfter === 1);
console.log('dedupe rows for "' + dupClaim + '":', countAfter);

let constraintHeld = false;
try {
  db.prepare('INSERT INTO memory_entries (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(userId, guildId, 'extracted', 'preference', dupClaim, 0.5, null, Date.now(), Date.now(), Date.now());
} catch (e) {
  constraintHeld = /UNIQUE|constraint/i.test(e.message);
}
assert('dedupe: raw duplicate INSERT rejected by UNIQUE(user_id, guild_id, type, content)', constraintHeld);
assert('dedupe: position list unchanged after duplicates', getPositions(userId, guildId).length === 2);

// ===== Capping =====

const capUser = 'position-cap';
for (let i = 0; i < POSITION_LIMIT + 5; i++) {
  addMemoryEntry(capUser, guildId, 'extracted', 'preference', POSITION_PREFIX + 'cap claim number ' + i, 0.5, null);
}
const capped = getPositions(capUser, guildId);
assert('cap: list is capped at POSITION_LIMIT', capped.length === POSITION_LIMIT);
assert('cap: keeps the newest claim', capped[0].claim === 'cap claim number ' + (POSITION_LIMIT + 4));
assert('cap: drops the oldest claims', capped.every(function(p) { return p.claim !== 'cap claim number 0'; }));

// ===== NEGATIVE CONTROL: scoping =====

assert('scoping: another user sees no positions', getPositions('a-total-stranger', guildId).length === 0);
assert('scoping: another guild sees no positions', getPositions(userId, 'another-guild').length === 0);

// ===== postProcessor: positions are additive, never batch-fatal =====

const client = require('../../ai/client');

async function runPostProcessor() {
  setUserPreference('pp-user', 'pp-guild', 'proactive_opt_in', 1);
  setUserPreference('pp-user', 'pp-guild-bad', 'proactive_opt_in', 1);

  // One dispatcher: postProcessor destructures moderatedChatCompletion at require
  // time, so the function object must stay stable and read a swappable payload.
  let payload = {
    entities: [{ type: 'interest', name: 'Sourdough Baking', context: 'bakes weekly', confidence: 0.7 }],
    positions: [
      { claim: 'capitalism is fundamentally broken', context: 'arguing about markets' },
      { claim: '' },
      { claim: 42 },
      null,
      { claim: 'my brother is the reliable one' },
      { claim: 'school mostly teaches obedience' },
      { claim: 'a fourth claim past the per-message cap' },
    ],
  };
  client.moderatedChatCompletion = async function() {
    return { success: true, completion: { choices: [{ message: { content: JSON.stringify(payload) } }] } };
  };
  const { postProcessConversation } = require('../../features/preprocessing/postProcessor');
  await postProcessConversation('pp-user', 'pp-guild', 'chan-1', 'x'.repeat(60) + ' markets and family', 'a reply', null);

  const entities = getMemoryEntries('pp-user', 'pp-guild', 10);
  assert('postProcessor: entity batch survived the malformed positions',
    entities.some(function(m) { return m.type === 'interest' && m.content === 'sourdough baking'; }));
  const written = getPositions('pp-user', 'pp-guild');
  assert('postProcessor: valid claims stored as prefixed preferences', written.length === 3);
  assert('postProcessor: valid claims were the first three, not the fourth', written.every(function(p) {
    return p.claim !== 'a fourth claim past the per-message cap';
  }));
  const offWhitelistTypes = db.prepare(
    "SELECT COUNT(*) AS c FROM memory_entries WHERE user_id = 'pp-user' AND type NOT IN ('fact','interest','project','event','preference')"
  ).get().c;
  assert('postProcessor: no off-whitelist type was written', offWhitelistTypes === 0);

  // NEGATIVE CONTROL: a non-array positions field must not drop the entity batch.
  payload = {
    entities: [{ type: 'fact', name: 'Owns A Dog', context: 'walks it daily', confidence: 0.6 }],
    positions: 'not an array',
  };
  await postProcessConversation('pp-user', 'pp-guild-bad', 'chan-2', 'y'.repeat(60) + ' dogs', 'a reply', null);
  const badEntities = getMemoryEntries('pp-user', 'pp-guild-bad', 10);
  assert('postProcessor: non-array positions did not drop the entity batch',
    badEntities.some(function(m) { return m.content === 'owns a dog'; }));
  assert('postProcessor: non-array positions wrote no position',
    getPositions('pp-user', 'pp-guild-bad').length === 0);
}

runPostProcessor().then(function() {
  console.log('27-positions: ' + passed + '/' + (passed + failed) + ' assertions passed');
  if (failed > 0) console.error('27-positions: ' + failed + ' assertion(s) failed');
}).catch(function(e) {
  console.error('27-positions error:', e.message);
  process.exitCode = 1;
});
