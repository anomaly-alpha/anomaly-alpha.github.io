// ===== db: shared channel context =====
const crypto = require('crypto');
const { db } = require('./db');

const CHANNEL_CONTEXT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function requireId(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(name + ' must be a non-empty string');
  }
  return value;
}

function requireTimestamp(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(name + ' must be a finite number');
  return Math.trunc(value);
}

function normalizeMessageArgs(messageOrId, guildId, channelId, authorId, authorName, content, createdAt, capturedAt, referenceMessageId, relatedUserId, isSkarn) {
  if (messageOrId && typeof messageOrId === 'object') {
    return {
      messageId: messageOrId.messageId ?? messageOrId.message_id,
      guildId: messageOrId.guildId ?? messageOrId.guild_id,
      channelId: messageOrId.channelId ?? messageOrId.channel_id,
      authorId: messageOrId.authorId ?? messageOrId.author_id,
      authorName: messageOrId.authorName ?? messageOrId.author_name,
      content: messageOrId.content,
      createdAt: messageOrId.createdAt ?? messageOrId.created_at,
      capturedAt: messageOrId.capturedAt ?? messageOrId.captured_at,
      referenceMessageId: messageOrId.referenceMessageId ?? messageOrId.reference_message_id,
      relatedUserId: messageOrId.relatedUserId ?? messageOrId.related_user_id ?? null,
      isSkarn: messageOrId.isSkarn ?? messageOrId.is_skarn ?? false,
    };
  }
  return { messageId: messageOrId, guildId, channelId, authorId, authorName, content, createdAt, capturedAt, referenceMessageId, relatedUserId, isSkarn: isSkarn || false };
}

function normalizeMessage(messageOrId, guildId, channelId, authorId, authorName, content, createdAt, capturedAt, referenceMessageId, relatedUserId, isSkarn) {
  const message = normalizeMessageArgs(messageOrId, guildId, channelId, authorId, authorName, content, createdAt, capturedAt, referenceMessageId, relatedUserId, isSkarn);
  message.messageId = requireId(message.messageId, 'messageId');
  message.guildId = requireId(message.guildId, 'guildId');
  message.channelId = requireId(message.channelId, 'channelId');
  message.authorId = requireId(message.authorId, 'authorId');
  message.authorName = typeof message.authorName === 'string' && message.authorName.length > 0 ? message.authorName : message.authorId;
  if (typeof message.content !== 'string') throw new TypeError('content must be a string');
  message.createdAt = requireTimestamp(message.createdAt, 'createdAt');
  message.capturedAt = message.capturedAt === undefined || message.capturedAt === null
    ? Date.now()
    : requireTimestamp(message.capturedAt, 'capturedAt');
  message.referenceMessageId = message.referenceMessageId === undefined || message.referenceMessageId === null
    ? null
    : requireId(message.referenceMessageId, 'referenceMessageId');
  message.relatedUserId = message.relatedUserId === undefined || message.relatedUserId === null
    ? null
    : requireId(message.relatedUserId, 'relatedUserId');
  message.isSkarn = message.isSkarn === true || message.isSkarn === 1 ? 1 : 0;
  return message;
}

function insertChannelContextMessage(messageOrId, guildId, channelId, authorId, authorName, content, createdAt, capturedAt, referenceMessageId, relatedUserId, isSkarn) {
  const message = normalizeMessage(messageOrId, guildId, channelId, authorId, authorName, content, createdAt, capturedAt, referenceMessageId, relatedUserId, isSkarn);
  return db.prepare(
    'INSERT INTO channel_context_messages (message_id, guild_id, channel_id, author_id, author_name, content, created_at, captured_at, reference_message_id, related_user_id, is_skarn) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(message_id) DO NOTHING'
  ).run(
    message.messageId,
    message.guildId,
    message.channelId,
    message.authorId,
    message.authorName,
    message.content,
    message.createdAt,
    message.capturedAt,
    message.referenceMessageId,
    message.relatedUserId,
    message.isSkarn,
  ).changes;
}

