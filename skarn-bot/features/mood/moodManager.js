const { getGuildInteractionStats } = require('../../db/database');

// ===== Volume energy =====
// Mood is an input to the stance lever (features/wisdom/stance.js), not a prompt
// line: the canned line and its table are gone, only the energy read survives.
function evaluateMood(guildId) {
  const stats = getGuildInteractionStats(guildId, Date.now() - 2 * 60 * 60 * 1000);
  const totalInteractions = stats.total_interactions || 0;
  const avgFamiliarity = stats.avg_familiarity || 0;

  if (totalInteractions === 0) return 'refreshed';
  if (totalInteractions > 100 && avgFamiliarity < 10) return 'wrath';
  if (avgFamiliarity > 30 && totalInteractions > 50) return 'amused';
  if (totalInteractions > 100) return 'tired';
  if (avgFamiliarity < 15 && totalInteractions > 20) return 'focused';
  return 'neutral';
}

module.exports = { evaluateMood };
