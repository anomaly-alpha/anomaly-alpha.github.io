const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '../../../skarn-bot/presence-assets/presence-phrases.json');
const PALETTE_PATH = path.join(__dirname, '../../../skarn-bot/presence-assets/railway-symbol-palette.json');
const MOOD_IDS = Object.freeze(['dormant', 'observing', 'pondering', 'displeased']);
const FORBIDDEN = /user|guild|channel|message|prompt|search|memory|secret|deployment/i;
const ALLOWED_FIELDS = new Set(['id', 'text', 'mood', 'symbol', 'rpcDetails', 'rpcState', 'rpcIconKey']);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const ICON_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_ID_BYTES = 64;
const MAX_ICON_KEY_BYTES = 32;
const MAX_TEXT_BYTES = 128;
const MAX_TOOLTIP_BYTES = 128;
const FALLBACK_SYMBOLS = ['👁', '◈', '◇', '✦', '✧', '☾', '☼', '⚚', '⚙', '⌁', '⌘', '⟡', '☿', '♢', '♧', '⚑', '☍', '⚡', '✶', '✷', '✹', '❖', '⟁', '⟐'];

function normalizeText(value) {
  return String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function isNormalizedOneLine(value) {
  return typeof value === 'string' && value === normalizeText(value) && !/[\r\n]/.test(value);
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

function toIconKeySet(iconKeys) {
  if (iconKeys === undefined || iconKeys === null) return null;
  const values = iconKeys instanceof Set ? [...iconKeys] : iconKeys;
  if (!Array.isArray(values)) return new Set();
  return new Set(values.map(icon => typeof icon === 'string' ? icon : icon && icon.key).filter(Boolean));
}

function validateIconRegistry(iconRegistry) {
  const errors = [];
  if (!Array.isArray(iconRegistry)) return { ok: false, errors: ['icon registry must be an array'] };
  const keys = new Set();
  iconRegistry.forEach((icon, index) => {
    const prefix = 'icons[' + index + ']';
    if (!icon || typeof icon !== 'object' || Array.isArray(icon)) {
      errors.push(prefix + ' must be an object');
      return;
    }
    if (!isNormalizedOneLine(icon.key) || !ICON_KEY_PATTERN.test(icon.key) || utf8Bytes(icon.key) > MAX_ICON_KEY_BYTES) {
      errors.push(prefix + '.key is invalid or exceeds ' + MAX_ICON_KEY_BYTES + ' UTF-8 bytes');
    }
    if (!isNormalizedOneLine(icon.label) || utf8Bytes(icon.label) === 0 || utf8Bytes(icon.label) > MAX_TOOLTIP_BYTES) {
      errors.push(prefix + '.label is invalid or exceeds ' + MAX_TOOLTIP_BYTES + ' UTF-8 bytes');
    }
    if (typeof icon.key === 'string') {
      if (keys.has(icon.key)) errors.push(prefix + '.key is duplicated');
      keys.add(icon.key);
    }
  });
  return { ok: errors.length === 0, errors };
}

function validateSharedCatalog(input, iconKeys, options) {
  const errors = [];
  const settings = options || {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['catalog must be an object'] };
  if (input.schemaVersion !== 1) errors.push('unsupported schemaVersion');
  if (typeof input.generatedAt !== 'string' || !Number.isFinite(Date.parse(input.generatedAt))) errors.push('generatedAt must be a valid date string');
  if (input.generatorVersion !== 'presence-generator-1') errors.push('invalid generatorVersion');
  if (!Array.isArray(input.phrases)) errors.push('phrases must be an array');
  if (settings.strictCount !== false && Array.isArray(input.phrases) && input.phrases.length !== 5000) errors.push('catalog must contain exactly 5000 entries');
  const keys = toIconKeySet(iconKeys);
  const symbols = getSymbolPalette();
  const ids = new Set();
  const texts = new Set();
  const counts = Object.fromEntries(MOOD_IDS.map(mood => [mood, 0]));
  let unknownIconCount = 0;
  (input.phrases || []).forEach((entry, index) => {
    const prefix = 'phrases[' + index + ']';
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(prefix + ' must be an object'); return; }
    if (Object.keys(entry).some(field => !ALLOWED_FIELDS.has(field))) errors.push(prefix + ' has an unknown field');
    for (const field of ['id', 'text', 'rpcDetails', 'rpcState', 'rpcIconKey']) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') errors.push(prefix + '.' + field + ' is required');
      else if (!isNormalizedOneLine(entry[field])) errors.push(prefix + '.' + field + ' must be normalized and one line');
    }
    if (typeof entry.id !== 'string' || utf8Bytes(entry.id) > MAX_ID_BYTES || !ID_PATTERN.test(entry.id)) errors.push(prefix + '.id is invalid or exceeds ' + MAX_ID_BYTES + ' UTF-8 bytes');
    if (!MOOD_IDS.includes(entry.mood)) errors.push(prefix + '.mood is invalid'); else counts[entry.mood]++;
    if (entry.symbol !== undefined && entry.symbol !== null && (typeof entry.symbol !== 'string' || !symbols.has(entry.symbol))) errors.push(prefix + '.symbol is invalid');
    if (typeof entry.text === 'string' && utf8Bytes(entry.text) > MAX_TEXT_BYTES) errors.push(prefix + '.text exceeds ' + MAX_TEXT_BYTES + ' UTF-8 bytes');
    if (typeof entry.rpcDetails === 'string' && utf8Bytes(entry.rpcDetails) > MAX_TEXT_BYTES) errors.push(prefix + '.rpcDetails exceeds ' + MAX_TEXT_BYTES + ' UTF-8 bytes');
    if (typeof entry.rpcState === 'string' && utf8Bytes(entry.rpcState) > MAX_TEXT_BYTES) errors.push(prefix + '.rpcState exceeds ' + MAX_TEXT_BYTES + ' UTF-8 bytes');
    if (typeof entry.rpcIconKey === 'string' && utf8Bytes(entry.rpcIconKey) > MAX_ICON_KEY_BYTES) errors.push(prefix + '.rpcIconKey exceeds ' + MAX_ICON_KEY_BYTES + ' UTF-8 bytes');
    if (entry.symbol !== undefined && entry.symbol !== null && typeof entry.text === 'string' && utf8Bytes(entry.symbol + ' ' + entry.text) > MAX_TEXT_BYTES) errors.push(prefix + ' activity text exceeds ' + MAX_TEXT_BYTES + ' UTF-8 bytes');
    if (ids.has(entry.id)) errors.push(prefix + '.id is duplicated'); else if (typeof entry.id === 'string') ids.add(entry.id);
    const textKey = typeof entry.text === 'string' ? normalizeText(entry.text).toLowerCase() : '';
    if (texts.has(textKey)) errors.push(prefix + '.text is duplicated'); else if (textKey) texts.add(textKey);
    if (keys && typeof entry.rpcIconKey === 'string' && !keys.has(entry.rpcIconKey)) {
      unknownIconCount++;
      errors.push(prefix + '.rpcIconKey is unknown');
    }
    if ([entry.text, entry.rpcDetails, entry.rpcState].some(value => typeof value === 'string' && FORBIDDEN.test(value))) errors.push(prefix + ' contains forbidden content');
  });
  if (settings.strictMoodCounts !== false) MOOD_IDS.forEach(mood => { if (counts[mood] < 500) errors.push(mood + ' requires at least 500 entries'); });
  return { ok: errors.length === 0, errors, counts, unknownIconCount };
}

