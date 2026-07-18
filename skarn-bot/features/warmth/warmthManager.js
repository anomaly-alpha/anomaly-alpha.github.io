const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const path = require('path');
const fs = require('fs');
const { getRelationship } = require('../../db/database');

// ===== In-memory state =====
const sentimentBuffer = new Map(); // "userId:guildId" → { scores[], timestamps[] }
const repeatBuffer = new Map();    // "userId:guildId" → { topics[], windowStart }
const consecutiveLongMessages = new Map(); // "userId:guildId" → count
const ACTIVE_LISTEN_COOLDOWN = 5 * 60 * 1000;
const activeListenCooldowns = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ===== Cached AI channel set (avoids disk I/O on every message) =====
let aiChannelSet = null;
let aiCacheLoadedAt = 0;

function refreshAiChannels() {
  try {
    const configPath = path.join(__dirname, '..', '..', 'data', 'config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      aiChannelSet = new Set();
      for (const guildId in cfg) {
        const chans = cfg[guildId]?.aiChannels || [];
        for (const cid of chans) aiChannelSet.add(cid);
      }
      aiCacheLoadedAt = Date.now();
    }
  } catch {
    // Config unavailable — skip
  }
}
// Load once at module init
refreshAiChannels();

// ===== Warmth tracking =====

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

  // Track consecutive long messages for "opening up" detection
  if (content.length > 200) {
    consecutiveLongMessages.set(key, (consecutiveLongMessages.get(key) || 0) + 1);
  } else {
    consecutiveLongMessages.delete(key);
  }
}

// ===== Context lines =====

function getWarmthLine(userId, guildId, roleNature) {
  const key = `${userId}:${guildId}`;
  const buf = sentimentBuffer.get(key);
  if (!buf || buf.scores.length < 2) return '';
  const avgSentiment = buf.scores.reduce((a, b) => a + b, 0) / buf.scores.length;
  const rel = getRelationship(userId, guildId);
  const familiarity = rel ? rel.familiarity : 0;

  // Consecutive long messages — user is opening up
  if ((consecutiveLongMessages.get(key) || 0) >= 3 && roleNature === 'casual') {
    return "They're opening up. Listen more, react naturally.";
  }

  if (avgSentiment < -0.3 && familiarity > 15) {
    return "This person seems off today. Be present, not pushy. If they want to talk, let them. If not, don't force it.";
  }
  if (avgSentiment > 0.5 && familiarity > 30) {
    return 'This person is in a good mood. Match their energy — light and easy.';
  }
  return '';
}

function getPatienceLine(userId, guildId, content) {
  const key = `${userId}:${guildId}`;
  if (!repeatBuffer.has(key)) {
    repeatBuffer.set(key, { topics: [], windowStart: Date.now() });
  }
  const buf = repeatBuffer.get(key);
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

// ===== Active listening =====

async function maybeActiveListen(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Only fire in non-AI channels (cached set, O(1) lookup)
  if (aiChannelSet && aiChannelSet.has(message.channel.id)) return;

  // Only for users with established relationship
  const rel = getRelationship(message.author.id, message.guild.id);
  if (!rel || rel.familiarity <= 15) return;

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

// ===== Cleanup (prevents unbounded memory growth) =====

function cleanWarmth() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  // Refresh AI channel cache if stale
  if (now - aiCacheLoadedAt > CACHE_TTL) {
    refreshAiChannels();
  }

  // Prune old sentiment buffers
  for (const [key, buf] of sentimentBuffer) {
    const recent = buf.timestamps.filter(t => now - t < oneHour);
    if (recent.length === 0) {
      sentimentBuffer.delete(key);
    } else {
      buf.scores = buf.scores.slice(-recent.length);
      buf.timestamps = recent;
    }
  }

  // Prune old active listen cooldowns
  for (const [channelId, ts] of activeListenCooldowns) {
    if (now - ts > 10 * 60 * 1000) activeListenCooldowns.delete(channelId);
  }

  // Prune old consecutive long message tracking
  for (const [key] of consecutiveLongMessages) {
    if (!sentimentBuffer.has(key)) consecutiveLongMessages.delete(key);
  }
}

module.exports = {
  updateWarmth,
  getWarmthLine,
  getPatienceLine,
  maybeActiveListen,
  cleanWarmth,
  refreshAiChannels,
};
