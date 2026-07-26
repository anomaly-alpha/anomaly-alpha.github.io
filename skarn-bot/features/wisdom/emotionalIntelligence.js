const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { getUserEmotion, setUserEmotion, logEmotionHistory, getEmotionTrend, getMemoryEntries, getSentimentTrend, getServerClimate } = require('../../db/database');
const { analyzeTone } = require('../intelligence/toneAnalyzer');

const EMOTION_WEIGHTS = { happy: 1, neutral: 0, sad: -1, anxious: -1, angry: -1, stressed: -1 };

async function detectEmotion(text) {
  if (!text) return 'neutral';
  try {
    const tone = await analyzeTone(text);
    return tone.emotion;
  } catch (e) {
    return 'neutral';
  }
}

async function updateEmotion(userId, guildId, text) {
  let emotion, intensity, subtext;
  try {
    const tone = await analyzeTone(text);
    emotion = tone.emotion;
    intensity = tone.intensity;
    subtext = tone.subtext;
  } catch (e) {
    emotion = 'neutral';
    intensity = 0;
    subtext = '';
  }

  const sentiment = intensity > 0 ? (emotion === 'happy' ? intensity : -intensity) : analyzeSentiment(text);
  setUserEmotion(userId, guildId, emotion);
  logEmotionHistory(userId, guildId, emotion, sentiment);

  // Store subtext in memory if non-empty (so Skarn can reference it later)
  if (subtext && subtext.length > 3) {
    try {
      const { addMemoryEntry } = require('../../db/database');
      addMemoryEntry(userId, guildId || 'dm', 'extracted', 'preference', 'tone_subtext: ' + subtext, 0.4, text.slice(0, 100));
    } catch (e) { /* best-effort */ }
  }

  return emotion;
}

// ===== [1] Emotional Trajectory =====
function getTrajectoryDirective(userId, guildId) {
  const history = getEmotionTrend(userId, guildId, 8);
  if (history.length < 3) return '';

  // Reverse to chronological order
  const ordered = history.slice().reverse();

  // Count negative emotions in recent history
  const recent = ordered.slice(-4);
  const negativeCount = recent.filter(e => EMOTION_WEIGHTS[e.emotion] < 0).length;
  const prevCount = ordered.slice(0, 4).filter(e => EMOTION_WEIGHTS[e.emotion] < 0).length;

  // Detect improving: was negative, now positive
  const wasNegative = prevCount >= 3;
  const isGettingBetter = wasNegative && negativeCount <= 1 && recent.length >= 3;

  // Detect declining trend
  const isDeclining = negativeCount >= 3 && recent.length >= 3 && negativeCount >= prevCount;

  // Detect cycling (alternating negative/positive)
  const uniqueEmotions = [...new Set(recent.map(e => e.emotion))];
  const isCycling = uniqueEmotions.length >= 3 && negativeCount >= 2;

  if (isGettingBetter) {
    return 'They\'ve been doing better lately after a rough patch. Notice the improvement — acknowledge it lightly if natural: "good to see you in better spirits."';
  }
  if (isDeclining) {
    return 'Their mood has been declining recently. Go easy. Offer steady support without forcing it. If the moment fits, a gentle check-in like "you seem off — you good?" can help.';
  }
  if (isCycling) {
    return 'They\'ve been emotionally up and down. Be steady — don\'t match the highs too high or the lows too low. Consistency is what they need.';
  }
  return '';
}

// ===== [2] Memory-Emotion Crossover =====
function getMemoryEmotionLine(userId, guildId) {
  const emotion = getUserEmotion(userId, guildId);
  if (!emotion || emotion.emotional_state === 'neutral' || emotion.emotional_state === 'happy') return '';

  // Get recent event-type memories
  const events = getMemoryEntries(userId, guildId, 15)
    .filter(m => m.source === 'etch' && (m.type === 'event' || m.type === 'fact'));

  if (events.length === 0) return '';

  // Pick the most relevant event to pair with current emotion
  const state = emotion.emotional_state;
  const emotionPairs = {
    sad: ['miss', 'lost', 'goodbye', 'passed', 'left', 'breakup'],
    anxious: ['interview', 'exam', 'test', 'meeting', 'deadline', 'surgery', 'appointment'],
    angry: ['boss', 'manager', 'unfair', 'fired', 'argument', 'fight'],
    stressed: ['deadline', 'project', 'work', 'overload', 'busy', 'schedule'],
  };

  const keywords = emotionPairs[state] || [];
  let bestMatch = null;
  let bestScore = 0;

  for (const event of events) {
    const content = (event.content + ' ' + (event.context || '')).toLowerCase();
    const score = keywords.filter(k => content.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestMatch = event; }
  }

  if (bestMatch && bestScore > 0) {
    const templates = {
      sad: 'They\'re feeling down and mentioned something about "' + bestMatch.content + '" — if relevant, connect gently.',
      anxious: 'They seem anxious and mentioned "' + bestMatch.content + '" — they might be worried about this.',
      angry: 'They\'re frustrated and mentioned "' + bestMatch.content + '" — this may be related.',
      stressed: 'They seem stressed and mentioned "' + bestMatch.content + '" — this could be why.',
    };
    return templates[state] || '';
  }
  return '';
}

