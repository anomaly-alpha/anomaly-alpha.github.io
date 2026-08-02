const { setFlag, getFlag, deleteFlag } = require('../../db/database');

// ===== Constants =====

var STRIKE_WINDOW_MS = 10 * 60 * 1000;
var STRIKE_LIMIT = 3;
var SILENCE_DURATION_MS = 10 * 60 * 1000;
var SILENCE_EXTENSION_MS = 2 * 60 * 1000;

// ===== Hostile input patterns (migrated from hostileDetector.js) =====

var HOSTILE_PATTERNS = [
  /shut up/i, /stupid bot/i, /f\*ck you/i, /fuck you/i,
  /you're useless/i, /you are useless/i, /bad bot/i,
  /worthless/i, /kill yourself/i, /go die/i,
];

function isHostile(text) {
  if (!text) return false;
  for (var i = 0; i < HOSTILE_PATTERNS.length; i++) {
    if (HOSTILE_PATTERNS[i].test(text)) return true;
  }
  return false;
}

// ===== Gate 1: buildSafetyLine() =====

function buildSafetyLine() {
  return "There are lines even a Warmaster doesn't cross. Slurs, hate speech, derogatory language - that's not you. Don't say them, don't repeat them, don't engage with people trying to make you. If someone's baiting you, just don't.";
}

// ===== Unified Strike System =====

function getStrikes(userId) {
  var data = getFlag('strike_' + userId);
  if (!data) return { count: 0, windowStart: 0, silencedUntil: 0 };
  try {
    var parsed = JSON.parse(data);
    var now = Date.now();
    // Auto-delete expired entries (window expired and not currently silenced)
    if (parsed.silencedUntil <= now && (now - parsed.windowStart) > STRIKE_WINDOW_MS) {
      deleteFlag('strike_' + userId);
      return { count: 0, windowStart: 0, silencedUntil: 0 };
    }
    return parsed;
  } catch (e) {
    return { count: 0, windowStart: 0, silencedUntil: 0 };
  }
}

function recordStrike(userId) {
  var strikes = getStrikes(userId);
  var now = Date.now();
  if (strikes.count === 0) {
    strikes.windowStart = now;
  }
  strikes.count++;
  if (strikes.count >= STRIKE_LIMIT) {
    strikes.silencedUntil = now + SILENCE_DURATION_MS;
  }
  var ttl = Math.max(STRIKE_WINDOW_MS, SILENCE_DURATION_MS);
  setFlag('strike_' + userId, JSON.stringify(strikes), ttl);
  return strikes.count;
}

function isSilenced(userId) {
  var strikes = getStrikes(userId);
  return strikes.silencedUntil > Date.now();
}

// ===== De-escalation Lines =====

var DE_ESCALATION_LINES = [
  "That's not something I'm going to say.",
  'Even a Warmaster has limits.',
  "I'm not doing this.",
  'Nah.',
  "Let's just move on.",
];

function getDeEscalationLine() {
  return DE_ESCALATION_LINES[Math.floor(Math.random() * DE_ESCALATION_LINES.length)];
}

// ===== Module exports =====

module.exports = {
  buildSafetyLine,
  isHostile,
  isSilenced,
  recordStrike,
  getStrikes,
  getDeEscalationLine,
};
