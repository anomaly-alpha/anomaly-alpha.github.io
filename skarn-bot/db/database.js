// ===== db/database.js — PUBLIC FACADE =====
// Decomposed into db/<domain>.js modules (2026-08-04). This file exists so
// every existing `require('../db/database')` keeps working unchanged.
// Note: sanitizeFtsQuery is an internal shared helper in db.js and is NOT
// part of the public facade surface.
const {
  db,
  getChannelState,
  updateChannelState,
  updateRelationshipField,
  upsertUserProfile,
  getSentimentBuffer,
  pushSentimentBuffer,
  upsertAttentionState,
  pruneRateLimits,
  pruneExpiredFlags,
} = require('./db');
const memory = require('./memory');
const conversation = require('./conversation');
const relationship = require('./relationship');
const channel = require('./channel');
const ops = require('./ops');
const humor = require('./humor');
const stories = require('./stories');

module.exports = Object.assign(
  {},
  {
    db,
    getChannelState,
    updateChannelState,
    updateRelationshipField,
    upsertUserProfile,
    getSentimentBuffer,
    pushSentimentBuffer,
    upsertAttentionState,
    pruneRateLimits,
    pruneExpiredFlags,
  },
  memory,
  conversation,
  relationship,
  channel,
  ops,
  humor,
  stories,
);