function editChannelContextMessage(messageOrId, guildId, channelId, content, fields = {}) {
  let messageId = messageOrId;
  let nextGuildId = guildId;
  let nextChannelId = channelId;
  let nextContent = content;
  let patch = fields;
  if (messageOrId && typeof messageOrId === 'object') {
    messageId = messageOrId.messageId ?? messageOrId.message_id;
    nextGuildId = messageOrId.guildId ?? messageOrId.guild_id;
    nextChannelId = messageOrId.channelId ?? messageOrId.channel_id;
    nextContent = messageOrId.content;
    patch = messageOrId;
  }
  messageId = requireId(messageId, 'messageId');
  nextGuildId = requireId(nextGuildId, 'guildId');
  nextChannelId = requireId(nextChannelId, 'channelId');
  if (typeof nextContent !== 'string') throw new TypeError('content must be a string');

  const sets = ['content = ?'];
  const values = [nextContent];
  if (Object.prototype.hasOwnProperty.call(patch, 'authorName') || Object.prototype.hasOwnProperty.call(patch, 'author_name')) {
    const nextAuthorName = patch.authorName ?? patch.author_name;
    if (typeof nextAuthorName !== 'string' || nextAuthorName.length === 0) throw new TypeError('authorName must be a non-empty string');
    sets.push('author_name = ?');
    values.push(nextAuthorName);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'referenceMessageId') || Object.prototype.hasOwnProperty.call(patch, 'reference_message_id')) {
    const nextReference = patch.referenceMessageId ?? patch.reference_message_id;
    sets.push('reference_message_id = ?');
    values.push(nextReference === null || nextReference === undefined ? null : requireId(nextReference, 'referenceMessageId'));
  }
  values.push(messageId, nextGuildId, nextChannelId);
  const tx = db.transaction(() => {
    pruneChannelContextMessages();
    const updated = db.prepare(
      'UPDATE channel_context_messages SET ' + sets.join(', ') + ' WHERE message_id = ? AND guild_id = ? AND channel_id = ?'
    ).run(...values).changes;
    if (updated) deleteSummarySegmentsForMessage(db, nextGuildId, nextChannelId, messageId);
    return updated;
  });
  return tx();
}

function parseStringArray(value, name) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new TypeError(name + ' must be a JSON array'); }
  }
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(name + ' must be an array of non-empty strings');
  }
  return [...new Set(parsed)];
}

function parseStoredStringArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function deleteSummarySegmentsForMessage(dbConnection, guildId, channelId, messageId) {
  const rows = dbConnection.prepare(
    'SELECT segment_id, source_message_ids FROM channel_context_summary_segments WHERE guild_id = ? AND channel_id = ?'
  ).all(guildId, channelId);
  let deleted = 0;
  for (const row of rows) {
    if (!parseStoredStringArray(row.source_message_ids).includes(messageId)) continue;
    deleted += dbConnection.prepare(
      'DELETE FROM channel_context_summary_segments WHERE segment_id = ? AND guild_id = ? AND channel_id = ?'
    ).run(row.segment_id, guildId, channelId).changes;
  }
  return deleted;
}

function deleteChannelContextMessage(messageOrId, guildId, channelId) {
  let messageId = messageOrId;
  let nextGuildId = guildId;
  let nextChannelId = channelId;
  if (messageOrId && typeof messageOrId === 'object') {
    messageId = messageOrId.messageId ?? messageOrId.message_id;
    nextGuildId = messageOrId.guildId ?? messageOrId.guild_id;
    nextChannelId = messageOrId.channelId ?? messageOrId.channel_id;
  }
  messageId = requireId(messageId, 'messageId');
  nextGuildId = requireId(nextGuildId, 'guildId');
  nextChannelId = requireId(nextChannelId, 'channelId');
  const tx = db.transaction(() => {
    const result = db.prepare(
      'DELETE FROM channel_context_messages WHERE message_id = ? AND guild_id = ? AND channel_id = ?'
    ).run(messageId, nextGuildId, nextChannelId);
    deleteSummarySegmentsForMessage(db, nextGuildId, nextChannelId, messageId);
    return result.changes;
  });
  return tx();
}

