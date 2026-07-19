const { db } = require('../../db/database');

const WINDOW_SIZE = 20;
const HIT_THRESHOLD = 0.1;
const MISS_THRESHOLD = -0.1;

function trackResponse(userId, guildId, beforeSentiment, afterSentiment) {
  const diff = afterSentiment - beforeSentiment;
  let classification;
  if (diff >= HIT_THRESHOLD) {
    classification = 'hit';
  } else if (diff <= MISS_THRESHOLD) {
    classification = 'miss';
  } else {
    classification = 'neutral';
  }

  db.prepare(
    `INSERT INTO response_learning (user_id, guild_id, before_sentiment, after_sentiment, diff, classification, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, guildId, beforeSentiment, afterSentiment, diff, classification, Date.now());
}

function getResponseInsights(userId, guildId) {
  const recent = db.prepare(
    `SELECT * FROM response_learning WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(userId, guildId, WINDOW_SIZE);

  if (recent.length === 0) {
    return { sampleSize: 0, hitRate: 0, missRate: 0, guidance: 'Not enough data yet.' };
  }

  const hits = recent.filter(r => r.classification === 'hit').length;
  const misses = recent.filter(r => r.classification === 'miss').length;
  const hitRate = hits / recent.length;
  const missRate = misses / recent.length;

  let guidance;
  if (hitRate > 0.6) {
    guidance = 'Responses landing well. Maintain current approach.';
  } else if (missRate > 0.4) {
    guidance = 'High miss rate. Consider adjusting tone or response length.';
  } else if (hitRate < 0.3 && recent.length >= 10) {
    guidance = 'Low hit rate. Try varying response patterns.';
  } else {
    guidance = 'Mixed signals. Monitor over more interactions.';
  }

  return { sampleSize: recent.length, hitRate, missRate, guidance };
}

module.exports = { trackResponse, getResponseInsights };
