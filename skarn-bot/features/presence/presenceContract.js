const fs = require('fs');
const path = require('path');

const CONTRACT_SCHEMA_VERSION = 1;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CONTRACT_PATH = path.join(__dirname, '../../data/presence-mood-contract.json');
const MOOD_IDS = Object.freeze(['dormant', 'observing', 'pondering', 'displeased']);
const ROLL_MOODS = Object.freeze(['displeased', 'pondering', 'observing']);

function validatePresenceContract(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['contract must be an object'] };
  }

  if (input.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    errors.push('unsupported schemaVersion');
  }
  if (!Array.isArray(input.moods) || input.moods.length !== MOOD_IDS.length ||
      input.moods.some((mood, index) => mood !== MOOD_IDS[index])) {
    errors.push('moods must contain the canonical IDs in order');
  }

  const sleepWindow = input.sleepWindow;
  if (!sleepWindow || typeof sleepWindow !== 'object') {
    errors.push('sleepWindow must be an object');
  } else {
    if (!Number.isInteger(sleepWindow.startHour) || sleepWindow.startHour < 0 || sleepWindow.startHour > 23) {
      errors.push('sleepWindow.startHour must be an hour from 0 to 23');
    }
    if (!Number.isInteger(sleepWindow.endHour) || sleepWindow.endHour < 0 || sleepWindow.endHour > 23) {
      errors.push('sleepWindow.endHour must be an hour from 0 to 23');
    }
    if (!Number.isInteger(sleepWindow.utcOffset) || sleepWindow.utcOffset < -23 || sleepWindow.utcOffset > 23) {
      errors.push('sleepWindow.utcOffset must be an integer from -23 to 23');
    }
    if (sleepWindow.startHour === sleepWindow.endHour) {
      errors.push('sleepWindow startHour and endHour must differ');
    }
  }

  if (!Number.isSafeInteger(input.moodDwellMs) || input.moodDwellMs <= 0) {
    errors.push('moodDwellMs must be a positive safe integer');
  }
  if (!Number.isSafeInteger(input.phraseRotationMs) || input.phraseRotationMs <= 0) {
    errors.push('phraseRotationMs must be a positive safe integer');
  }

  const weights = input.selectionWeights;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    errors.push('selectionWeights must be an object');
  } else {
    const expectedKeys = [...ROLL_MOODS].sort();
    const actualKeys = Object.keys(weights).sort();
    if (actualKeys.join('|') !== expectedKeys.join('|')) {
      errors.push('selectionWeights must contain only non-dormant mood IDs');
    }
    let total = 0;
    expectedKeys.forEach(key => {
      if (typeof weights[key] !== 'number' || !Number.isFinite(weights[key]) || weights[key] < 0) {
        errors.push('selectionWeights.' + key + ' must be a non-negative number');
      } else {
        total += weights[key];
      }
    });
    if (Math.abs(total - 1) > 0.000001) errors.push('selectionWeights must sum to 1');
  }

  const maintenance = input.maintenance;
  if (!maintenance || typeof maintenance !== 'object') {
    errors.push('maintenance must be an object');
  } else {
    if (!Number.isSafeInteger(maintenance.localIntervalMs) || maintenance.localIntervalMs <= 0) {
      errors.push('maintenance.localIntervalMs must be a positive safe integer');
    }
    if (!Number.isSafeInteger(maintenance.railwayIntervalMs) || maintenance.railwayIntervalMs <= 0) {
      errors.push('maintenance.railwayIntervalMs must be a positive safe integer');
    }
    if (!Number.isSafeInteger(maintenance.maxBatchSize) || maintenance.maxBatchSize < 1 || maintenance.maxBatchSize > 50) {
      errors.push('maintenance.maxBatchSize must be a safe integer from 1 to 50');
    }
  }

  return { ok: errors.length === 0, errors };
}

function loadPresenceContract(filePath, fileSystem) {
  const target = filePath || CONTRACT_PATH;
  const adapter = fileSystem || fs;
  let parsed;
  try {
    parsed = JSON.parse(adapter.readFileSync(target, 'utf8'));
  } catch (error) {
    const readError = new Error('unable to read presence mood contract: ' + error.message);
    readError.code = 'PRESENCE_CONTRACT_READ_FAILED';
    throw readError;
  }
  const result = validatePresenceContract(parsed);
  if (!result.ok) {
    const validationError = new Error('invalid presence mood contract: ' + result.errors.join('; '));
    validationError.code = 'INVALID_PRESENCE_CONTRACT';
    validationError.errors = result.errors;
    throw validationError;
  }
  return parsed;
}

function assertTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new RangeError('timestamp must be a non-negative number');
}

function getLocalHour(timestamp, contract) {
  assertTimestamp(timestamp);
  return (new Date(timestamp).getUTCHours() + contract.sleepWindow.utcOffset + 24) % 24;
}

function isSleepTime(timestamp, contract) {
  const hour = getLocalHour(timestamp, contract);
  const start = contract.sleepWindow.startHour;
  const end = contract.sleepWindow.endHour;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function getNextWakeAt(timestamp, contract) {
  assertTimestamp(timestamp);
  const offsetMs = contract.sleepWindow.utcOffset * HOUR_MS;
  const localNow = new Date(timestamp + offsetMs);
  let wakeAt = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
    contract.sleepWindow.endHour,
    0,
    0,
    0,
  ) - offsetMs;
  if (wakeAt <= timestamp) wakeAt += DAY_MS;
  return wakeAt;
}

function selectMood(random, contract) {
  if (typeof random !== 'number' || !Number.isFinite(random) || random < 0 || random >= 1) {
    throw new RangeError('random must be a number from 0 inclusive to 1 exclusive');
  }
  let threshold = 0;
  for (const mood of ROLL_MOODS) {
    threshold += contract.selectionWeights[mood];
    if (random < threshold) return mood;
  }
  return 'observing';
}

function createMoodWindow(options) {
  if (!options || typeof options !== 'object') throw new TypeError('mood window options are required');
  const contract = options.contract || loadPresenceContract();
  const validation = validatePresenceContract(contract);
  if (!validation.ok) throw new Error('invalid contract: ' + validation.errors.join('; '));
  const now = options.now === undefined ? Date.now() : options.now;
  assertTimestamp(now);
  if (typeof options.process !== 'string' || options.process.length === 0) {
    throw new TypeError('process is required');
  }
  const mood = isSleepTime(now, contract) ? 'dormant' : selectMood(
    options.random === undefined ? Math.random() : options.random,
    contract,
  );
  const previousRevision = options.previousState && Number.isSafeInteger(options.previousState.revision)
    ? options.previousState.revision
    : 0;
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    process: options.process,
    mood,
    moodStartedAt: now,
    moodUntil: mood === 'dormant' ? getNextWakeAt(now, contract) : now + contract.moodDwellMs,
    revision: previousRevision + 1,
    updatedAt: now,
  };
}

module.exports = {
  CONTRACT_PATH,
  CONTRACT_SCHEMA_VERSION,
  MOOD_IDS,
  createMoodWindow,
  getNextWakeAt,
  isSleepTime,
  loadPresenceContract,
  selectMood,
  validatePresenceContract,
};
