const { addNGram, getTopNGrams } = require('../../db/database');

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

  for (const bg of bigrams) {
    addNGram(guildId, channelId, bg);
  }
}

function getCultureLine(guildId, channelId) {
  const top = getTopNGrams(guildId, channelId, 3);
  if (top.length === 0) return '';
  const phrases = top.map(t => t.ngram).join('", "');
  return 'The culture here: "' + phrases + '". Reference naturally if relevant.';
}

module.exports = { updateCulture, getCultureLine };
