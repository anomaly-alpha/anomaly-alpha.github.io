const { getFlag, setFlag, deleteFlag } = require('../../db/database');

var HOSTILE_PATTERNS = [
  /shut up/i, /stupid bot/i, /f\*ck you/i, /fuck you/i,
  /you're useless/i, /you are useless/i, /bad bot/i,
  /worthless/i, /kill yourself/i, /go die/i,
];

var STRIKE_LIMIT = 3;
var STRIKE_WINDOW_MS = 60 * 60 * 1000;

function isHostile(text) {
  if (!text) return false;
  for (var i = 0; i < HOSTILE_PATTERNS.length; i++) {
    if (HOSTILE_PATTERNS[i].test(text)) return true;
  }
  return false;
}

function getStrikes(userId) {
  var data = getFlag('hostile_' + userId + '_strikes');
  if (!data) return { count: 0, windowStart: 0 };
  try {
    var parsed = JSON.parse(data);
    var elapsed = Date.now() - parsed.windowStart;
    if (elapsed > STRIKE_WINDOW_MS) {
      deleteFlag('hostile_' + userId + '_strikes');
      return { count: 0, windowStart: 0 };
    }
    return parsed;
  } catch (e) {
    return { count: 0, windowStart: 0 };
  }
}

function recordStrike(userId) {
  var strikes = getStrikes(userId);
  var now = Date.now();
  if (strikes.count === 0) {
    strikes.windowStart = now;
  }
  strikes.count++;
  setFlag('hostile_' + userId + '_strikes', JSON.stringify(strikes), STRIKE_WINDOW_MS);
  return strikes.count;
}

function isSilenced(userId) {
  var strikes = getStrikes(userId);
  return strikes.count >= STRIKE_LIMIT;
}

module.exports = { isHostile, getStrikes, recordStrike, isSilenced };
