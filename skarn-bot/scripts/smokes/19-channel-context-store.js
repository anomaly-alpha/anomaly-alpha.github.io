// ===== CHANNEL CONTEXT STORAGE =====
if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { MIGRATIONS, runMigrations } = require('../../db/migrations');

const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'skarn-schema.sql'), 'utf8');

function hasTable(connection, tableName) {
  return Boolean(connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function hasIndex(connection, indexName) {
  return Boolean(connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName));
}

function checkV5Schema(connection) {
  assert.ok(hasTable(connection, 'channel_context_messages'), 'shared raw context table exists');
  assert.ok(hasTable(connection, 'channel_context_summary_segments'), 'shared summary table exists');
  assert.ok(hasIndex(connection, 'idx_channel_context_messages_window'), 'raw window index exists');
  assert.ok(hasIndex(connection, 'idx_channel_context_messages_author'), 'raw author index exists');
  assert.ok(hasIndex(connection, 'idx_channel_context_summary_segments_window'), 'summary window index exists');
  const rawColumns = connection.prepare('PRAGMA table_info(channel_context_messages)').all().map(row => row.name);
  assert.deepStrictEqual(rawColumns, [
    'message_id', 'guild_id', 'channel_id', 'author_id', 'author_name', 'content',
    'created_at', 'captured_at', 'reference_message_id', 'related_user_id', 'is_skarn',
  ], 'raw context columns match the v5 schema');
  const summaryColumns = connection.prepare('PRAGMA table_info(channel_context_summary_segments)').all().map(row => row.name);
  assert.deepStrictEqual(summaryColumns, [
    'segment_id', 'guild_id', 'channel_id', 'summary_text', 'covers_from', 'covers_to',
    'created_at', 'updated_at', 'source_author_ids', 'source_message_ids',
  ], 'summary provenance columns match the v5 schema');
}

const fresh = new Database(':memory:');
fresh.exec(schema);
checkV5Schema(fresh);
runMigrations(fresh);
assert.strictEqual(fresh.pragma('user_version', { simple: true }), 7, 'fresh schema reaches migration v7');
runMigrations(fresh);
assert.strictEqual(fresh.pragma('user_version', { simple: true }), 7, 'fresh migration rerun is idempotent');
fresh.close();

const v4 = new Database(':memory:');
v4.exec("CREATE TABLE message_activity_archive (event_id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, event_type TEXT NOT NULL, content_before TEXT, content_after TEXT, event_at INTEGER NOT NULL, source_created_at INTEGER NOT NULL)");
v4.prepare('INSERT INTO message_activity_archive (message_id, guild_id, channel_id, user_id, event_type, event_at, source_created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('archive-only', 'guild-a', 'channel-a', 'author-a', 'created', Date.now(), Date.now());
v4.pragma('user_version = 4');
assert.strictEqual(MIGRATIONS.find(migration => migration.version === 5).name, 'add_channel_context_storage');
runMigrations(v4);
checkV5Schema(v4);
assert.strictEqual(v4.pragma('user_version', { simple: true }), 7, 'v4-shaped database migrates through v7');
assert.strictEqual(v4.prepare('SELECT COUNT(*) AS count FROM channel_context_messages').get().count, 0, 'v5 migration does not copy the separate message archive');
runMigrations(v4);
v4.close();

const {
  db,
  CHANNEL_CONTEXT_RETENTION_MS,
  insertChannelContextMessage,
  editChannelContextMessage,
  deleteChannelContextMessage,
  deleteChannelContextMessagesByAuthor,
  getChannelContextMessages,
  pruneChannelContextMessages,
  persistChannelContextSummarySegment,
  listChannelContextSummarySegments,
  deleteChannelContextSummarySegmentsByAuthor,
} = require('../../db/database');

assert.strictEqual(db.pragma('user_version', { simple: true }), 7, 'facade connection is at v7');
const base = Date.now();

function message(messageId, guildId, channelId, authorId, createdAt, content) {
  return { messageId, guildId, channelId, authorId, authorName: authorId + ' name', content, createdAt, capturedAt: base };
}

assert.strictEqual(insertChannelContextMessage(message('message-1', 'guild-a', 'channel-a', 'author-a', base - 2000, 'first')), 1);
assert.strictEqual(insertChannelContextMessage(message('message-2', 'guild-a', 'channel-a', 'author-b', base - 1000, 'second')), 1);
assert.strictEqual(insertChannelContextMessage(message('message-3', 'guild-a', 'channel-b', 'author-a', base - 500, 'other channel')), 1);
assert.strictEqual(insertChannelContextMessage(message('message-4', 'guild-b', 'channel-a', 'author-a', base - 250, 'other guild')), 1);
assert.strictEqual(insertChannelContextMessage(message('message-1', 'guild-a', 'channel-a', 'author-a', base - 2000, 'duplicate')), 0, 'duplicate message ID is idempotent');
assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM channel_context_messages WHERE message_id = ?').get('message-1').count, 1);
assert.strictEqual(db.prepare('SELECT content FROM channel_context_messages WHERE message_id = ?').get('message-1').content, 'first');

let channelRows = getChannelContextMessages('guild-a', 'channel-a', { now: base });
assert.deepStrictEqual(channelRows.map(row => row.message_id), ['message-1', 'message-2'], 'window read is chronological and channel scoped');
assert.ok(channelRows.every(row => row.guild_id === 'guild-a' && row.channel_id === 'channel-a'), 'window read does not cross guild/channel scope');
assert.strictEqual(editChannelContextMessage({ messageId: 'message-1', guildId: 'guild-a', channelId: 'channel-a', content: 'edited' }), 1);
assert.strictEqual(getChannelContextMessages('guild-a', 'channel-a', { now: base })[0].content, 'edited', 'edit updates the scoped raw row');
assert.strictEqual(editChannelContextMessage({ messageId: 'message-1', guildId: 'guild-b', channelId: 'channel-a', content: 'wrong scope' }), 0, 'edit cannot cross guild scope');

insertChannelContextMessage(message('expired-message', 'guild-a', 'channel-a', 'author-a', base - CHANNEL_CONTEXT_RETENTION_MS - 1, 'expired'));
assert.strictEqual(pruneChannelContextMessages(base), 1, 'prune removes rows at the seven-day boundary');
assert.strictEqual(db.prepare('SELECT 1 FROM channel_context_messages WHERE message_id = ?').get('expired-message'), undefined);
assert.deepStrictEqual(getChannelContextMessages('guild-a', 'channel-a', { now: base }).map(row => row.message_id), ['message-1', 'message-2']);

persistChannelContextSummarySegment({
  segmentId: 'segment-ordered-late', guildId: 'guild-a', channelId: 'channel-a', summaryText: 'later',
  coversFrom: base - 500, coversTo: base, createdAt: base, updatedAt: base,
  sourceAuthorIds: ['author-b'], sourceMessageIds: ['message-2'],
});
persistChannelContextSummarySegment({
  segmentId: 'segment-ordered-early', guildId: 'guild-a', channelId: 'channel-a', summaryText: 'earlier',
  coversFrom: base - 2000, coversTo: base - 501, createdAt: base, updatedAt: base,
  sourceAuthorIds: ['author-a'], sourceMessageIds: ['message-1'],
});
assert.deepStrictEqual(listChannelContextSummarySegments('guild-a', 'channel-a').map(row => row.segment_id), ['segment-ordered-early', 'segment-ordered-late'], 'summary list is scoped and ordered');
assert.deepStrictEqual(JSON.parse(listChannelContextSummarySegments('guild-a', 'channel-a')[0].source_author_ids), ['author-a']);
persistChannelContextSummarySegment({
  segmentId: 'segment-ordered-late', guildId: 'guild-a', channelId: 'channel-a', summaryText: 'updated',
  coversFrom: base - 500, coversTo: base, createdAt: base + 1, updatedAt: base + 1,
  sourceAuthorIds: ['author-b'], sourceMessageIds: ['message-2'],
});
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-a').length, 2, 'summary persistence is idempotent by segment ID');
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-a')[1].summary_text, 'updated');

persistChannelContextSummarySegment({
  segmentId: 'segment-other-channel', guildId: 'guild-a', channelId: 'channel-b', summaryText: 'other channel',
  coversFrom: base, coversTo: base, sourceAuthorIds: ['author-a'], sourceMessageIds: ['message-3'],
});
persistChannelContextSummarySegment({
  segmentId: 'segment-other-guild', guildId: 'guild-b', channelId: 'channel-a', summaryText: 'other guild',
  coversFrom: base, coversTo: base, sourceAuthorIds: ['author-a'], sourceMessageIds: ['message-4'],
});
assert.strictEqual(deleteChannelContextSummarySegmentsByAuthor('author-a', 'guild-a'), 1, 'provenance deletion removes matching segments across that guild');
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-a').length, 1, 'author deletion removes only attributed segments');
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-b').length, 0, 'author deletion removes attributed segments in other guild channels');
assert.strictEqual(listChannelContextSummarySegments('guild-b', 'channel-a').length, 1, 'author deletion does not cross guild scope');
assert.strictEqual(deleteChannelContextSummarySegmentsByAuthor('author-a', 'guild-a'), 0, 'provenance deletion is idempotent');

persistChannelContextSummarySegment({
  segmentId: 'segment-for-message-delete', guildId: 'guild-a', channelId: 'channel-a', summaryText: 'must not retain deleted source',
  coversFrom: base, coversTo: base, sourceAuthorIds: ['author-b'], sourceMessageIds: ['message-2'],
});
assert.strictEqual(deleteChannelContextMessage('message-2', 'guild-a', 'channel-a'), 1, 'delete removes the scoped raw row');
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-a').some(row => row.segment_id === 'segment-for-message-delete'), false, 'delete removes summaries containing deleted source provenance');
assert.strictEqual(deleteChannelContextMessage('message-2', 'guild-a', 'channel-a'), 0, 'raw deletion is idempotent');

const dbApi = require('../../db/database');
const { forgetUserData } = require('../../features/forget/forget.handler');
const memoryUser = 'forget-memory-user';
dbApi.addMemoryEntry(memoryUser, 'guild-a', 'etch', 'fact', 'likes tea', 1, null);
const memoryThread = dbApi.createThread(memoryUser, 'guild-a', 'channel-a', 'channel');
dbApi.insertMessage(memoryThread.thread_id, memoryUser, 'guild-a', 'channel-a', 'user', 'private conversation');
insertChannelContextMessage(message('forget-memory-raw', 'guild-a', 'channel-a', memoryUser, base, 'context body'));
persistChannelContextSummarySegment({ segmentId: 'forget-memory-summary', guildId: 'guild-a', channelId: 'channel-a', summaryText: 'memory detail', coversFrom: base, coversTo: base, sourceAuthorIds: [memoryUser], sourceMessageIds: ['forget-memory-raw'] });
forgetUserData(memoryUser, 'guild-a', 'memory');
assert.strictEqual(dbApi.getMemoryEntries(memoryUser, 'guild-a', 10).length, 0, 'memory forget removes personal memory');
assert.strictEqual(dbApi.getThreadMessages(memoryThread.thread_id).length, 1, 'memory forget preserves private conversation history');
assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM channel_context_messages WHERE guild_id = ? AND (author_id = ? OR related_user_id = ?)').get('guild-a', memoryUser, memoryUser).count, 0, 'memory forget removes raw shared context attributed to the user');
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-a').some(row => row.segment_id === 'forget-memory-summary'), false, 'memory forget removes summary provenance');

const allUser = 'forget-all-user';
dbApi.addMemoryEntry(allUser, 'guild-a', 'extracted', 'interest', 'likes astronomy', 0.8, null);
const allThread = dbApi.createThread(allUser, 'guild-a', 'channel-a', 'channel');
dbApi.insertMessage(allThread.thread_id, allUser, 'guild-a', 'channel-a', 'user', 'private conversation');
insertChannelContextMessage(message('forget-all-raw', 'guild-a', 'channel-a', allUser, base + 1, 'context body'));
persistChannelContextSummarySegment({ segmentId: 'forget-all-summary', guildId: 'guild-a', channelId: 'channel-a', summaryText: 'all detail', coversFrom: base, coversTo: base, sourceAuthorIds: [allUser], sourceMessageIds: ['forget-all-raw'] });
forgetUserData(allUser, 'guild-a', 'all');
assert.strictEqual(dbApi.getMemoryEntries(allUser, 'guild-a', 10).length, 0, 'all forget removes personal memory');
assert.strictEqual(dbApi.getThreadMessages(allThread.thread_id).length, 0, 'all forget removes private conversation history');
assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM channel_context_messages WHERE guild_id = ? AND (author_id = ? OR related_user_id = ?)').get('guild-a', allUser, allUser).count, 0, 'all forget removes raw shared context');
assert.strictEqual(listChannelContextSummarySegments('guild-a', 'channel-a').some(row => row.segment_id === 'forget-all-summary'), false, 'all forget removes attributed summaries');

db.close();
console.log('Channel context storage smoke passed');