function isOnlyUnknownIconErrors(errors) {
  return errors.length > 0 && errors.every(error => /\.rpcIconKey is unknown$/.test(error));
}

function loadSharedCatalog(filePath, iconRegistry, fileSystem) {
  const target = filePath || CATALOG_PATH;
  const icons = Array.isArray(iconRegistry) ? iconRegistry : [];
  let catalog;
  try { catalog = readJson(target, fileSystem); } catch (error) {
    const failure = new Error('unable to read shared presence catalog: ' + error.message);
    failure.code = 'SHARED_CATALOG_READ_FAILED';
    throw failure;
  }
  const iconValidation = validateIconRegistry(icons);
  if (!iconValidation.ok) {
    const failure = new Error('invalid local icon registry: ' + iconValidation.errors.join('; '));
    failure.code = 'INVALID_ICON_REGISTRY';
    failure.errors = iconValidation.errors;
    throw failure;
  }
  // Runtime checks intentionally relax only build cardinality; every emitted entry remains strict.
  const validation = validateSharedCatalog(catalog, icons.map(icon => icon.key), { strictCount: false, strictMoodCounts: false });
  if (!validation.ok && !isOnlyUnknownIconErrors(validation.errors)) {
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

module.exports = {
  CATALOG_PATH,
  MAX_ID_BYTES,
  MAX_ICON_KEY_BYTES,
  MAX_TEXT_BYTES,
  MAX_TOOLTIP_BYTES,
  loadSharedCatalog,
  validateIconRegistry,
  validateSharedCatalog,
};
