// ===== RAG PER-USER SCOPING =====
// Guards quick win #4 (2026-08-08): 'Related past conversations' must never pull
// another user's messages on a public server. Assertions cover BOTH scoping
// layers: the embedding query (getRecentMessageEmbeddings) AND the cache read
// (app_state key read inside buildContext, which feeds ragLine into the prompt).
const { db, getRecentMessageEmbeddings } = require('../../db/database');
const { buildContext } = require('../../features/promptContext');

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

// ===== CACHE READ (ragLine) — the path that injects 'Related past conversations' =====
// Seed app_state with the NEW user-scoped key form directly, then drive the read
// through buildContext (promptContext.js:148-188). The async embedText call needs
// no API key here: with <5 seeded embeddings it is skipped, and any rejection is
// swallowed by .catch(function(){}) — the synchronous cache read runs regardless.
var now2 = Date.now();
db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)').run('rag_uA:c1', JSON.stringify(['uA secret cached text']), now2);
db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)').run('rag_uB:c1', JSON.stringify(['uB private cached text']), now2);
// Legacy unscoped key ('rag_' + channelId) holding the same content as the scoped
// uB entry: models the pre-fix cache form so the read-key revert scenario leaks
// real data instead of passing vacuously with an empty ragLine. Fixed code never
// reads this key.
db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)').run('rag_c1', JSON.stringify(['uB private cached text']), now2);

var ctx = buildContext('uA', 'g1', 'c1', { roleNature: 'casual', userContent: 'a sufficiently long user message that reaches the rag block', interactionCount: 1 });
assert('uA cache read is user-scoped (own text present)', ctx.ragLine && ctx.ragLine.indexOf('uA secret cached') !== -1);
assert('uA cache read excludes uB text', !ctx.ragLine || ctx.ragLine.indexOf('uB private cached') === -1);
