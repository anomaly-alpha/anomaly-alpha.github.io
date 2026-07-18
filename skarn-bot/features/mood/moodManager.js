const { getGuildInteractionStats, getGuildMood, updateGuildMood } = require('../../db/database');

const MOOD_LINES = {
  refreshed: "You're feeling alert and present. The static is clear today.",
  neutral: '',
  tired: "You've been busy. Responses are a bit shorter today. You're present but conserving energy.",
  amused: "Something about the conversation today has you amused. You're playing along.",
  focused: "The conversation has been substantive. You're keeping it direct and grounded.",
};

function evaluateMood(guildId) {
  const stats = getGuildInteractionStats(guildId, Date.now() - 2 * 60 * 60 * 1000);
  const totalInteractions = stats.total_interactions || 0;
  const avgFamiliarity = stats.avg_familiarity || 0;

  if (totalInteractions === 0) return 'refreshed';
  if (totalInteractions > 100) return 'tired';
  if (avgFamiliarity > 30 && totalInteractions > 50) return 'amused';
  if (avgFamiliarity < 15 && totalInteractions > 20) return 'focused';
  return 'neutral';
}

function getMoodLine(guildId) {
  const guildMood = getGuildMood(guildId);
  const now = Date.now();

  if (now - guildMood.last_mood_shift_at > 10 * 60 * 1000) {
    const newMood = evaluateMood(guildId);
    if (newMood !== guildMood.current_mood) {
      updateGuildMood(guildId, newMood);
      guildMood.current_mood = newMood;
    }
  }

  return MOOD_LINES[guildMood.current_mood] || '';
}

module.exports = { getMoodLine, evaluateMood };
