const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const path = require('path');
const fs = require('fs');
const { getRelationship } = require('../../db/database');

const sentimentBuffer = new Map(); // "userId:guildId" → { scores[], timestamps[] }
const repeatBuffer = new Map();    // "userId" → { topics[], windowStart }
const consecutiveLongMessages = new Map(); // "userId:guildId" → count
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

  // Track consecutive long messages for "opening up" detection
  if (content.length > 200) {
    consecutiveLongMessages.set(key, (consecutiveLongMessages.get(key) || 0) + 1);
  } else {
    consecutiveLongMessages.delete(key);
  }
}

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
  try {
    const configPath = path.join(__dirname, '..', 'data', 'config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const aiChans = cfg[message.guild.id]?.aiChannels || [];
      if (aiChans.includes(message.channel.id)) return;
    }
  } catch {
    // Config unavailable — proceed with caution
  }

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

module.exports = { updateWarmth, getWarmthLine, getPatienceLine, maybeActiveListen };
