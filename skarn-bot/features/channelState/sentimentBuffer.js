const { pushSentimentBuffer, getSentimentBuffer } = require('../../db/database');

function pushMessage(channelId, content) {
  pushSentimentBuffer(channelId, content, 5);
}

function getMessages(channelId) {
  return getSentimentBuffer(channelId);
}

module.exports = { pushMessage, getMessages };
