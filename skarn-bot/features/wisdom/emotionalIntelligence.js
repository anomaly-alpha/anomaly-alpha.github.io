const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { getUserEmotion, setUserEmotion } = require('../../db/database');

const EMOTION_KEYWORDS = {
  happy: ['happy', 'great', 'awesome', 'love', 'amazing', 'excited', 'wonderful', 'best'],
  sad: ['sad', 'depressed', 'lonely', 'heartbroken', 'miss', 'cry', 'grief'],
  anxious: ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'scared', 'fear'],
  angry: ['angry', 'furious', 'pissed', 'hate', 'annoyed', 'frustrated', 'rage'],
  stressed: ['stressed', 'overwhelmed', 'swamped', 'burned out', 'exhausted', 'too much'],
};

function detectEmotion(text) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  const sentiment = analyzeSentiment(text);
  let maxScore = 0;
  let detected = 'neutral';
  for (const [emotion, words] of Object.entries(EMOTION_KEYWORDS)) {
    const score = words.filter(w => lower.includes(w)).length;
    if (score > maxScore) { maxScore = score; detected = emotion; }
  }
  if (sentiment > 0.6 && maxScore === 0) detected = 'happy';
  if (sentiment < -0.6 && maxScore === 0) detected = 'sad';
  return detected;
}

function updateEmotion(userId, guildId, text) {
  const emotion = detectEmotion(text);
  setUserEmotion(userId, guildId, emotion);
  return emotion;
}

function getEmotionDirective(userId, guildId) {
  const emotion = getUserEmotion(userId, guildId);
  if (!emotion || emotion.emotional_state === 'neutral') return '';
  const directives = {
    happy: 'They seem happy. Match their energy, be warm and celebratory.',
    sad: 'They seem down. Be gentle, offer support, don\'t force positivity.',
    anxious: 'They seem anxious. Be calm, reassuring, grounded.',
    angry: 'They seem frustrated. Don\'t match the anger. Be steady and let them vent.',
    stressed: 'They seem stressed. Be practical, offer perspective, keep it light.',
  };
  return directives[emotion.emotional_state] || '';
}

module.exports = { detectEmotion, updateEmotion, getEmotionDirective };
