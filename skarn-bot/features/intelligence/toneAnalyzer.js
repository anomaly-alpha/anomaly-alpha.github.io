const getOpenAIClient = require('../../ai/client');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { assertUserGate, releaseCall } = require('../../lib/rateLimit');

const EMOTION_KEYWORDS = {
  happy: ['happy', 'great', 'awesome', 'love', 'amazing', 'excited', 'wonderful', 'best'],
  sad: ['sad', 'depressed', 'lonely', 'heartbroken', 'miss', 'cry', 'grief'],
  anxious: ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'scared', 'fear'],
  angry: ['angry', 'furious', 'pissed', 'hate', 'annoyed', 'frustrated', 'rage'],
  stressed: ['stressed', 'overwhelmed', 'swamped', 'burned out', 'exhausted', 'too much'],
};

const TONE_SYSTEM_PROMPT = `Analyze the emotional tone of the user's message. Return a JSON object with exactly these fields:
- emotion: one of "happy", "sad", "anxious", "angry", "stressed", "neutral"
- intensity: number 0.0 to 1.0 — how strongly they feel this
- subtext: one short sentence describing what they might really be feeling beneath the surface, or "" if surface-level only
- pacing: one of "calm", "urgent", "resigned", "energetic", "flat"

Only respond with the JSON object. No other text.`;

const TONE_EXAMPLES = [
  { msg: "i'm fine. it's whatever.", result: { emotion: "sad", intensity: 0.6, subtext: "They are not fine. They're deflecting.", pacing: "resigned" } },
  { msg: "I GOT THE JOB!!!", result: { emotion: "happy", intensity: 0.9, subtext: "", pacing: "energetic" } },
  { msg: "can you help me with this bug real quick", result: { emotion: "stressed", intensity: 0.4, subtext: "They're pressed for time and frustrated with the code.", pacing: "urgent" } },
];

// Cache: avoid re-analyzing identical messages within 5 minutes
const TONE_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function analyzeTone(text, userId) {
  if (!text || text.length < 3) {
    return fallbackAnalysis(text);
  }

  // Check cache
  const cached = TONE_CACHE.get(text);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.result;
  }

  const gateId = assertUserGate(userId);
  if (!gateId) return fallbackAnalysis(text);

  try {
    const client = getOpenAIClient();
    const messages = [
      { role: 'system', content: TONE_SYSTEM_PROMPT },
      // Few-shot examples
      ...TONE_EXAMPLES.flatMap(ex => [
        { role: 'user', content: ex.msg },
        { role: 'assistant', content: JSON.stringify(ex.result) },
      ]),
      { role: 'user', content: text },
    ];

    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: messages,
      max_completion_tokens: 100,
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    const result = {
      emotion: parsed.emotion || 'neutral',
      intensity: typeof parsed.intensity === 'number' ? parsed.intensity : 0,
      subtext: parsed.subtext || '',
      pacing: parsed.pacing || 'calm',
    };

    // Cache
    TONE_CACHE.set(text, { result, ts: Date.now() });
    // Prune old cache entries
    if (TONE_CACHE.size > 100) {
      const now = Date.now();
      for (const [key, val] of TONE_CACHE) {
        if (now - val.ts > CACHE_TTL) TONE_CACHE.delete(key);
      }
    }

    return result;
  } catch (e) {
    console.error('[ToneAnalyzer] AI analysis failed, using fallback:', e.message);
    releaseCall(userId, 'command', gateId);
    return fallbackAnalysis(text);
  }
}

function fallbackAnalysis(text) {
  if (!text) return { emotion: 'neutral', intensity: 0, subtext: '', pacing: 'calm' };

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

  const intensity = Math.abs(sentiment);
  return { emotion: detected, intensity, subtext: '', pacing: 'calm' };
}

module.exports = { analyzeTone };