function deleteChannelContextMessagesByAuthor(authorId, guildId) {
  authorId = requireId(authorId, 'authorId');
  guildId = requireId(guildId, 'guildId');
  const tx = db.transaction(() => {
    const rows = db.prepare('SELECT message_id, channel_id FROM channel_context_messages WHERE guild_id = ? AND (author_id = ? OR related_user_id = ?)').all(guildId, authorId, authorId);
    for (const row of rows) deleteSummarySegmentsForMessage(db, guildId, row.channel_id, row.message_id);
    return db.prepare('DELETE FROM channel_context_messages WHERE guild_id = ? AND (author_id = ? OR related_user_id = ?)').run(guildId, authorId, authorId).changes;
  });
  return tx();
}

function pruneChannelContextMessages(now = Date.now()) {
  now = requireTimestamp(now, 'now');
  const cutoff = now - CHANNEL_CONTEXT_RETENTION_MS;
  return db.prepare('DELETE FROM channel_context_messages WHERE created_at <= ?').run(cutoff).changes;
}

function getChannelContextMessages(guildId, channelId, options = {}) {
  guildId = requireId(guildId, 'guildId');
  channelId = requireId(channelId, 'channelId');
  if (typeof options === 'number') options = { limit: options };
  const now = options.now === undefined ? Date.now() : requireTimestamp(options.now, 'now');
  pruneChannelContextMessages(now);
  const rows = db.prepare(
    'SELECT message_id, guild_id, channel_id, author_id, author_name, content, created_at, captured_at, reference_message_id, related_user_id, is_skarn ' +
    'FROM channel_context_messages WHERE guild_id = ? AND channel_id = ? AND created_at > ? ' +
    'ORDER BY created_at ASC, captured_at ASC, message_id ASC'
  ).all(guildId, channelId, now - CHANNEL_CONTEXT_RETENTION_MS);
  if (options.limit === undefined || options.limit === null) return rows;
  const limit = requireTimestamp(options.limit, 'limit');
  if (limit <= 0) return [];
  return rows.slice(-limit);
}

function normalizeSummaryArgs(segmentOrId, guildId, channelId, summaryText, coversFrom, coversTo, sourceAuthorIds, sourceMessageIds, createdAt, updatedAt) {
  if (segmentOrId && typeof segmentOrId === 'object') {
    return {
      segmentId: segmentOrId.segmentId ?? segmentOrId.segment_id,
      guildId: segmentOrId.guildId ?? segmentOrId.guild_id,
      channelId: segmentOrId.channelId ?? segmentOrId.channel_id,
      summaryText: segmentOrId.summaryText ?? segmentOrId.summary_text,
      coversFrom: segmentOrId.coversFrom ?? segmentOrId.covers_from,
      coversTo: segmentOrId.coversTo ?? segmentOrId.covers_to,
      sourceAuthorIds: segmentOrId.sourceAuthorIds ?? segmentOrId.source_author_ids,
      sourceMessageIds: segmentOrId.sourceMessageIds ?? segmentOrId.source_message_ids,
      createdAt: segmentOrId.createdAt ?? segmentOrId.created_at,
      updatedAt: segmentOrId.updatedAt ?? segmentOrId.updated_at,
    };
  }
  return { segmentId: segmentOrId, guildId, channelId, summaryText, coversFrom, coversTo, sourceAuthorIds, sourceMessageIds, createdAt, updatedAt };
}

function normalizeSummary(segmentOrId, guildId, channelId, summaryText, coversFrom, coversTo, sourceAuthorIds, sourceMessageIds, createdAt, updatedAt) {
  const segment = normalizeSummaryArgs(segmentOrId, guildId, channelId, summaryText, coversFrom, coversTo, sourceAuthorIds, sourceMessageIds, createdAt, updatedAt);
  segment.segmentId = segment.segmentId || crypto.randomUUID();
  segment.segmentId = requireId(segment.segmentId, 'segmentId');
  segment.guildId = requireId(segment.guildId, 'guildId');
  segment.channelId = requireId(segment.channelId, 'channelId');
  if (typeof segment.summaryText !== 'string' || segment.summaryText.length === 0) throw new TypeError('summaryText must be a non-empty string');
  segment.coversFrom = requireTimestamp(segment.coversFrom, 'coversFrom');
  segment.coversTo = requireTimestamp(segment.coversTo, 'coversTo');
  if (segment.coversTo < segment.coversFrom) throw new RangeError('coversTo must be greater than or equal to coversFrom');
  segment.sourceAuthorIds = parseStringArray(segment.sourceAuthorIds, 'sourceAuthorIds');
  segment.sourceMessageIds = parseStringArray(segment.sourceMessageIds, 'sourceMessageIds');
  if (segment.sourceAuthorIds.length === 0 || segment.sourceMessageIds.length === 0) {
    throw new TypeError('summary segment provenance must include authors and messages');
  }
  segment.createdAt = segment.createdAt === undefined || segment.createdAt === null
    ? Date.now()
    : requireTimestamp(segment.createdAt, 'createdAt');
  segment.updatedAt = segment.updatedAt === undefined || segment.updatedAt === null
    ? Date.now()
    : requireTimestamp(segment.updatedAt, 'updatedAt');
  return segment;
}

