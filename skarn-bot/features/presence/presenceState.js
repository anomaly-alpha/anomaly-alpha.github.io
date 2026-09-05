const fs = require('fs');
const path = require('path');

const { CONTRACT_SCHEMA_VERSION, MOOD_IDS } = require('./presenceContract');

const LOCAL_STATE_PATH = path.join(__dirname, '../../data/rpc-mood-state.json');
const PROCESS_IDS = new Set(['skarn-rpc', 'skarn-railway-bot']);

function validateMoodState(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, errors: ['state must be an object'] };
  }
  if (state.schemaVersion !== CONTRACT_SCHEMA_VERSION) errors.push('unsupported schemaVersion');
  if (!PROCESS_IDS.has(state.process)) errors.push('unsupported process');
  if (!MOOD_IDS.includes(state.mood)) errors.push('unsupported mood');
  if (!Number.isSafeInteger(state.moodStartedAt) || state.moodStartedAt < 0) {
    errors.push('moodStartedAt must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(state.moodUntil) || state.moodUntil < 0) {
    errors.push('moodUntil must be a non-negative safe integer');
  }
  if (Number.isSafeInteger(state.moodStartedAt) && Number.isSafeInteger(state.moodUntil) &&
      state.moodUntil <= state.moodStartedAt) {
    errors.push('moodUntil must be after moodStartedAt');
  }
  if (!Number.isSafeInteger(state.revision) || state.revision < 1) {
    errors.push('revision must be a positive safe integer');
  }
  if (!Number.isSafeInteger(state.updatedAt) || state.updatedAt < 0) {
    errors.push('updatedAt must be a non-negative safe integer');
  }
  return { ok: errors.length === 0, errors };
}

function createMoodState(options) {
  if (!options || typeof options !== 'object') throw new TypeError('state options are required');
  const state = {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    process: options.process,
    mood: options.mood,
    moodStartedAt: options.moodStartedAt,
    moodUntil: options.moodUntil,
    revision: options.revision,
    updatedAt: options.updatedAt,
  };
  const validation = validateMoodState(state);
  if (!validation.ok) throw new Error('invalid mood state: ' + validation.errors.join('; '));
  return state;
}

function loadMoodState(filePath, now, fileSystem) {
  const target = filePath || LOCAL_STATE_PATH;
  const timestamp = now === undefined ? Date.now() : now;
  const adapter = fileSystem || fs;
  let raw;
  try {
    raw = adapter.readFileSync(target, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { state: null, resumable: false, reason: 'missing', errors: [] };
    return { state: null, resumable: false, reason: 'read-failed', errors: [error.message] };
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch (error) {
    return { state: null, resumable: false, reason: 'malformed', errors: [error.message] };
  }
  const validation = validateMoodState(state);
  if (!validation.ok) return { state: null, resumable: false, reason: 'invalid', errors: validation.errors };
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new RangeError('now must be a non-negative number');
  if (state.moodUntil <= timestamp) return { state, resumable: false, reason: 'expired', errors: [] };
  return { state, resumable: true, reason: 'valid', errors: [] };
}

function saveMoodState(filePath, state, fileSystem) {
  const target = filePath || LOCAL_STATE_PATH;
  const adapter = fileSystem || fs;
  const validation = validateMoodState(state);
  if (!validation.ok) throw new Error('invalid mood state: ' + validation.errors.join('; '));
  const temporary = target + '.tmp-' + process.pid + '-' + Date.now();
  adapter.mkdirSync(path.dirname(target), { recursive: true });
  try {
    adapter.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', 'utf8');
    adapter.renameSync(temporary, target);
  } catch (error) {
    try { adapter.unlinkSync(temporary); } catch (cleanupError) {}
    throw error;
  }
  return state;
}

module.exports = {
  LOCAL_STATE_PATH,
  createMoodState,
  loadMoodState,
  saveMoodState,
  validateMoodState,
};
