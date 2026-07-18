const HOURLY_CAP = 50;

const aiHourlyCap = new Map();   // "userId" -> { count, hourStart }
const messageCount = new Map();  // "userId" -> total messages sent to bot
const responseCount = new Map(); // "userId" -> total responses received

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function recordMessage(userId) {
  messageCount.set(userId, (messageCount.get(userId) || 0) + 1);
}

function recordResponse(userId) {
  responseCount.set(userId, (responseCount.get(userId) || 0) + 1);
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
    messagesSent: messageCount.get(userId) || 0,
    responsesReceived: responseCount.get(userId) || 0,
  };
}

function resetStats(userId) {
  aiHourlyCap.delete(userId);
  messageCount.delete(userId);
  responseCount.delete(userId);
}

module.exports = { recordMessage, recordResponse, canRespond, getStats, resetStats };
