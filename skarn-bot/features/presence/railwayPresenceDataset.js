const fs = require('fs');
const path = require('path');
const { MOOD_IDS } = require('./presenceContract');

const DATASET_SCHEMA_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 5000;
const DEFAULT_MIN_PER_MOOD = 500;
const DEFAULT_EXPECTED_COUNT = 5000;
const DATASET_PATH = path.join(__dirname, '../../presence-assets/presence-phrases.json');
const PALETTE_PATH = path.join(__dirname, '../../presence-assets/railway-symbol-palette.json');
const ICON_REGISTRY_PATH = path.join(__dirname, '../../../skarn-rpc/data/icon-registry.json');
const FORBIDDEN = /user|guild|channel|message|prompt|search|memory|secret|deployment/i;
const ALLOWED_FIELDS = new Set(['id', 'text', 'mood', 'symbol', 'rpcDetails', 'rpcState', 'rpcIconKey']);

function normalizePhraseText(text) { return String(text).normalize('NFKC').trim().replace(/\s+/g, ' '); }
function validationResult(errors, counts, phrases) { return { ok: errors.length === 0, errors, counts, phrases }; }

function readSet(filePath, map) {
  try {
    const values = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return new Set((values || []).map(map).filter(Boolean));
  } catch (error) {
    return new Set();
  }
}

function getSymbolPalette() {
  const palette = readSet(PALETTE_PATH, value => typeof value === 'string' ? value : null);
  return palette.size > 0 ? palette : new Set(['👁', '◈', '◇', '✦', '✧', '☾', '☼', '⚚', '⚙', '⌁', '⌘', '⟡', '☿', '♢', '♧', '⚑', '☍', '⚡', '✶', '✷', '✹', '❖', '⟁', '⟐']);
}

function getIconKeys(options) {
  if (options && options.iconKeys) return new Set(options.iconKeys);
  return readSet(ICON_REGISTRY_PATH, value => value && value.key);
}

