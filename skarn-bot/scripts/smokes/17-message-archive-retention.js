if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const guildId = '1460698506489630844';
process.env.SKARN_MESSAGE_RETENTION_GUILD_ID = guildId;

const { db } = require('../../db/database');
const archive = require('../../db/messageActivityArchive');
const now = Date.now();
const cutoff = now - archive.RETENTION_MS;

function message(overrides = {}) {
  return {
    id: 'message-1',
    guild: { id: guildId },
    channel: { id: 'channel-1' },
    author: { id: 'user-1', bot: false },
    content: 'first body',
    createdTimestamp: now,
    ...overrides,
  };
}

assert.strictEqual(archive.recordMessage(message()), true);
assert.strictEqual(archive.recordMessage(message({ id: 'other-guild', guild: { id: 'another-guild' } })), false);
assert.strictEqual(archive.recordMessage(message({ id: 'bot-message', author: { id: 'bot', bot: true } })), false);
assert.strictEqual(archive.recordMessage(message({ id: 'expired-message', createdTimestamp: now - archive.RETENTION_MS - 1 })), false);

const created = db.prepare('SELECT event_type, content_before, content_after, event_at FROM message_activity_archive WHERE message_id = ?').get('message-1');
assert.deepStrictEqual(created, { event_type: 'created', content_before: null, content_after: 'first body', event_at: now });

assert.strictEqual(archive.recordEdit(message(), message({ content: 'edited body' })), 1);
const edit = db.prepare('SELECT event_type, content_before, content_after FROM message_activity_archive WHERE message_id = ? AND event_type = ?').get('message-1', 'edited');
assert.deepStrictEqual(edit, { event_type: 'edited', content_before: 'first body', content_after: 'edited body' });

db.prepare('INSERT INTO message_activity_archive (message_id, guild_id, channel_id, user_id, event_type, content_before, content_after, event_at, source_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run('old-message', guildId, 'channel-1', 'user-1', 'created', null, 'expired body', cutoff - 1, cutoff - 1);
assert.strictEqual(archive.pruneExpiredMessages(now), 1);
assert.strictEqual(db.prepare('SELECT count(*) AS n FROM message_activity_archive WHERE message_id = ?').get('old-message').n, 0);
assert.strictEqual(db.prepare('SELECT count(*) AS n FROM message_activity_archive WHERE message_id = ?').get('message-1').n, 2);

assert.strictEqual(archive.recordDeletion(message({ content: 'edited body' })), 1);
const events = db.prepare('SELECT event_type, content_before, content_after FROM message_activity_archive WHERE message_id = ? ORDER BY event_id').all('message-1');
assert.deepStrictEqual(events, [
  { event_type: 'created', content_before: null, content_after: 'first body' },
  { event_type: 'edited', content_before: 'first body', content_after: 'edited body' },
  { event_type: 'deleted', content_before: 'edited body', content_after: null },
]);
db.close();
console.log('Message archive retention smoke passed');
