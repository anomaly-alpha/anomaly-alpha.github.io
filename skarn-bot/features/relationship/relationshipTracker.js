const { getRelationship, updateRelationshipField, db } = require('../../db/database');

const DAILY_FAMILIARITY_CAP = 3;
const DAILY_DECAY = 1;
const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000;

function updateRelationship(userId, guildId, interactionType) {
  const rel = getRelationship(userId, guildId);
  const now = Date.now();
  const patch = {
    last_interaction_at: now,
    interaction_count: rel.interaction_count + 1,
  };

  // Familiarity gains
  let gain = 0;
  switch (interactionType) {
    case 'message':
      gain = 0.5;
      break;
    case 'ai_command':
      gain = 1;
      break;
    case 'mention':
      gain = 2;
      break;
    case 'etch':
      gain = 1;
      break;
    default:
      gain = 0;
  }

  // Daily cap on message-based familiarity
  if (interactionType === 'message') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (rel.last_interaction_at < todayStart.getTime()) {
      // First interaction today — start fresh
      patch.familiarity = Math.min(100, rel.familiarity + Math.min(gain, DAILY_FAMILIARITY_CAP));
    } else {
      // Check how much familiarity was gained today
      const todaysGain = rel.familiarity - (rel.familiarity % 1); // approximate
      const capRemaining = Math.max(0, DAILY_FAMILIARITY_CAP - gain);
      patch.familiarity = Math.min(100, rel.familiarity + Math.min(gain, capRemaining));
    }
  } else {
    patch.familiarity = Math.min(100, rel.familiarity + gain);
  }

  updateRelationshipField(userId, guildId, patch);
}

function getRelationshipLine(userId, guildId) {
  const rel = getRelationship(userId, guildId);
  const f = rel.familiarity;

  if (f < 15) {
    return "You don't know this person well yet. Keep it lighter, feel them out.";
  }
  if (f < 50) {
    return 'This is a familiar face in the server. Comfortable but casual.';
  }
  const tags = JSON.parse(rel.tags || '[]');
  const tagStr = tags.length > 0 ? tags.join(', ') : 'no tags yet';
  if (f < 80) {
    return `This one's been around. Known them a while. Banter level: ${rel.banter_level}. Tags: ${tagStr}`;
  }
  return `An old regular. You're comfortable with them. Banter level: ${rel.banter_level}. Tags: ${tagStr}`;
}

function applyBaselineFamiliarity() {
  // Users with stored facts get familiarity baseline
  const users = db.prepare(
    'SELECT user_id, guild_id, COUNT(*) as fact_count FROM user_memory GROUP BY user_id, guild_id'
  ).all();
  for (const u of users) {
    const base = u.fact_count >= 5 ? 25 : 15;
    const rel = getRelationship(u.user_id, u.guild_id);
    if (rel.familiarity < base) {
      updateRelationshipField(u.user_id, u.guild_id, { familiarity: base });
    }
  }
}

function recalculateTags(userId, guildId) {
  // Scheduled weekly: evaluate user's interaction patterns
  const rel = getRelationship(userId, guildId);
  const tags = [];

  if (rel.familiarity < 10 || rel.interaction_count < 5) tags.push('newcomer');
  if (rel.interaction_count >= 10) tags.push('regular');
  if (rel.familiarity > 50 && rel.interaction_count >= 30) tags.push('veteran');

  // Banter vs serious detection based on interaction count and familiarity velocity
  // Simple heuristic: high familiarity + high interaction = banter-prone
  if (rel.familiarity > 30 && rel.interaction_count > 15) tags.push('joker');
  if (rel.familiarity < 20 && rel.interaction_count > 10) tags.push('serious');

  updateRelationshipField(userId, guildId, { tags: JSON.stringify(tags) });
}

function runDecay() {
  const now = Date.now();
  const cutoff = now - DECAY_INTERVAL_MS;
  // Decay 1 point per day of no interaction
  db.prepare(
    'UPDATE user_relationship SET familiarity = MAX(0, familiarity - ?) WHERE last_interaction_at < ? AND familiarity > 0'
  ).run(DAILY_DECAY, cutoff);
}

module.exports = { updateRelationship, getRelationshipLine, applyBaselineFamiliarity, recalculateTags, runDecay };
