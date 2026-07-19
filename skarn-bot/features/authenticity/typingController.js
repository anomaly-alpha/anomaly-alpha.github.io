const SHORT_RESPONSE_WORDS = 10;
const CHARS_PER_SECOND_BASE = 15;
const CHARS_PER_SECOND_SLOW = 8;
const MAX_DELAY = 4000;

function estimateDelay(responseText) {
  const length = responseText.length;
  if (length < 20) return 200 + Math.random() * 300;
  if (length < 100) return 500 + Math.random() * 800;
  const charsPerSecond = CHARS_PER_SECOND_BASE;
  const base = (length / charsPerSecond) * 1000;
  const jitter = (Math.random() - 0.5) * 1000;
  return Math.min(MAX_DELAY, Math.max(500, base + jitter));
}

module.exports = { estimateDelay };
