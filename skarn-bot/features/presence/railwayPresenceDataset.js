const fs = require('fs');
const path = require('path');

const { MOOD_IDS } = require('./presenceContract');

const DATASET_SCHEMA_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 300;
const DEFAULT_MIN_PER_MOOD = 10;
const DATASET_PATH = path.join(__dirname, '../../data/railway-presence-phrases.json');

function normalizePhraseText(text) {
  return String(text).trim().replace(/\s+/g, ' ');
}

function validationResult(errors, counts, phrases) {
  return {
    ok: errors.length === 0,
    errors,
    counts,
    phrases,
  };
}

function validateRailwayPhraseDataset(input, options) {
  const config = options || {};
  const maxEntries = config.maxEntries === undefined ? DEFAULT_MAX_ENTRIES : config.maxEntries;
  const minPerMood = config.minPerMood === undefined ? DEFAULT_MIN_PER_MOOD : config.minPerMood;
  const errors = [];
  const counts = { total: 0 };
  MOOD_IDS.forEach(mood => { counts[mood] = 0; });
  const normalizedPhrases = [];
  const seenIds = new Set();
  const seenTexts = new Set();

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return validationResult(['dataset must be an object'], counts, normalizedPhrases);
  }
  if (input.schemaVersion !== DATASET_SCHEMA_VERSION) errors.push('unsupported schemaVersion');
  if (typeof input.generatedAt !== 'string' || !Number.isFinite(Date.parse(input.generatedAt))) {
    errors.push('generatedAt must be a valid date string');
  }
  if (!Array.isArray(input.phrases)) {
    return validationResult([...errors, 'phrases must be an array'], counts, normalizedPhrases);
  }
  if (input.phrases.length > maxEntries) errors.push('dataset exceeds maximum entry count');

  input.phrases.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push('phrase ' + index + ' must be an object');
      return;
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const text = typeof entry.text === 'string' ? normalizePhraseText(entry.text) : '';
    const mood = entry.mood;
    if (!id || id.length > 64 || !/^[a-z0-9][a-z0-9._-]*$/.test(id)) errors.push('phrase ' + index + ' has an invalid id');
    if (!text || text.length > 128 || /[\r\n]/.test(entry.text || '')) errors.push('phrase ' + index + ' must be a non-empty single line no longer than 128 characters');
    if (!MOOD_IDS.includes(mood)) errors.push('phrase ' + index + ' has an unsupported mood');
    const textKey = text.toLowerCase();
    const duplicateId = id && seenIds.has(id);
    const duplicateText = text && seenTexts.has(textKey);
    if (duplicateId) errors.push('duplicate phrase id: ' + id);
    if (duplicateText) errors.push('duplicate normalized phrase text: ' + text);
    if (id) seenIds.add(id);
    if (text) seenTexts.add(textKey);
    if (id && text && MOOD_IDS.includes(mood) && !duplicateId && !duplicateText) {
      normalizedPhrases.push({ id, text, mood });
      counts.total++;
      counts[mood]++;
    }
  });

  MOOD_IDS.forEach(mood => {
    if (counts[mood] < minPerMood) errors.push('mood ' + mood + ' requires at least ' + minPerMood + ' entries');
  });
  return validationResult(errors, counts, normalizedPhrases);
}

function loadRailwayPhraseDataset(filePath, fileSystem, options) {
  const target = filePath || DATASET_PATH;
  const adapter = fileSystem || fs;
  let parsed;
  try {
    parsed = JSON.parse(adapter.readFileSync(target, 'utf8'));
  } catch (error) {
    const readError = new Error('unable to read Railway phrase dataset: ' + error.message);
    readError.code = 'RAILWAY_DATASET_READ_FAILED';
    throw readError;
  }
  const result = validateRailwayPhraseDataset(parsed, options);
  if (!result.ok) {
    const validationError = new Error('invalid Railway phrase dataset: ' + result.errors.join('; '));
    validationError.code = 'INVALID_RAILWAY_DATASET';
    validationError.errors = result.errors;
    throw validationError;
  }
  return { ...parsed, phrases: result.phrases };
}

function writeRailwayPhraseDataset(filePath, dataset, fileSystem, options) {
  const target = filePath || DATASET_PATH;
  const adapter = fileSystem || fs;
  const result = validateRailwayPhraseDataset(dataset, options);
  if (!result.ok) throw new Error('invalid Railway phrase dataset: ' + result.errors.join('; '));
  const temporary = target + '.tmp-' + process.pid + '-' + Date.now();
  adapter.mkdirSync(path.dirname(target), { recursive: true });
  try {
    adapter.writeFileSync(temporary, JSON.stringify({ ...dataset, phrases: result.phrases }, null, 2) + '\n', 'utf8');
    adapter.renameSync(temporary, target);
  } catch (error) {
    try { adapter.unlinkSync(temporary); } catch (cleanupError) {}
    throw error;
  }
  return { ...dataset, phrases: result.phrases };
}

module.exports = {
  DATASET_PATH,
  DATASET_SCHEMA_VERSION,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MIN_PER_MOOD,
  loadRailwayPhraseDataset,
  normalizePhraseText,
  validateRailwayPhraseDataset,
  writeRailwayPhraseDataset,
};
