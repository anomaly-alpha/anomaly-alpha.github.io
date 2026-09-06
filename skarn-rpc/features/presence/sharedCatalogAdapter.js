const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '../../../skarn-bot/presence-assets/presence-phrases.json');
const PALETTE_PATH = path.join(__dirname, '../../../skarn-bot/presence-assets/railway-symbol-palette.json');
const MOOD_IDS = Object.freeze(['dormant', 'observing', 'pondering', 'displeased']);
const FORBIDDEN = /user|guild|channel|message|prompt|search|memory|secret|deployment/i;
const ALLOWED_FIELDS = new Set(['id', 'text', 'mood', 'symbol', 'rpcDetails', 'rpcState', 'rpcIconKey']);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const FALLBACK_SYMBOLS = ['👁', '◈', '◇', '✦', '✧', '☾', '☼', '⚚', '⚙', '⌁', '⌘', '⟡', '☿', '♢', '♧', '⚑', '☍', '⚡', '✶', '✷', '✹', '❖', '⟁', '⟐'];

function normalizeText(value) {
  return String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function getSymbolPalette() {
  try {
    const palette = JSON.parse(fs.readFileSync(PALETTE_PATH, 'utf8'));
    if (Array.isArray(palette) && palette.length > 0) return new Set(palette);
  } catch (error) {}
  return new Set(FALLBACK_SYMBOLS);
}

function readJson(filePath, fileSystem) {
  const adapter = fileSystem || fs;
  return JSON.parse(adapter.readFileSync(filePath, 'utf8'));
}

function validateSharedCatalog(input, iconKeys) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['catalog must be an object'] };
  if (input.schemaVersion !== 1) errors.push('unsupported schemaVersion');
  if (typeof input.generatedAt !== 'string' || !Number.isFinite(Date.parse(input.generatedAt))) errors.push('generatedAt must be a valid date string');
  if (input.generatorVersion !== 'presence-generator-1') errors.push('invalid generatorVersion');
  if (!Array.isArray(input.phrases)) errors.push('phrases must be an array');
  if (Array.isArray(input.phrases) && input.phrases.length !== 5000) errors.push('catalog must contain exactly 5000 entries');
  const keys = iconKeys === undefined ? null : new Set(iconKeys);
  const symbols = getSymbolPalette();
  const ids = new Set();
  const texts = new Set();
  const counts = Object.fromEntries(MOOD_IDS.map(mood => [mood, 0]));
  (input.phrases || []).forEach((entry, index) => {
    const prefix = 'phrases[' + index + ']';
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(prefix + ' must be an object'); return; }
    if (Object.keys(entry).some(field => !ALLOWED_FIELDS.has(field))) errors.push(prefix + ' has an unknown field');
    for (const field of ['id', 'text', 'rpcDetails', 'rpcState', 'rpcIconKey']) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') errors.push(prefix + '.' + field + ' is required');
      else if (entry[field] !== normalizeText(entry[field]) || /\r|\n/.test(entry[field])) errors.push(prefix + '.' + field + ' must be normalized and one line');
    }
    if (typeof entry.id !== 'string' || entry.id.length > 64 || !ID_PATTERN.test(entry.id)) errors.push(prefix + '.id is invalid');
    if (!MOOD_IDS.includes(entry.mood)) errors.push(prefix + '.mood is invalid'); else counts[entry.mood]++;
    if (entry.symbol !== undefined && entry.symbol !== null && (typeof entry.symbol !== 'string' || !symbols.has(entry.symbol))) errors.push(prefix + '.symbol is invalid');
    if (typeof entry.text === 'string' && entry.text.length > 128) errors.push(prefix + '.text is too long');
    if (typeof entry.rpcDetails === 'string' && entry.rpcDetails.length > 128) errors.push(prefix + '.rpcDetails is too long');
    if (typeof entry.rpcState === 'string' && entry.rpcState.length > 128) errors.push(prefix + '.rpcState is too long');
    if (entry.symbol !== undefined && entry.symbol !== null && typeof entry.text === 'string' && (entry.symbol + ' ' + entry.text).length > 128) errors.push(prefix + ' activity text is too long');
    if (ids.has(entry.id)) errors.push(prefix + '.id is duplicated'); else if (typeof entry.id === 'string') ids.add(entry.id);
    const textKey = typeof entry.text === 'string' ? normalizeText(entry.text).toLowerCase() : '';
    if (texts.has(textKey)) errors.push(prefix + '.text is duplicated'); else if (textKey) texts.add(textKey);
    if (keys && typeof entry.rpcIconKey === 'string' && !keys.has(entry.rpcIconKey)) errors.push(prefix + '.rpcIconKey is unknown');
    if ([entry.text, entry.rpcDetails, entry.rpcState].some(value => typeof value === 'string' && FORBIDDEN.test(value))) errors.push(prefix + ' contains forbidden content');
  });
  MOOD_IDS.forEach(mood => { if (counts[mood] < 500) errors.push(mood + ' requires at least 500 entries'); });
  return { ok: errors.length === 0, errors, counts };
}

function loadSharedCatalog(filePath, iconRegistry, fileSystem) {
  const target = filePath || CATALOG_PATH;
  const icons = iconRegistry || [];
  let catalog;
  try { catalog = readJson(target, fileSystem); } catch (error) {
    const failure = new Error('unable to read shared presence catalog: ' + error.message);
    failure.code = 'SHARED_CATALOG_READ_FAILED';
    throw failure;
  }
  // Runtime validation tolerates artwork drift so one bad icon cannot discard all text.
  const validation = validateSharedCatalog(catalog);
  if (!validation.ok) {
    const failure = new Error('invalid shared presence catalog: ' + validation.errors.join('; '));
    failure.code = 'INVALID_SHARED_CATALOG';
    failure.errors = validation.errors;
    throw failure;
  }
  const iconsByKey = new Map(icons.map(icon => [icon.key, icon]));
  return catalog.phrases.map(entry => {
    const icon = iconsByKey.get(entry.rpcIconKey);
    if (!icon) return null;
    return { id: entry.id, key: entry.rpcIconKey, details: entry.rpcDetails, state: entry.rpcState, label: icon.label, mood: entry.mood };
  }).filter(Boolean);
}

module.exports = { CATALOG_PATH, loadSharedCatalog, validateSharedCatalog };
