// Ephemeral in-memory rolling buffer for sentiment analysis.
// NOT persisted to SQLite. Lost on restart (intentional).

const buffer = new Map(); // channelId -> string[] (max 5)
const BUFFER_SIZE = 5;

function pushMessage(channelId, content) {
  const msgs = buffer.get(channelId) || [];
  msgs.push(content);
  if (msgs.length > BUFFER_SIZE) msgs.shift();
  buffer.set(channelId, msgs);
}

function getMessages(channelId) {
  return buffer.get(channelId) || [];
}

module.exports = { pushMessage, getMessages };
