const { db } = require('../../db/database');

const FIRST_IMPRESSIONS = [
  'This is your first real conversation. Observe more than you speak.',
  'You don\'t know this person yet. Keep it light, feel them out.',
  'New face. Let them set the pace.',
];

const MIN_INTERACTIONS_FOR_GROWTH = 5;
const MIN_WEEKLY_ENTRIES = 2;
const MIN_INTERACTIONS_FOR_EVAL = 10;
const WEEKS_TO_KEEP = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getGrowthLine(userId, guildId) {
  // Get interaction count from user_relationship
  const rel = db.prepare(
    'SELECT interaction_count FROM user_relationship WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const interactionCount = rel ? rel.interaction_count : 0;

  // First-impression territory
  if (interactionCount < MIN_INTERACTIONS_FOR_GROWTH) {
    const idx = Math.floor(Math.random() * FIRST_IMPRESSIONS.length);
    return FIRST_IMPRESSIONS[idx];
  }

  // Check weekly_sentiment_history from user_profile
  const profile = db.prepare(
    'SELECT weekly_sentiment_history FROM user_profile WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  if (!profile) return '';

  let history;
  try {
    history = JSON.parse(profile.weekly_sentiment_history || '[]');
  } catch {
    history = [];
  }

  if (history.length < MIN_WEEKLY_ENTRIES) return '';

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const diff = last - prev;

  if (diff > 0.3) return 'They seem more positive than before. Good sign.';
  if (diff < -0.3) return 'They seem heavier than last time. Be gentle.';
  return '';
}

function evaluateGrowth() {
  // Find all users with enough interactions
  const users = db.prepare(
    'SELECT user_id, guild_id FROM user_relationship WHERE interaction_count >= ?'
  ).all(MIN_INTERACTIONS_FOR_EVAL);

  const cutoff = Date.now() - WEEK_MS;
  let updated = 0;

  for (const u of users) {
    // Compute average sentiment from response_learning for the past 7 days
    const row = db.prepare(
      `SELECT AVG(after_sentiment) AS avg_sentiment
       FROM response_learning
       WHERE user_id = ? AND guild_id = ? AND created_at > ?`
    ).get(u.user_id, u.guild_id, cutoff);

    if (!row || row.avg_sentiment === null) continue;

    // Read existing history
    const profile = db.prepare(
      'SELECT weekly_sentiment_history FROM user_profile WHERE user_id = ? AND guild_id = ?'
    ).get(u.user_id, u.guild_id);

    let history = [];
    if (profile) {
      try {
        history = JSON.parse(profile.weekly_sentiment_history || '[]');
      } catch {
        history = [];
      }
    }

    history.push(row.avg_sentiment);

    // Keep only the last N entries
    if (history.length > WEEKS_TO_KEEP) {
      history = history.slice(history.length - WEEKS_TO_KEEP);
    }

    const historyJson = JSON.stringify(history);

    if (profile) {
      db.prepare(
        'UPDATE user_profile SET weekly_sentiment_history = ? WHERE user_id = ? AND guild_id = ?'
      ).run(historyJson, u.user_id, u.guild_id);
    } else {
      // Create profile row if it doesn't exist
      db.prepare(
        'INSERT INTO user_profile (user_id, guild_id, weekly_sentiment_history, last_profile_update_at) VALUES (?, ?, ?, ?)'
      ).run(u.user_id, u.guild_id, historyJson, Date.now());
    }

    updated++;
  }

  console.log(`[GrowthTracker] evaluateGrowth: processed ${updated} users`);
  return updated;
}

module.exports = { getGrowthLine, evaluateGrowth };
