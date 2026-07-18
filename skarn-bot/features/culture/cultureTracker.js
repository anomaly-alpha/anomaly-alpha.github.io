const { addNGram, getTopNGrams } = require('../../db/database');

const buffer = new Map(); // `guildId:channelId` -> Map<ngram, count>
const STOP_WORDS = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','have','been','some','them','than','what','when','where','which','who','how','its']);

function extractBigrams(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + ' ' + words[i + 1]);
  }
  return bigrams;
}

function updateCulture(guildId, channelId, content) {
  const bigrams = extractBigrams(content);
  if (bigrams.length === 0) return;

  const key = guildId + ':' + channelId;
  if (!buffer.has(key)) buffer.set(key, new Map());
  const channelGrams = buffer.get(key);

  for (const bg of bigrams) {
    channelGrams.set(bg, (channelGrams.get(bg) || 0) + 1);
  }

  if (channelGrams.size > 100) {
    const sorted = [...channelGrams.entries()].sort((a, b) => b[1] - a[1]);
    buffer.set(key, new Map(sorted.slice(0, 50)));
  }
}

function getCultureLine(guildId, channelId) {
  const top = getTopNGrams(guildId, channelId, 3);
  if (top.length === 0) return '';
  const phrases = top.map(t => t.ngram).join('", "');
  return 'The culture here: "' + phrases + '". Reference naturally if relevant.';
}

function flushCulture() {
  for (const [key, grams] of buffer) {
    const parts = key.split(':');
    const guildId = parts[0];
    const channelId = parts[1];
    for (const [ngram] of grams) {
      addNGram(guildId, channelId, ngram);
    }
  }
}

module.exports = { updateCulture, getCultureLine, flushCulture };
