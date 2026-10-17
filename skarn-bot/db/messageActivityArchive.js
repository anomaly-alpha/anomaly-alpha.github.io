const { db } = require('./db');

const TARGET_GUILD_ID = process.env.SKARN_MESSAGE_RETENTION_GUILD_ID || '';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function isTargetGuild(guildId) {
  return Boolean(TARGET_GUILD_ID) && guildId === TARGET_GUILD_ID;
}

function isHumanMessage(message) {
  return Boolean(message && message.guild && message.author && !message.author.bot && isTargetGuild(message.guild.id));
}

function appendEvent(message, eventType, contentBefore, contentAfter, eventAt) {
  if (!isHumanMessage(message) || !message.id || !message.channel?.id || !message.author.id) return 0;

  const sourceCreatedAt = Number.isFinite(message.createdTimestamp) ? message.createdTimestamp : eventAt;
  if (eventAt < Date.now() - RETENTION_MS) return 0;

  return db.prepare('INSERT INTO message_activity_archive (message_id, guild_id, channel_id, user_id, event_type, content_before, content_after, event_at, source_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    message.id,
    message.guild.id,
    message.channel.id,
    message.author.id,
    eventType,
    contentBefore,
    contentAfter,
    eventAt,
    sourceCreatedAt,
  ).changes;
}

function recordMessage(message) {
  if (!message || !message.guild || message.author?.bot || !isTargetGuild(message.guild.id)) return false;
  if (typeof message.content !== 'string') return false;

  const createdAt = Number.isFinite(message.createdTimestamp) ? message.createdTimestamp : Date.now();
  if (createdAt < Date.now() - RETENTION_MS) return false;
  return appendEvent(message, 'created', null, message.content, createdAt) === 1;
}

function recordEdit(oldMessage, newMessage) {
  if (typeof oldMessage?.content !== 'string' || typeof newMessage?.content !== 'string') return 0;
  return appendEvent(newMessage, 'edited', oldMessage.content, newMessage.content, Date.now());
}

function recordDeletion(message) {
  const content = typeof message?.content === 'string' ? message.content : null;
  return appendEvent(message, 'deleted', content, null, Date.now());
}

function pruneExpiredMessages(now = Date.now()) {
  if (!TARGET_GUILD_ID) return 0;
  const cutoff = now - RETENTION_MS;
  return db.prepare('DELETE FROM message_activity_archive WHERE guild_id = ? AND event_at < ?')
    .run(TARGET_GUILD_ID, cutoff).changes;
}

module.exports = { RETENTION_MS, recordMessage, recordEdit, recordDeletion, pruneExpiredMessages };
