// ===== RAG PER-USER SCOPING =====
// Guards quick win #4 (2026-08-08): 'Related past conversations' must never pull
// another user's messages on a public server (query + cache both scoped per user).
const { db, getRecentMessageEmbeddings } = require('../../db/database');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

// Seed threads/messages/embeddings for two users in one guild
var now = Date.now();
function seedThread(id, userId) {
  db.prepare(
    'INSERT INTO conversation_threads (thread_id, user_id, guild_id, channel_id, thread_type, started_at, last_active_at) VALUES (?,?,?,?,?,?,?)'
  ).run(id, userId, 'g1', 'c1', 'channel', now, now);
}
function seedUserMessage(threadId, userId, content) {
  const res = db.prepare(
    'INSERT INTO conversation_messages (thread_id, user_id, guild_id, channel_id, role, content, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(threadId, userId, 'g1', 'c1', 'user', content, now);
  db.prepare(
    'INSERT INTO conversation_embeddings (message_id, embedding, created_at) VALUES (?,?,?)'
  ).run(res.lastInsertRowid, Buffer.from('x'), now);
}

seedThread('tA', 'uA');
seedThread('tB', 'uB');
seedUserMessage('tA', 'uA', 'uA secret message about the vault key');
seedUserMessage('tB', 'uB', 'uB private message about a plan');

var a = getRecentMessageEmbeddings('uA', 'g1', 10);
var b = getRecentMessageEmbeddings('uB', 'g1', 10);
assert('uA sees only own messages', a.length > 0 && a.every(function(m) { return m.user_id === 'uA'; }));
assert('uB sees only own messages', b.length > 0 && b.every(function(m) { return m.user_id === 'uB'; }));
assert('uA never receives uB content', !a.some(function(m) { return m.content.indexOf('uB private') !== -1; }));
assert('uB never receives uA content', !b.some(function(m) { return m.content.indexOf('uA secret') !== -1; }));
