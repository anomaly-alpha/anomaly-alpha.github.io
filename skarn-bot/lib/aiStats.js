const fs = require('fs');
const path = require('path');

const HOURLY_CAP = 50;
const STATS_FILE = path.join(__dirname, '..', 'data', 'ai-stats.json');

const aiHourlyCap = new Map(); // "userId" -> { count, hourStart } (in-memory only)

let stats = { messageCount: {}, responseCount: {} };

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch {}
}

function saveStats() {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

// Load on startup
loadStats();

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function recordMessage(userId) {
  stats.messageCount[userId] = (stats.messageCount[userId] || 0) + 1;
  saveStats();
}

function recordResponse(userId) {
  stats.responseCount[userId] = (stats.responseCount[userId] || 0) + 1;
  saveStats();
}

function canRespond(userId) {
  const hour = currentHour();
  const entry = aiHourlyCap.get(userId);

  if (entry && entry.hourStart === hour) {
    if (entry.count >= HOURLY_CAP) return false;
    entry.count++;
  } else {
    aiHourlyCap.set(userId, { count: 1, hourStart: hour });
  }
  return true;
}

function getStats(userId) {
  const hour = currentHour();
  const entry = aiHourlyCap.get(userId);
  const used = (entry && entry.hourStart === hour) ? entry.count : 0;
  const remaining = Math.max(0, HOURLY_CAP - used);
  const resetsAt = new Date((hour + 1) * 3600000);

  return {
    remaining,
    used,
    cap: HOURLY_CAP,
    resetsAt,
    messagesSent: stats.messageCount[userId] || 0,
    responsesReceived: stats.responseCount[userId] || 0,
  };
}

function resetStats(userId) {
  aiHourlyCap.delete(userId);
  delete stats.messageCount[userId];
  delete stats.responseCount[userId];
  saveStats();
}

module.exports = { recordMessage, recordResponse, canRespond, getStats, resetStats };
