const fs = require('fs');
const path = require('path');

const {
  DATASET_PATH,
  normalizePhraseText,
  validateRailwayPhraseDataset,
  writeRailwayPhraseDataset,
} = require('../features/presence/railwayPresenceDataset');

const LEGACY_KEY = 'presence_phrases';
const REVIEW_PATH = path.join(__dirname, '../data/railway-presence-review.json');
const DEFAULT_DB_PATH = path.join(__dirname, '../data/skarn.db');

function parseLegacyPool(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (error) { throw new Error('legacy phrase pool is not valid JSON'); }
  }
  if (!Array.isArray(parsed)) throw new Error('legacy phrase pool must be an array');
  const seen = new Set();
  const phrases = [];
  parsed.forEach(value => {
    if (typeof value !== 'string') return;
    const text = normalizePhraseText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    phrases.push(text);
  });
  return phrases;
}

function buildReviewManifest(phrases, generatedAt) {
  return {
    schemaVersion: 1,
    sourceKey: LEGACY_KEY,
    generatedAt: generatedAt || new Date().toISOString(),
    phrases: phrases.map((text, index) => ({
      id: 'railway-legacy-' + String(index + 1).padStart(4, '0'),
      text,
      mood: null,
    })),
  };
}

function buildDatasetFromReview(review, options) {
  if (!review || typeof review !== 'object' || !Array.isArray(review.phrases)) {
    throw new Error('review manifest must contain a phrases array');
  }
  const phrases = review.phrases.map(entry => ({
    id: entry && entry.id,
    text: entry && entry.text,
    mood: entry && entry.mood,
  }));
  if (phrases.some(entry => !entry.mood)) throw new Error('every reviewed phrase must have a mood');
  const dataset = {
    schemaVersion: 1,
    generatedAt: review.generatedAt || new Date().toISOString(),
    phrases,
  };
  const result = validateRailwayPhraseDataset(dataset, options);
  if (!result.ok) throw new Error('reviewed Railway dataset is invalid: ' + result.errors.join('; '));
  return { ...dataset, phrases: result.phrases };
}

function writeReviewManifest(filePath, manifest, fileSystem) {
  const target = filePath || REVIEW_PATH;
  const adapter = fileSystem || fs;
  const temporary = target + '.tmp-' + process.pid + '-' + Date.now();
  adapter.mkdirSync(path.dirname(target), { recursive: true });
  try {
    adapter.writeFileSync(temporary, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    adapter.renameSync(temporary, target);
  } catch (error) {
    try { adapter.unlinkSync(temporary); } catch (cleanupError) {}
    throw error;
  }
  return target;
}

function readLegacyPoolFromDatabase(dbPath, databaseFactory) {
  const Database = databaseFactory || require('better-sqlite3');
  const database = new Database(dbPath || process.env.SKARN_DB_PATH || DEFAULT_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const row = database.prepare('SELECT value FROM app_state WHERE key = ?').get(LEGACY_KEY);
    if (!row) throw new Error('legacy presence pool was not found');
    return parseLegacyPool(row.value);
  } finally {
    database.close();
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const args = {};
  argv.forEach(arg => {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--export-review') args.exportReview = true;
    else if (arg.startsWith('--input=')) args.input = arg.slice('--input='.length);
    else if (arg.startsWith('--review=')) args.review = arg.slice('--review='.length);
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length);
    else if (arg.startsWith('--db=')) args.db = arg.slice('--db='.length);
  });
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const phrases = args.input
    ? parseLegacyPool(fs.readFileSync(args.input, 'utf8'))
    : readLegacyPoolFromDatabase(args.db);
  if (args.exportReview) {
    const reviewPath = writeReviewManifest(REVIEW_PATH, buildReviewManifest(phrases));
    console.log('[Presence migration] Exported ' + phrases.length + ' phrases for review to ' + reviewPath);
  }
  if (!args.apply) {
    console.log('[Presence migration] Dry run — no active dataset was changed');
    console.log('[Presence migration] Unique legacy phrases: ' + phrases.length);
    return;
  }
  if (!args.review) throw new Error('--apply requires --review=FILE');
  const dataset = buildDatasetFromReview(readJson(args.review));
  const outputPath = args.output || DATASET_PATH;
  writeRailwayPhraseDataset(outputPath, dataset);
  console.log('[Presence migration] Applied ' + dataset.phrases.length + ' reviewed phrases to ' + outputPath);
  console.log('[Presence migration] Legacy app_state key was not modified');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[Presence migration] ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildDatasetFromReview,
  buildReviewManifest,
  parseLegacyPool,
  readLegacyPoolFromDatabase,
  writeReviewManifest,
};
