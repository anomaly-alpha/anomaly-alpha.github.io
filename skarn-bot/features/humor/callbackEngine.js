const channelBuffers = new Map(); // channelId → Entry[]

function updateCallbacks(channelId, authorId, content) {
  if (!channelBuffers.has(channelId)) {
    channelBuffers.set(channelId, []);
  }
  const buf = channelBuffers.get(channelId);

  // Only sample notable messages
  const lower = content.toLowerCase();
  const isNotable = content.length < 80 ||
    lower.includes('lmao') || lower.includes('lmfao') ||
    lower.includes('lol') || lower.endsWith('?') ||
    lower.includes('💀') || lower.includes('😂');

  if (!isNotable) return;
  if (Math.random() > 0.3) return; // 30% sample on notable

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
