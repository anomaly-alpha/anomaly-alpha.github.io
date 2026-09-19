const fs = require('fs');
const path = require('path');

const CONTRACT_SCHEMA_VERSION = 1;
const LOCAL_POLICY_SCHEMA_VERSION = 1;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CONTRACT_PATH = path.join(__dirname, '../../../skarn-bot/presence-assets/presence-mood-contract.json');
const LOCAL_POLICY_PATH = path.join(__dirname, '../../config/presence-local.json');
const MOOD_IDS = Object.freeze(['dormant', 'observing', 'pondering', 'displeased']);
const ROLL_MOODS = Object.freeze(['displeased', 'pondering', 'observing']);
const LOCAL_POLICY_FIELDS = new Set(['schemaVersion', 'policyRevision', 'timeZone', 'sleepWindow']);

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(0);
    return true;
  } catch (error) {
    return false;
  }
}

function validateHour(value, field, errors) {
  if (!Number.isInteger(value) || value < 0 || value > 23) {
    errors.push(field + ' must be an hour from 0 to 23');
  }
}

function validatePresenceContract(input, options) {
  const errors = [];
  const settings = options || {};
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

  if (input.policyRevision !== undefined &&
      (!Number.isSafeInteger(input.policyRevision) || input.policyRevision < 1)) {
    errors.push('policyRevision must be a positive safe integer');
  }
  if (settings.requirePolicyRevision &&
      (!Number.isSafeInteger(input.policyRevision) || input.policyRevision < 1)) {
    errors.push('policyRevision is required for local contracts');
  }

  const sleepWindow = input.sleepWindow;
  if (!sleepWindow || typeof sleepWindow !== 'object' || Array.isArray(sleepWindow)) {
    errors.push('sleepWindow must be an object');
  } else {
    validateHour(sleepWindow.startHour, 'sleepWindow.startHour', errors);
    validateHour(sleepWindow.endHour, 'sleepWindow.endHour', errors);
    if (sleepWindow.startHour === sleepWindow.endHour) {
      errors.push('sleepWindow startHour and endHour must differ');
    }

    if (sleepWindow.timeZone !== undefined) {
      if (!isValidTimeZone(sleepWindow.timeZone)) errors.push('sleepWindow.timeZone must be a valid IANA time zone');
      if (sleepWindow.utcOffset !== undefined) errors.push('sleepWindow.utcOffset must be omitted when timeZone is set');
    } else if (!Number.isInteger(sleepWindow.utcOffset) || sleepWindow.utcOffset < -23 || sleepWindow.utcOffset > 23) {
      errors.push('sleepWindow.utcOffset must be an integer from -23 to 23');
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
  if (!maintenance || typeof maintenance !== 'object' || Array.isArray(maintenance)) {
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

function validateLocalPolicy(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['local policy must be an object'] };
  }
  Object.keys(input).forEach(field => {
    if (!LOCAL_POLICY_FIELDS.has(field)) errors.push('local policy has an unknown field: ' + field);
  });
  if (input.schemaVersion !== LOCAL_POLICY_SCHEMA_VERSION) errors.push('unsupported local policy schemaVersion');
  if (!Number.isSafeInteger(input.policyRevision) || input.policyRevision < 1) {
    errors.push('local policy policyRevision must be a positive safe integer');
  }
  if (!isValidTimeZone(input.timeZone)) errors.push('local policy timeZone must be a valid IANA time zone');
  if (!input.sleepWindow || typeof input.sleepWindow !== 'object' || Array.isArray(input.sleepWindow)) {
    errors.push('local policy sleepWindow must be an object');
  } else {
    const sleepFields = Object.keys(input.sleepWindow);
    sleepFields.forEach(field => {
      if (field !== 'startHour' && field !== 'endHour') errors.push('local policy sleepWindow has an unknown field: ' + field);
    });
    validateHour(input.sleepWindow.startHour, 'local policy sleepWindow.startHour', errors);
    validateHour(input.sleepWindow.endHour, 'local policy sleepWindow.endHour', errors);
    if (input.sleepWindow.startHour === input.sleepWindow.endHour) {
      errors.push('local policy sleepWindow startHour and endHour must differ');
    }
  }
  return { ok: errors.length === 0, errors };
}

function readJson(filePath, fileSystem, description) {
  const adapter = fileSystem || fs;
  try {
    return JSON.parse(adapter.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const readError = new Error('unable to read ' + description + ': ' + error.message);
    readError.code = description === 'presence mood contract'
      ? 'PRESENCE_CONTRACT_READ_FAILED'
      : 'PRESENCE_LOCAL_POLICY_READ_FAILED';
    throw readError;
  }
}

function throwValidationError(message, code, errors) {
  const validationError = new Error(message + ': ' + errors.join('; '));
  validationError.code = code;
  validationError.errors = errors;
  throw validationError;
}

function mergeLocalPolicy(shared, localPolicy) {
  const merged = {
    ...shared,
    sleepWindow: {
      startHour: localPolicy.sleepWindow.startHour,
      endHour: localPolicy.sleepWindow.endHour,
      timeZone: localPolicy.timeZone,
    },
    policyRevision: localPolicy.policyRevision,
  };
  const validation = validatePresenceContract(merged, { requirePolicyRevision: true });
  if (!validation.ok) throwValidationError('invalid merged local presence contract', 'INVALID_PRESENCE_CONTRACT', validation.errors);
  return merged;
}

function loadPresenceContract(filePath, fileSystem, options) {
  const settings = options || {};
  const target = filePath || CONTRACT_PATH;
  const shared = readJson(target, fileSystem, 'presence mood contract');
  const sharedValidation = validatePresenceContract(shared);
  if (!sharedValidation.ok) throwValidationError('invalid presence mood contract', 'INVALID_PRESENCE_CONTRACT', sharedValidation.errors);

  // A custom contract path keeps the historical shared-only behavior unless local is explicit.
  const hasCustomPath = filePath !== undefined && filePath !== null;
  const useLocal = settings.local === true || (!hasCustomPath && settings.local !== false);
  if (!useLocal) return shared;

  const localPath = settings.localPath || LOCAL_POLICY_PATH;
  const local = readJson(localPath, fileSystem, 'local presence policy');
  const localValidation = validateLocalPolicy(local);
  if (!localValidation.ok) throwValidationError('invalid local presence policy', 'INVALID_PRESENCE_LOCAL_POLICY', localValidation.errors);
  return mergeLocalPolicy(shared, local);
}

function loadSharedPresenceContract(filePath, fileSystem) {
  return loadPresenceContract(filePath, fileSystem, { local: false });
}

function assertTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp < 0 || !Number.isFinite(new Date(timestamp).getTime())) {
    throw new RangeError('timestamp must be a non-negative date timestamp');
  }
}

function getDateTimeParts(timestamp, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = {};
  formatter.formatToParts(new Date(timestamp)).forEach(part => {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  });
  return values;
}

function getLocalDateParts(timestamp, contract) {
  assertTimestamp(timestamp);
  const sleepWindow = contract.sleepWindow;
  if (sleepWindow.timeZone) return getDateTimeParts(timestamp, sleepWindow.timeZone);
  const shifted = new Date(timestamp + sleepWindow.utcOffset * HOUR_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function getLocalHour(timestamp, contract) {
  return getLocalDateParts(timestamp, contract).hour;
}

function isSleepTime(timestamp, contract) {
  const hour = getLocalHour(timestamp, contract);
  const start = contract.sleepWindow.startHour;
  const end = contract.sleepWindow.endHour;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function getTimeZoneOffsetMs(timestamp, timeZone) {
  const parts = getDateTimeParts(timestamp, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(timestamp / 1000) * 1000;
}

function sameLocalDateTime(parts, target) {
  return parts.year === target.year && parts.month === target.month && parts.day === target.day &&
    parts.hour === target.hour && parts.minute === target.minute && parts.second === target.second;
}

function addLocalDay(dateParts) {
  const next = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function resolveLocalDateTime(target, timeZone) {
  const wallTimestamp = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute || 0, target.second || 0);
  const offsets = new Set([-2, -1, 0, 1, 2].map(days => getTimeZoneOffsetMs(wallTimestamp + days * DAY_MS, timeZone)));
  const candidates = [];
  offsets.forEach(offset => {
    const candidate = wallTimestamp - offset;
    if (sameLocalDateTime(getDateTimeParts(candidate, timeZone), target) && !candidates.includes(candidate)) candidates.push(candidate);
  });
  if (candidates.length > 0) return candidates.sort((a, b) => a - b);

  // A spring-forward can erase a local wall time. Move to the first representable instant after it.
  for (let candidate = wallTimestamp - 6 * HOUR_MS; candidate <= wallTimestamp + 6 * HOUR_MS; candidate += 60 * 1000) {
    const parts = getDateTimeParts(candidate, timeZone);
    const localTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    if (localTimestamp >= wallTimestamp) return [candidate];
  }
  throw new RangeError('unable to resolve local boundary in ' + timeZone);
}

function getNextWakeAt(timestamp, contract) {
  assertTimestamp(timestamp);
  const sleepWindow = contract.sleepWindow;
  if (!sleepWindow.timeZone) {
    const offsetMs = sleepWindow.utcOffset * HOUR_MS;
    const localNow = new Date(timestamp + offsetMs);
    let wakeAt = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate(),
      sleepWindow.endHour,
      0,
      0,
      0,
    ) - offsetMs;
    if (wakeAt <= timestamp) wakeAt += DAY_MS;
    return wakeAt;
  }

  const localNow = getLocalDateParts(timestamp, contract);
  let targetDate = { year: localNow.year, month: localNow.month, day: localNow.day };
  let candidates = resolveLocalDateTime({ ...targetDate, hour: sleepWindow.endHour, minute: 0, second: 0 }, sleepWindow.timeZone);
  let wakeAt = candidates.find(candidate => candidate > timestamp);
  if (wakeAt === undefined) {
    targetDate = addLocalDay(targetDate);
    candidates = resolveLocalDateTime({ ...targetDate, hour: sleepWindow.endHour, minute: 0, second: 0 }, sleepWindow.timeZone);
    wakeAt = candidates.find(candidate => candidate > timestamp);
  }
  if (wakeAt === undefined) throw new RangeError('unable to calculate next wake boundary');
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
  const validation = validatePresenceContract(contract, { requirePolicyRevision: contract.policyRevision !== undefined });
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
  const state = {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    process: options.process,
    mood,
    moodStartedAt: now,
    moodUntil: mood === 'dormant' ? getNextWakeAt(now, contract) : now + contract.moodDwellMs,
    revision: previousRevision + 1,
    updatedAt: now,
  };
  if (contract.policyRevision !== undefined) state.policyRevision = contract.policyRevision;
  return state;
}

module.exports = {
  CONTRACT_PATH,
  CONTRACT_SCHEMA_VERSION,
  LOCAL_POLICY_PATH,
  MOOD_IDS,
  createMoodWindow,
  getLocalDateParts,
  getLocalHour,
  getNextWakeAt,
  isSleepTime,
  loadPresenceContract,
  loadSharedPresenceContract,
  mergeLocalPolicy,
  selectMood,
  validateLocalPolicy,
  validatePresenceContract,
};