// ===== [3] In-Conversation Escalation Detection =====
function getEscalationDirective(channelId) {
  try {
    const buffer = getSentimentTrend(channelId, 5);
    if (buffer.length < 3) return '';

    // Compute sentiment slope (are they getting more negative?)
    const ordered = buffer.slice().reverse();
    const first = ordered[0].sentiment || 0;
    const last = ordered[ordered.length - 1].sentiment || 0;
    const slope = last - first;

    // Detect sharp drop (escalating negativity)
    if (slope < -0.5) {
      return 'This conversation is escalating negatively. Stay calm, don\'t match the rising tension. Short, grounded responses.';
    }
    // Detect rising positivity
    if (slope > 0.5) {
      return 'The conversation is becoming more positive. Match the rising energy naturally.';
    }
  } catch (e) { /* escalation tracking unavailable */ }
  return '';
}

// ===== [4] Response Calibration =====
function getCalibrationDirective(userId, guildId, hitRate, missRate, sampleSize) {
  if (sampleSize < 10) return '';

  const emotion = getUserEmotion(userId, guildId);
  if (!emotion || emotion.emotional_state === 'neutral') return '';

  // Check if current approach is working for THIS emotional state
  // (hitRate/missRate comes from getResponseInsights already filtered)
  const state = emotion.emotional_state;

  if (missRate > 0.4) {
    const adjustments = {
      sad: 'Your supportive responses aren\'t landing well with them when they\'re down. Try being more direct — ask what they need instead of offering comfort.',
      anxious: 'Your reassuring tone isn\'t working when they\'re anxious. Try being more practical and less abstract.',
      angry: 'Your steady approach isn\'t helping when they\'re frustrated. Let them vent more before responding.',
      stressed: 'Your practical advice isn\'t landing when they\'re stressed. Try acknowledging the overwhelm first.',
    };
    return adjustments[state] || '';
  }

  if (hitRate > 0.6) {
    const reinforces = {
      sad: 'Your approach when they\'re down is working. Maintain this tone.',
      anxious: 'Your reassuring style when they\'re anxious is effective. Keep it up.',
      angry: 'Your handling of their frustration is working. Stay steady.',
      stressed: 'Your practical tone when they\'re stressed is landing well.',
    };
    return reinforces[state] || '';
  }

  return '';
}

// ===== [5] Server Climate =====
function getClimateLine(guildId) {
  try {
    const climate = getServerClimate(guildId);
    if (!climate.totalDistinct || climate.totalDistinct < 3) return '';

    const dominant = climate.distribution[0];
    if (!dominant) return '';

    if (dominant.emotional_state === 'stressed' || dominant.emotional_state === 'anxious') {
      return 'The server feels heavy right now — several people are stressed or anxious. Keep your tone warmer and more supportive than usual.';
    }
    if (dominant.emotional_state === 'happy') {
      return 'The server is in good spirits — people seem happy. Match the positive energy.';
    }
  } catch (e) { /* server climate unavailable */ }
  return '';
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
  var line = directives[emotion.emotional_state] || '';

  // Check for stored subtext from tone analysis
  var toneNotes = [];
  try {
    var memories = getMemoryEntries(userId, guildId, 5);
    var subtexts = memories.filter(function(m) { return m.type === 'preference' && m.content.startsWith('tone_subtext:'); });
    if (subtexts.length > 0) {
      toneNotes.push('Tone note from recent analysis: ' + subtexts[0].content.replace('tone_subtext: ', ''));
    }
  } catch (e) { /* best-effort */ }

  return toneNotes.length > 0 ? line + ' ' + toneNotes.join(' ') : line;
}

module.exports = {
  detectEmotion, updateEmotion,
  getEmotionDirective,
  getTrajectoryDirective,
  getMemoryEmotionLine,
  getEscalationDirective,
  getCalibrationDirective,
  getClimateLine,
};
