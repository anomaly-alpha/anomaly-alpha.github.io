const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const path = require('path');
const fs = require('fs');
const { db, getRelationship, checkActiveListenCooldown, setActiveListenCooldown, getFlag, setFlag, deleteFlag, getGuildConfig } = require('../../db/database');

// ===== Cached AI channel set (avoids disk I/O on every message) =====
let aiChannelSet = null;
let aiCacheLoadedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

function refreshAiChannels() {
  aiChannelSet = new Set();
  try {
    var rows = db.prepare('SELECT DISTINCT guild_id FROM guild_config WHERE key = ?').all('aiChannels');
    for (var r of rows) {
      var chans = getGuildConfig(r.guild_id, 'aiChannels');
      if (Array.isArray(chans)) {
        for (var cid of chans) aiChannelSet.add(cid);
      }
    }
    aiCacheLoadedAt = Date.now();
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

  // Persist sentiment scores to SQLite via app_flags
  const raw = getFlag(`warmth_sent:${key}`);
  const buf = raw ? JSON.parse(raw) : { scores: [], timestamps: [] };
  buf.scores.push(result.comparative);
  buf.timestamps.push(Date.now());
  // Keep last 5
  if (buf.scores.length > 5) {
    buf.scores.shift();
    buf.timestamps.shift();
  }
  setFlag(`warmth_sent:${key}`, JSON.stringify(buf));

  // Track consecutive long messages for "opening up" detection
  if (content.length > 200) {
    const count = Number(getFlag(`warmth_long:${key}`) || 0) + 1;
    setFlag(`warmth_long:${key}`, String(count));
  } else {
    deleteFlag(`warmth_long:${key}`);
  }
}

// ===== Context lines =====

function getWarmthLine(userId, guildId, roleNature) {
  const key = `${userId}:${guildId}`;
  const raw = getFlag(`warmth_sent:${key}`);
  if (!raw) return '';
  const buf = JSON.parse(raw);
  if (!buf.scores || buf.scores.length < 2) return '';
  const avgSentiment = buf.scores.reduce((a, b) => a + b, 0) / buf.scores.length;
  const rel = getRelationship(userId, guildId);
  const familiarity = rel ? rel.familiarity : 0;

  // Consecutive long messages — user is opening up
  const longMsgCount = Number(getFlag(`warmth_long:${key}`) || 0);
  if (longMsgCount >= 3 && roleNature === 'casual') {
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
  const key = 'warmth_repeat:' + userId + ':' + guildId;
  const raw = getFlag(key);
  const buf = raw ? JSON.parse(raw) : { topics: [], windowStart: Date.now() };
  const normalized = content.toLowerCase().trim();
  const similar = buf.topics.filter(t => {
    const longer = normalized.length > t.length ? normalized : t;
    const shorter = normalized.length > t.length ? t : normalized;
    return longer.includes(shorter);
  });
  buf.topics.push(normalized);
  if (buf.topics.length > 10) buf.topics.shift();
  setFlag(key, JSON.stringify(buf), 30 * 60 * 1000);
  if (similar.length >= 2) {
    return "They're not getting it. Be clearer this time - drop the wit, give the answer straight.";
  }
  return '';
}

// ===== Active listening =====

async function maybeActiveListen(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Respect opt-in
  const { canInteract } = require('../proactive/absenceDetector');
  if (!canInteract(message.author.id, message.guild.id)) return;

  // Only fire in non-AI channels (cached set, O(1) lookup)
  if (aiChannelSet && aiChannelSet.has(message.channel.id)) return;

  // Only for users with established relationship
  const rel = getRelationship(message.author.id, message.guild.id);
  if (!rel || rel.familiarity <= 15) return;

  const channelId = message.channel.id;

  if (checkActiveListenCooldown(channelId)) return;

  // Only on long messages
  if (message.content.length <= 200) return;

  // Low chance
  if (Math.random() > 0.05) return;

  const cues = ['mhm', 'yeah?', 'go on', "i'm listening", 'wait really?', 'say more'];
  const cue = cues[Math.floor(Math.random() * cues.length)];

  try {
    // Brief delay so it feels like Skarn is reading
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    await message.channel.send({ content: cue, allowedMentions: { parse: ['users'] } });
    setActiveListenCooldown(channelId);
  } catch {
    // Permission issue — silently ignore
  }
}

// ===== Cleanup (prevents unbounded memory growth) =====

function cleanWarmth() {
  const now = Date.now();
  if (now - aiCacheLoadedAt > CACHE_TTL) {
    refreshAiChannels();
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