function validateRailwayPhraseDataset(input, options) {
  const config = options || {};
  const maxEntries = config.maxEntries === undefined ? DEFAULT_MAX_ENTRIES : config.maxEntries;
  const minPerMood = config.minPerMood === undefined ? DEFAULT_MIN_PER_MOOD : config.minPerMood;
  const expectedCount = config.expectedCount === undefined ? DEFAULT_EXPECTED_COUNT : config.expectedCount;
  const errors = [], phrases = [], seenIds = new Set(), seenTexts = new Set();
  const counts = { total: 0 }; MOOD_IDS.forEach(m => { counts[m] = 0; });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return validationResult(['dataset must be an object'], counts, phrases);
  if (input.schemaVersion !== DATASET_SCHEMA_VERSION) errors.push('unsupported schemaVersion');
  if (typeof input.generatedAt !== 'string' || !Number.isFinite(Date.parse(input.generatedAt))) errors.push('generatedAt must be a valid date string');
  if (!Array.isArray(input.phrases)) return validationResult([...errors, 'phrases must be an array'], counts, phrases);
  if (input.phrases.length > maxEntries) errors.push('dataset exceeds maximum entry count');
  if (expectedCount !== null && input.phrases.length !== expectedCount) errors.push('dataset must contain exactly ' + expectedCount + ' entries');
  const symbols = getSymbolPalette();
  const iconKeys = getIconKeys(config);
  input.phrases.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push('phrase ' + index + ' must be an object'); return; }
    if (Object.keys(entry).some(field => !ALLOWED_FIELDS.has(field))) errors.push('phrase ' + index + ' has an unknown field');
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const text = typeof entry.text === 'string' ? normalizePhraseText(entry.text) : '';
    const mood = entry.mood;
    const fields = [entry.text, entry.rpcDetails, entry.rpcState];
    if (!id || id.length > 64 || !/^[a-z0-9][a-z0-9._-]*$/.test(id)) errors.push('phrase ' + index + ' has an invalid id');
    if (!text || text.length > 128 || entry.text !== text || /\r|\n/.test(entry.text || '')) errors.push('phrase ' + index + ' has invalid text');
    if (!MOOD_IDS.includes(mood)) errors.push('phrase ' + index + ' has an unsupported mood');
    if (fields.some(value => typeof value !== 'string' || !normalizePhraseText(value) || value !== normalizePhraseText(value) || /\r|\n/.test(value) || normalizePhraseText(value).length > 128)) errors.push('phrase ' + index + ' has invalid RPC fields');
    if (entry.symbol !== undefined && entry.symbol !== null && (typeof entry.symbol !== 'string' || !symbols.has(entry.symbol))) errors.push('phrase ' + index + ' has an unsupported symbol');
    if (typeof entry.rpcIconKey !== 'string' || !entry.rpcIconKey.trim()) errors.push('phrase ' + index + ' has no RPC icon key');
    if (iconKeys.size > 0 && typeof entry.rpcIconKey === 'string' && !iconKeys.has(entry.rpcIconKey.trim())) errors.push('phrase ' + index + ' has an unknown RPC icon key');
    if ([entry.text, entry.rpcDetails, entry.rpcState].some(value => typeof value === 'string' && FORBIDDEN.test(value))) errors.push('phrase ' + index + ' contains forbidden content');
    const textKey = text.toLowerCase(), duplicateId = id && seenIds.has(id), duplicateText = text && seenTexts.has(textKey);
    if (duplicateId) errors.push('duplicate phrase id: ' + id);
    if (duplicateText) errors.push('duplicate normalized phrase text: ' + text);
    if (id) seenIds.add(id); if (text) seenTexts.add(textKey);
    if (id && text && MOOD_IDS.includes(mood) && !duplicateId && !duplicateText) {
      const normalized = { id, text, mood, symbol: entry.symbol == null ? null : entry.symbol, rpcDetails: normalizePhraseText(entry.rpcDetails), rpcState: normalizePhraseText(entry.rpcState), rpcIconKey: entry.rpcIconKey.trim() };
      if ((normalized.symbol ? normalized.symbol + ' ' : '').length + text.length <= 128) { phrases.push(normalized); counts.total++; counts[mood]++; } else errors.push('phrase ' + index + ' exceeds activity length');
    }
  });
  MOOD_IDS.forEach(m => { if (counts[m] < minPerMood) errors.push('mood ' + m + ' requires at least ' + minPerMood + ' entries'); });
  return validationResult(errors, counts, phrases);
}
function loadRailwayPhraseDataset(filePath, fileSystem, options) {
  const target = filePath || DATASET_PATH, adapter = fileSystem || fs; let parsed;
  try { parsed = JSON.parse(adapter.readFileSync(target, 'utf8')); } catch (error) { const e = new Error('unable to read Railway phrase dataset: ' + error.message); e.code = 'RAILWAY_DATASET_READ_FAILED'; throw e; }
  const result = validateRailwayPhraseDataset(parsed, options); if (!result.ok) { const e = new Error('invalid Railway phrase dataset: ' + result.errors.join('; ')); e.code = 'INVALID_RAILWAY_DATASET'; e.errors = result.errors; throw e; }
  return { ...parsed, phrases: result.phrases };
}
function writeRailwayPhraseDataset(filePath, dataset, fileSystem, options) {
  const target = filePath || DATASET_PATH, adapter = fileSystem || fs, result = validateRailwayPhraseDataset(dataset, options);
  if (!result.ok) throw new Error('invalid Railway phrase dataset: ' + result.errors.join('; '));
  const temporary = target + '.tmp-' + process.pid + '-' + Date.now(); adapter.mkdirSync(path.dirname(target), { recursive: true });
  try {
    adapter.writeFileSync(temporary, JSON.stringify({ ...dataset, phrases: result.phrases }, null, 2) + '\n', 'utf8');
    adapter.renameSync(temporary, target);
  } catch (error) {
    try { adapter.unlinkSync(temporary); } catch (ignored) {}
    throw error;
  }
  return { ...dataset, phrases: result.phrases };
}
module.exports = { DATASET_PATH, DATASET_SCHEMA_VERSION, DEFAULT_EXPECTED_COUNT, DEFAULT_MAX_ENTRIES, DEFAULT_MIN_PER_MOOD, loadRailwayPhraseDataset, normalizePhraseText, validateRailwayPhraseDataset, writeRailwayPhraseDataset };
