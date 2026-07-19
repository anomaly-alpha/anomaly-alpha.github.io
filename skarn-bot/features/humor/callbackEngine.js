const { addCallback, getCallbacks, pruneCallbacks } = require('../../db/database');

const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const BANTER_WORDS = ['lmao', 'lmfao', 'lol', 'rofl', 'haha', 'hehe', 'lolz', 'lul'];

function isBanterTone(content) {
  const lower = content.toLowerCase();
  return BANTER_WORDS.some(w => lower.includes(w));
}

function updateCallbacks(channelId, userId, content) {
  if (content.length > 50 && Math.random() < 0.1) {
    addCallback(channelId, userId, content.slice(0, 200));
  }
}

function getCallbackLine(channelId, userId) {
  const recent = getCallbacks(channelId, 3);
  if (recent.length === 0) return '';
  const cb = recent.map(c => '"' + (c.message.length > 40 ? c.message.slice(0, 40) + '...' : c.message) + '"').join(', ');
  return 'Things said nearby: ' + cb + '. Reference naturally if it fits.';
}

function cleanCallbacks() {
  pruneCallbacks(3600000);
}

module.exports = { updateCallbacks, getCallbackLine, cleanCallbacks };
