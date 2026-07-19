const REACTION_CHANCE = 0.1;

const REACTIONS = {
  positive: ['😊', '👍', '❤️', '🎉', '✨', '🔥'],
  negative: ['😢', '😤', '💔'],
  neutral: ['👀', '🤔', '✅', '💬'],
};

function shouldReactOnly(intent) {
  const casualIntents = ['casual', 'sharing', 'banter', 'greeting'];
  if (!casualIntents.includes(intent)) return false;
  return Math.random() < REACTION_CHANCE;
}

function pickReaction(sentiment) {
  if (sentiment > 0.2) {
    const pool = REACTIONS.positive;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (sentiment < -0.2) {
    const pool = REACTIONS.negative;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = REACTIONS.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { shouldReactOnly, pickReaction };
