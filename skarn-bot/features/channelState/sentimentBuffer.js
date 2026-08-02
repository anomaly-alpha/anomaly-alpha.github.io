const Sentiment = require('sentiment');
const { pushSentimentBuffer, getSentimentBuffer } = require('../../db/database');

const sentiment = new Sentiment();
const BUFFER_LIMIT = 5;
// channelId -> [comparative scores] (same length as the persisted buffer, bounded)
const scoreQueues = new Map();

function pushMessage(channelId, content) {
  pushSentimentBuffer(channelId, content, BUFFER_LIMIT);
  const queue = scoreQueues.get(channelId) || [];
  queue.push(sentiment.analyze(content).comparative);
  if (queue.length > BUFFER_LIMIT) queue.shift();
  scoreQueues.set(channelId, queue);
}

function getMessages(channelId) {
  return getSentimentBuffer(channelId);
}

function getSentimentAverage(channelId) {
  const queue = scoreQueues.get(channelId);
  if (queue && queue.length > 0) {
    return queue.reduce((a, b) => a + b, 0) / queue.length;
  }
  // Cold path: rebuild from buffer (e.g., after restart)
  const msgs = getSentimentBuffer(channelId);
  if (msgs.length === 0) return 0;
  const scores = msgs.map(m => sentiment.analyze(m).comparative);
  scoreQueues.set(channelId, scores);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

module.exports = { pushMessage, getMessages, getSentimentAverage };
