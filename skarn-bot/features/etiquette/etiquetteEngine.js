const { getFlag, setFlag, hasFlag, deleteFlag, getRelationship } = require('../../db/database');

const THANKS_PATTERNS = /\b(thanks|thank you|ty|tysm|thx|appreciate it|appreciate ya)\b/i;
const MILESTONES = [50, 100, 250, 500, 1000];

function getGratitudeDirective(content) {
  if (!THANKS_PATTERNS.test(content)) return '';
  return "They're thanking you. Acknowledge it in-character and move on. Don't dwell.";
}

function getFirstOfDayLine(userId, guildId) {
  const key = 'first_of_day_' + userId + '_' + guildId;
  const today = new Date().toDateString();
  const lastSeen = getFlag(key);
  if (lastSeen === today) return '';
  const rel = getRelationship(userId, guildId);
  if (!rel || rel.familiarity < 15) return '';
  setFlag(key, today, 86400000);
  return "This is your first interaction with this person today. Acknowledge the gap casually if relevant — 'oh hey', 'back again', 'was wondering when you'd show'. Don't overdo it.";
}

function getMilestoneLine(userId, interactionCount) {
  for (const m of MILESTONES) {
    const key = 'milestone_' + userId + '_' + m;
    if (interactionCount >= m && !hasFlag(key)) {
      setFlag(key, '1');
      return "This is this person's " + m + "th command. If it feels natural, note it dryly. Don't force a celebration.";
    }
  }
  return '';
}

function flagForApology(userId) {
  setFlag('apology_' + userId, '1', 600000);
}

function getApologyLine(userId) {
  const key = 'apology_' + userId;
  if (!hasFlag(key)) return '';
  deleteFlag(key);
  return "You may have given a bad answer last time. If relevant, acknowledge it briefly — 'my bad', 'i was off', 'let me try again'.";
}

function clearFlags() {}

module.exports = { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, flagForApology, getApologyLine, clearFlags };
