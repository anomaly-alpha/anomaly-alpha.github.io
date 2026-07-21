const { db } = require('../../../db/database');

function insertOmen(guildId, omenText, embedding) {
  return db.prepare(
    'INSERT INTO server_omens (guild_id, omen_text, embedding, created_at) VALUES (?, ?, ?, ?)'
  ).run(guildId, omenText, embedding, Date.now());
}

function getUnresolvedOmens(guildId) {
  return db.prepare(
    "SELECT * FROM server_omens WHERE guild_id = ? AND status = 'unresolved' ORDER BY created_at ASC"
  ).all(guildId);
}

function fulfillOmen(id, fulfillmentText) {
  db.prepare(
    "UPDATE server_omens SET status = 'fulfilled', fulfillment_text = ?, resolved_at = ? WHERE id = ?"
  ).run(fulfillmentText, Date.now(), id);
}

function expireOmen(id) {
  db.prepare(
    "UPDATE server_omens SET status = 'expired', resolved_at = ? WHERE id = ?"
  ).run(Date.now(), id);
}

function getOmenById(id) {
  return db.prepare('SELECT * FROM server_omens WHERE id = ?').get(id);
}

function getFulfilledOmens(guildId, page, pageSize) {
  const p = page || 0;
  const s = pageSize || 10;
  return db.prepare(
    "SELECT * FROM server_omens WHERE guild_id = ? AND status = 'fulfilled' ORDER BY resolved_at DESC LIMIT ? OFFSET ?"
  ).all(guildId, s, p * s);
}

function insertRealmOmen(omenId, guildId, callbackText) {
  return db.prepare(
    'INSERT INTO realm_omens (omen_id, guild_id, fulfilled_at, callback_text) VALUES (?, ?, ?, ?)'
  ).run(omenId, guildId, Date.now(), callbackText);
}

function getRecentRealmOmens(guildId, limit) {
  const l = limit || 3;
  return db.prepare(
    'SELECT * FROM realm_omens WHERE guild_id = ? ORDER BY fulfilled_at DESC LIMIT ?'
  ).all(guildId, l);
}

module.exports = {
  insertOmen,
  getUnresolvedOmens,
  fulfillOmen,
  expireOmen,
  getOmenById,
  getFulfilledOmens,
  insertRealmOmen,
  getRecentRealmOmens,
};