function persistChannelContextSummarySegment(segmentOrId, guildId, channelId, summaryText, coversFrom, coversTo, sourceAuthorIds, sourceMessageIds, createdAt, updatedAt) {
  const segment = normalizeSummary(segmentOrId, guildId, channelId, summaryText, coversFrom, coversTo, sourceAuthorIds, sourceMessageIds, createdAt, updatedAt);
  db.prepare(
    'INSERT INTO channel_context_summary_segments (segment_id, guild_id, channel_id, summary_text, covers_from, covers_to, created_at, updated_at, source_author_ids, source_message_ids) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(segment_id) DO UPDATE SET summary_text = excluded.summary_text, covers_from = excluded.covers_from, covers_to = excluded.covers_to, updated_at = excluded.updated_at, source_author_ids = excluded.source_author_ids, source_message_ids = excluded.source_message_ids ' +
    'WHERE channel_context_summary_segments.guild_id = excluded.guild_id AND channel_context_summary_segments.channel_id = excluded.channel_id'
  ).run(
    segment.segmentId,
    segment.guildId,
    segment.channelId,
    segment.summaryText,
    segment.coversFrom,
    segment.coversTo,
    segment.createdAt,
    segment.updatedAt,
    JSON.stringify(segment.sourceAuthorIds),
    JSON.stringify(segment.sourceMessageIds),
  );
  return segment.segmentId;
}

function listChannelContextSummarySegments(guildId, channelId, options = {}) {
  guildId = requireId(guildId, 'guildId');
  channelId = requireId(channelId, 'channelId');
  if (typeof options === 'number') options = { limit: options };
  const rows = db.prepare(
    'SELECT segment_id, guild_id, channel_id, summary_text, covers_from, covers_to, created_at, updated_at, source_author_ids, source_message_ids ' +
    'FROM channel_context_summary_segments WHERE guild_id = ? AND channel_id = ? ' +
    'ORDER BY covers_from ASC, covers_to ASC, created_at ASC, segment_id ASC'
  ).all(guildId, channelId);
  if (options.limit === undefined || options.limit === null) return rows;
  const limit = requireTimestamp(options.limit, 'limit');
  if (limit <= 0) return [];
  return rows.slice(-limit);
}

function deleteChannelContextSummarySegmentsByAuthor(authorId, guildId, channelId) {
  authorId = requireId(authorId, 'authorId');
  guildId = requireId(guildId, 'guildId');
  if (channelId !== undefined && channelId !== null) channelId = requireId(channelId, 'channelId');
  const tx = db.transaction(() => {
    const rows = channelId === undefined || channelId === null
      ? db.prepare('SELECT segment_id, channel_id, source_author_ids FROM channel_context_summary_segments WHERE guild_id = ?').all(guildId)
      : db.prepare('SELECT segment_id, channel_id, source_author_ids FROM channel_context_summary_segments WHERE guild_id = ? AND channel_id = ?').all(guildId, channelId);
    let deleted = 0;
    for (const row of rows) {
      if (!parseStoredStringArray(row.source_author_ids).includes(authorId)) continue;
      deleted += db.prepare(
        'DELETE FROM channel_context_summary_segments WHERE segment_id = ? AND guild_id = ? AND channel_id = ?'
      ).run(row.segment_id, guildId, row.channel_id).changes;
    }
    return deleted;
  });
  return tx();
}

function forgetUserFromChannelSummaries(userId, guildId) {
  return deleteChannelContextSummarySegmentsByAuthor(userId, guildId);
}

module.exports = {
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
  forgetUserFromChannelSummaries,
  readChannelContextMessages: getChannelContextMessages,
};
