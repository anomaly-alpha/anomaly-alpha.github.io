const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const channelBuffers = new Map(); // channelId → Entry[]

const BANTER_WORDS = ['lmao', 'lmfao', 'lol', 'rofl', 'haha', 'hehe', 'lolz', 'lul'];

function isBanterTone(content) {
  const lower = content.toLowerCase();
  return BANTER_WORDS.some(w => lower.includes(w));
}

function updateCallbacks(channelId, authorId, content) {
  if (!channelBuffers.has(channelId)) {
    channelBuffers.set(channelId, []);
  }
  const buf = channelBuffers.get(channelId);

  // Check each sampling criterion independently
  const result = sentiment.analyze(content);
  const isFunny = result.comparative > 0.5;
  const isShort = content.length < 50;
  const isSetup = content.endsWith('?') && isBanterTone(content);

  const sample = (isFunny && Math.random() < 0.10) ||
    (isShort && Math.random() < 0.30) ||
    (isSetup && Math.random() < 0.30);

  if (!sample) return;

  // Remove oldest if at capacity
  if (buf.length >= 10) buf.shift();

  buf.push({
    text: content.length > 60 ? content.slice(0, 60) + '...' : content,
    author: authorId,
    timestamp: Date.now(),
  });
}

function getCallbackLine(channelId, userId) {
  const buf = channelBuffers.get(channelId);
  if (!buf || buf.length === 0) return '';

  const userEntries = buf.filter(e => e.author === userId);
  if (userEntries.length < 2) return '';

  const refs = userEntries.slice(-2).map(e => `"${e.text}"`).join(' and ');
  return `You remember this person saying: ${refs}. If it's natural, reference it. Don't force it.`;
}

function cleanCallbacks() {
  const now = Date.now();
  for (const [channelId, buf] of channelBuffers) {
    const fresh = buf.filter(e => now - e.timestamp < 2 * 60 * 60 * 1000);
    if (fresh.length > 10) fresh.splice(0, fresh.length - 10);
    if (fresh.length === 0) {
      channelBuffers.delete(channelId);
    } else {
      channelBuffers.set(channelId, fresh);
    }
  }
}

module.exports = { updateCallbacks, getCallbackLine, cleanCallbacks };
