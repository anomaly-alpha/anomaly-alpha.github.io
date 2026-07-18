const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const sentimentBuffer = new Map(); // "userId:guildId" → { scores[], timestamps[] }
const repeatBuffer = new Map();    // "userId" → { topics[], windowStart }
const ACTIVE_LISTEN_COOLDOWN = 5 * 60 * 1000;
const activeListenCooldowns = new Map();

function updateWarmth(userId, guildId, content) {
  const key = `${userId}:${guildId}`;
  const result = sentiment.analyze(content);
  if (!sentimentBuffer.has(key)) {
    sentimentBuffer.set(key, { scores: [], timestamps: [] });
  }
  const buf = sentimentBuffer.get(key);
  buf.scores.push(result.comparative);
  buf.timestamps.push(Date.now());
  // Keep last 5
  if (buf.scores.length > 5) {
    buf.scores.shift();
    buf.timestamps.shift();
  }
}

function getWarmthLine(userId, guildId, roleNature) {
  const key = `${userId}:${guildId}`;
  const buf = sentimentBuffer.get(key);
  if (!buf || buf.scores.length < 2) return '';
  const avgSentiment = buf.scores.reduce((a, b) => a + b, 0) / buf.scores.length;

  if (avgSentiment < -0.3) {
    return "This person seems off today. Be present, not pushy. If they want to talk, let them. If not, don't force it.";
  }
  if (avgSentiment > 0.5) {
    return 'This person is in a good mood. Match their energy — light and easy.';
  }
  return '';
}

function getPatienceLine(userId, content) {
  if (!repeatBuffer.has(userId)) {
    repeatBuffer.set(userId, { topics: [], windowStart: Date.now() });
  }
  const buf = repeatBuffer.get(userId);
  // Reset window every 30 min
  if (Date.now() - buf.windowStart > 30 * 60 * 1000) {
    buf.topics = [];
    buf.windowStart = Date.now();
  }
  // Simple repeat detection: normalize and check for overlap
  const normalized = content.toLowerCase().trim();
  const similar = buf.topics.filter(t => {
    const longer = normalized.length > t.length ? normalized : t;
    const shorter = normalized.length > t.length ? t : normalized;
    return longer.includes(shorter);
  });
  buf.topics.push(normalized);
  if (buf.topics.length > 10) buf.topics.shift();

  if (similar.length >= 2) {
    return "They're not getting it. Be clearer this time — drop the wit, give the answer straight.";
  }
  return '';
}

async function maybeActiveListen(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Only fire in non-AI channels
  const channelId = message.channel.id;
  const now = Date.now();
  const lastCue = activeListenCooldowns.get(channelId) || 0;
  if (now - lastCue < ACTIVE_LISTEN_COOLDOWN) return;

  // Only on long messages
  if (message.content.length <= 200) return;

  // Low chance
  if (Math.random() > 0.05) return;

  const cues = ['mhm', 'yeah?', 'go on', "i'm listening", 'wait really?', 'say more'];
  const cue = cues[Math.floor(Math.random() * cues.length)];

  try {
    // Brief delay so it feels like Skarn is reading
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    await message.channel.send(cue);
    activeListenCooldowns.set(channelId, now);
  } catch {
    // Permission issue — silently ignore
  }
}

module.exports = { updateWarmth, getWarmthLine, getPatienceLine, maybeActiveListen };
