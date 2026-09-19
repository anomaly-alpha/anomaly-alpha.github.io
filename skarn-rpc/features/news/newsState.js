const fs = require('fs');
const path = require('path');

const STATE_SCHEMA_VERSION = 1;
const MAX_ITEMS = 150;
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ALL_TIME_MAX_AGE_MS = Number.MAX_SAFE_INTEGER;
const STATE_PATH = path.join(__dirname, '../../data/news-state.json');
const ITEM_FIELDS = Object.freeze([
  'id',
  'title',
  'canonicalUrl',
  'sourceId',
  'sourceName',
  'publishedAt',
  'updatedAt',
  'fetchedAt',
  'topic',
  'confidence',
  'basePriority',
  'salience',
  'iconRole',
  'safetyDecision',
]);

function nowValue(value) {
  const timestamp = value === undefined ? Date.now() : value;
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new RangeError('now must be a non-negative safe integer');
  return timestamp;
}

function diagnostic(error) {
  const code = error && error.code ? String(error.code).replace(/[^A-Z0-9_-]/gi, '_') : 'UNKNOWN';
  const status = error && Number.isInteger(error.statusCode) ? ':' + error.statusCode : '';
  return (code + status).slice(0, 160);
}

function projectItem(item) {
  const projected = {};
  for (const field of ITEM_FIELDS) {
    if (item[field] !== undefined) projected[field] = item[field];
  }
  return projected;
}

function isValidItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  for (const field of ['id', 'title', 'canonicalUrl', 'sourceId', 'sourceName', 'publishedAt', 'updatedAt', 'fetchedAt', 'topic', 'salience', 'iconRole', 'safetyDecision']) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') return false;
  }
  if (!['high', 'normal'].includes(item.salience) || item.safetyDecision !== 'accepted') return false;
  if (typeof item.confidence !== 'number' || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) return false;
  if (!Number.isSafeInteger(item.basePriority)) return false;
  const dates = ['publishedAt', 'updatedAt', 'fetchedAt'].map(field => Date.parse(item[field]));
  return dates.every(Number.isFinite);
}

function validateNewsState(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, errors: ['state must be an object'] };
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) errors.push('unsupported schemaVersion');
  if (!Number.isSafeInteger(state.updatedAt) || state.updatedAt < 0) errors.push('updatedAt must be a non-negative safe integer');
  if (!Array.isArray(state.items)) errors.push('items must be an array');
  if (Array.isArray(state.items)) {
    if (state.items.length > MAX_ITEMS) errors.push('items cannot exceed ' + MAX_ITEMS);
    state.items.forEach((item, index) => { if (!isValidItem(item)) errors.push('items[' + index + '] is invalid'); });
  }
  if (!state.sources || typeof state.sources !== 'object' || Array.isArray(state.sources)) errors.push('sources must be an object');
  if (state.lastError !== null && state.lastError !== undefined && typeof state.lastError !== 'string') errors.push('lastError must be a string or null');
  return { ok: errors.length === 0, errors };
}

function createEmptyState(now) {
  const timestamp = nowValue(now);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: timestamp,
    items: [],
    sources: {},
    lastPollAt: null,
    lastSuccessAt: null,
    lastError: null,
  };
}

function itemTime(item) {
  const value = Date.parse(item.updatedAt || item.publishedAt);
  return Number.isFinite(value) ? value : 0;
}

