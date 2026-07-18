const { getRelationship } = require('../../db/database');

const flaggedUsers = new Map();
const acknowledgedMilestones = new Set();
const firstOfDayCache = new Map();

const THANKS_PATTERNS = /\b(thanks|thank you|ty|tysm|thx|appreciate it|appreciate ya)\b/i;
const MILESTONES = [50, 100, 250, 500, 1000];

function getGratitudeDirective(content) {
  if (!THANKS_PATTERNS.test(content)) return '';
  return "They're thanking you. Acknowledge it in-character and move on. Don't dwell.";
}

function getFirstOfDayLine(userId, guildId) {
  const key = `${userId}:${guildId}`;
  const today = new Date().toDateString();
  const lastSeen = firstOfDayCache.get(key);

  if (lastSeen === today) return '';

  const rel = getRelationship(userId, guildId);
  if (!rel || rel.familiarity < 15) return '';

  firstOfDayCache.set(key, today);
  return "This is your first interaction with this person today. Acknowledge the gap casually if relevant — 'oh hey', 'back again', 'was wondering when you'd show'. Don't overdo it.";
}

function getMilestoneLine(userId, interactionCount) {
  for (const m of MILESTONES) {
    const key = `${userId}:${m}`;
    if (interactionCount >= m && !acknowledgedMilestones.has(key)) {
      acknowledgedMilestones.add(key);
      return `This is this person's ${m}th command. If it feels natural, note it dryly. Don't force a celebration.`;
    }
  }
  return '';
}

function flagForApology(userId) {
  flaggedUsers.set(userId, Date.now());
}

function getApologyLine(userId) {
  if (!flaggedUsers.has(userId)) return '';
  flaggedUsers.delete(userId);
  return "You may have given a bad answer last time. If relevant, acknowledge it briefly — 'my bad', 'i was off', 'let me try again'.";
}

function clearFlags() {
  const now = Date.now();
  for (const [userId, at] of flaggedUsers) {
    if (now - at > 10 * 60 * 1000) flaggedUsers.delete(userId);
  }
}

module.exports = { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, flagForApology, getApologyLine, clearFlags };
