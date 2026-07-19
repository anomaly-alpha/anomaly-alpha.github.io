const Sentiment = require('sentiment');
const sentiment = new Sentiment();

function analyzeSentiment(text) {
  const result = sentiment.analyze(text);
  return Math.max(-1, Math.min(1, result.comparative));
}

module.exports = { analyzeSentiment };