function pruneItems(items, now, maxAgeMs, options) {
  const cutoff = now - maxAgeMs;
  const unique = [];
  for (const candidate of items || []) {
    const item = projectItem(candidate);
    if (!isValidItem(item) || itemTime(item) < cutoff || itemTime(item) > now) continue;
    const matches = unique.filter(existing => existing.id === item.id || existing.canonicalUrl === item.canonicalUrl);
    if (matches.length === 0) {
      unique.push(item);
      continue;
    }
    const newest = [item, ...matches].sort((left, right) => itemTime(right) - itemTime(left))[0];
    for (const match of matches) unique.splice(unique.indexOf(match), 1);
    unique.push(newest);
  }
  const sorted = unique.sort((left, right) => itemTime(right) - itemTime(left));
  const maxItemsPerSource = options && Number.isSafeInteger(options.maxItemsPerSource) && options.maxItemsPerSource > 0
    ? options.maxItemsPerSource
    : null;
  if (!maxItemsPerSource) return sorted.slice(0, MAX_ITEMS);
  const counts = {};
  return sorted.filter(item => {
    const count = counts[item.sourceId] || 0;
    if (count >= maxItemsPerSource) return false;
    counts[item.sourceId] = count + 1;
    return true;
  }).slice(0, MAX_ITEMS);
}

function mergeNewsItems(state, incoming, options) {
  const settings = options || {};
  const now = nowValue(settings.now);
  const maxAgeMs = Number.isSafeInteger(settings.maxAgeMs) && settings.maxAgeMs > 0
    ? settings.maxAgeMs
    : DEFAULT_MAX_AGE_MS;
  const merged = pruneItems([...(state.items || []), ...(incoming || [])], now, maxAgeMs, settings);
  return { ...state, items: merged, updatedAt: now };
}

function ensureOwnerDirectory(directory, adapter) {
  adapter.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { adapter.chmodSync(directory, 0o700); } catch (error) {}
}

function loadNewsState(filePath, options) {
  const target = filePath || STATE_PATH;
  const adapter = (options && options.fileSystem) || fs;
  const now = nowValue(options && options.now);
  let parsed;
  try {
    parsed = JSON.parse(adapter.readFileSync(target, 'utf8'));
  } catch (error) {
    return createEmptyState(now);
  }
  const validation = validateNewsState(parsed);
  if (!validation.ok) return createEmptyState(now);
  try { adapter.chmodSync(target, 0o600); } catch (error) {}
  try { adapter.chmodSync(path.dirname(target), 0o700); } catch (error) {}
  return mergeNewsItems(parsed, [], { now, maxAgeMs: (options && options.maxAgeMs) || DEFAULT_MAX_AGE_MS, maxItemsPerSource: options && options.maxItemsPerSource });
}

function saveNewsState(filePath, state, options) {
  const target = filePath || STATE_PATH;
  const settings = options || {};
  const adapter = settings.fileSystem || fs;
  const now = nowValue(settings.now);
  const maxAgeMs = Number.isSafeInteger(settings.maxAgeMs) && settings.maxAgeMs > 0
    ? settings.maxAgeMs
    : DEFAULT_MAX_AGE_MS;
  const normalized = {
    ...state,
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: now,
    items: pruneItems(state.items, now, maxAgeMs, settings),
    lastError: state.lastError ? String(state.lastError).slice(0, 160) : null,
  };
  const validation = validateNewsState(normalized);
  if (!validation.ok) throw new Error('invalid news state: ' + validation.errors.join('; '));
  const directory = path.dirname(target);
  ensureOwnerDirectory(directory, adapter);
  const temporary = target + '.tmp-' + process.pid + '-' + Date.now();
  try {
    adapter.writeFileSync(temporary, JSON.stringify(normalized, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    try { adapter.chmodSync(temporary, 0o600); } catch (error) {}
    adapter.renameSync(temporary, target);
    try { adapter.chmodSync(target, 0o600); } catch (error) {}
  } catch (error) {
    try { adapter.unlinkSync(temporary); } catch (cleanupError) {}
    throw error;
  }
  return normalized;
}

module.exports = {
  DEFAULT_MAX_AGE_MS,
  ALL_TIME_MAX_AGE_MS,
  ITEM_FIELDS,
  MAX_ITEMS,
  STATE_PATH,
  STATE_SCHEMA_VERSION,
  createEmptyState,
  diagnostic,
  isValidItem,
  loadNewsState,
  mergeNewsItems,
  projectItem,
  saveNewsState,
  validateNewsState,
};
