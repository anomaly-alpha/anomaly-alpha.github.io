// ===== Positions =====
// A position is what the person CLAIMS or BELIEVES ("capitalism is broken",
// "my brother is the reliable one") — not a neutral fact and not a taste
// preference. Stored as a prefixed preference row: type='preference',
// content='position: <claim>'. No schema change, no migration — same trick as
// the 'tone_subtext: ' prefix in emotionalIntelligence.js. Identical claims
// are deduped for free by UNIQUE(user_id, guild_id, type, content).

var { db } = require('../../db/database');

var POSITION_PREFIX = 'position: ';
var POSITION_LIMIT = 20;
var MIN_TOKEN_LENGTH = 4;
var POSITION_INSTRUCTION = 'That is what they said before, on this same subject. Open by naming the difference against it ("last time you said...") before you argue the claim itself. Ignore this only if your reply fully agrees with what they said.';

var STOPWORDS = {
  about: 1, after: 1, again: 1, also: 1, another: 1, because: 1, been: 1, before: 1,
  being: 1, both: 1, cannot: 1, could: 1, does: 1, doing: 1, down: 1, even: 1,
  ever: 1, from: 1, have: 1, having: 1, here: 1, into: 1, just: 1, like: 1,
  make: 1, many: 1, more: 1, most: 1, much: 1, must: 1, need: 1, only: 1,
  other: 1, over: 1, really: 1, same: 1, should: 1, some: 1, still: 1, such: 1,
  than: 1, that: 1, their: 1, them: 1, then: 1, there: 1, these: 1, they: 1,
  thing: 1, things: 1, think: 1, this: 1, those: 1, through: 1, very: 1, want: 1,
  well: 1, were: 1, what: 1, when: 1, where: 1, which: 1, while: 1, with: 1,
  would: 1, your: 1, yours: 1,
};

// ===== Read Path =====

function getPositions(userId, guildId) {
  if (!userId) return [];
  var rows = db.prepare(
    "SELECT content, context, last_seen_at FROM memory_entries " +
    "WHERE user_id = ? AND guild_id = ? AND type = 'preference' AND content LIKE 'position:%' " +
    "ORDER BY last_seen_at DESC, id DESC LIMIT ?"
  ).all(userId, guildId || 'dm', POSITION_LIMIT);
  var positions = [];
  for (var i = 0; i < rows.length; i++) {
    var claim = String(rows[i].content || '').slice(POSITION_PREFIX.length).trim();
    if (!claim) continue;
    positions.push({ claim: claim, context: rows[i].context || null, createdAt: rows[i].last_seen_at });
  }
  return positions;
}

function formatPosition(claim) {
  return 'They previously said: "' + claim + '". ' + POSITION_INSTRUCTION;
}

// ===== Overlap =====

function tokenize(text) {
  var parts = String(text || '').toLowerCase().split(/[^a-z0-9']+/);
  var tokens = [];
  for (var i = 0; i < parts.length; i++) {
    var token = parts[i].replace(/^'+|'+$/g, '');
    if (token.length < MIN_TOKEN_LENGTH) continue;
    if (STOPWORDS[token]) continue;
    tokens.push(token);
  }
  return tokens;
}

function countOverlap(tokens, claimTokens) {
  var shared = 0;
  var counted = {};
  for (var i = 0; i < claimTokens.length; i++) {
    var token = claimTokens[i];
    if (counted[token]) continue;
    if (tokens.indexOf(token) === -1) continue;
    counted[token] = true;
    shared++;
  }
  return shared;
}

// One position, the best overlap. Never the whole list.
// The claim is user text and the instruction is ours, so they stay separate:
// prompt assembly can wrap the claim in <untrusted_data> without disarming it.
function matchPosition(currentMessage, positions) {
  if (!positions || !positions.length) return null;
  var tokens = tokenize(currentMessage);
  if (!tokens.length) return null;
  var bestClaim = null;
  var bestScore = 0;
  for (var i = 0; i < positions.length; i++) {
    var claim = positions[i] && positions[i].claim;
    if (!claim) continue;
    var score = countOverlap(tokens, tokenize(claim));
    if (score > bestScore) {
      bestScore = score;
      bestClaim = claim;
    }
  }
  if (!bestClaim) return null;
  return { claim: bestClaim, instruction: POSITION_INSTRUCTION };
}

function buildPositionLine(currentMessage, positions) {
  var match = matchPosition(currentMessage, positions);
  if (!match) return '';
  return formatPosition(match.claim);
}

module.exports = { POSITION_PREFIX, POSITION_LIMIT, getPositions, matchPosition, buildPositionLine, formatPosition };
