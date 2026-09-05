require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_FILE = path.join(DATA_DIR, 'backups', 'rpc-phrases-pre-prune-2026-09-04.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'icon-registry.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'rpc-phrase-moods.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'rpc-phrase-moods.progress.json');
const MODEL = process.env.RPC_MOOD_MODEL || 'gpt-4.1-mini';
const BATCH_SIZE = parseInt(process.env.RPC_MOOD_BATCH_SIZE, 10) || 100;
const MAX_RETRIES = 3;
const MOODS = ['dormant', 'observing', 'pondering', 'displeased'];

const ASSET_ALIASES = Object.freeze({
  skarn_alignment_center: 'skarn_align_center',
  skarn_dollars: 'skarn_dollar',
  skarn_expclamation_mark: 'skarn_exclamation_mark',
  skarn_headbeat: 'skarn_heartbeat',
  skarn_mail: 'skarn_email',
  skarn_move: 'skarn_motion',
  skarn_smile: 'skarn_face',
  skarn_stop: 'skarn_pause',
});

const PHRASE_REWRITES = Object.freeze({
  'skarn_power|strength borrowed, never owned|will bends but does not break': {
    details: 'strength borrowed, never owned',
    state: 'Will bends, never breaks',
  },
  'skarn_close|Closed chapter on lost ages|New ones open with equal folly': {
    details: 'Closed chapter on lost ages',
    state: 'New ones open; folly repeats',
  },
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeEntries(source, registry) {
  const seen = new Set();
  const entries = [];
  for (const entry of source.pool || []) {
    if (!entry || !entry.key || !entry.details || !entry.state) continue;
    const key = ASSET_ALIASES[entry.key] || entry.key;
    if (!registry.has(key)) continue;
    const originalDetails = String(entry.details);
    const originalState = String(entry.state);
    const rewrite = PHRASE_REWRITES[key + '|' + originalDetails + '|' + originalState];
    const details = rewrite ? rewrite.details : originalDetails.slice(0, 60);
    const state = rewrite ? rewrite.state : originalState.slice(0, 60);
    const signature = (details + '|' + state).toLowerCase();
    if (seen.has(signature)) continue;
    seen.add(signature);
    entries.push({ key, details, state });
  }
  return entries;
}

function sourceDigest(entries) {
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

function loadProgress(digest, count) {
  try {
    const progress = readJson(PROGRESS_FILE);
    if (progress.sourceDigest === digest && progress.count === count && progress.labels) return progress.labels;
  } catch (e) {}
  return {};
}

function saveProgress(digest, count, labels) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    sourceDigest: digest,
    count,
    model: MODEL,
    batchSize: BATCH_SIZE,
    labels,
    updatedAt: new Date().toISOString(),
  }, null, 2));
}

function parseLabels(text, batch) {
  const fence = String.fromCharCode(96).repeat(3);
  const cleaned = text.replace(new RegExp('^' + fence + '(?:json)?\\s*', 'i'), '').replace(new RegExp('\\s*' + fence + '$', 'i'), '').trim();
  const parsed = JSON.parse(cleaned);
  const rows = Array.isArray(parsed) ? parsed : parsed.labels;
  if (!Array.isArray(rows)) throw new Error('Model response did not contain a labels array');

  const labels = {};
  for (const row of rows) {
    const id = Number(row.id);
    const mood = String(row.mood || '').toLowerCase();
    if (!Number.isInteger(id) || !MOODS.includes(mood)) continue;
    labels[id] = mood;
  }
  for (const entry of batch) {
    if (!labels[entry.id]) throw new Error('Missing or invalid label for phrase ' + entry.id);
  }
  return labels;
}

function classifyBatch(batch) {
  const prompt = [
    'Classify each Skarn Rich Presence phrase pair into exactly one mood.',
    '',
    'Mood definitions:',
    '- dormant: sleep, silence, rest, stillness, withdrawal, night, or low energy.',
    '- observing: watchful, analytical, neutral, amused, practical, or emotionally ambiguous.',
    '- pondering: philosophical, existential, reflective, uncertain, or focused on time and meaning.',
    '- displeased: irritated, contemptuous, threatening, rejecting, ominous, or frustrated.',
    '',
    'Use observing when the pair is ambiguous. Judge the text, not the asset key. Do not rewrite the phrases.',
    'Return only JSON in this shape: {"labels":[{"id":0,"mood":"observing"}]}',
    '',
    'Phrase pairs:',
    JSON.stringify(batch),
  ].join('\\n');
  const body = JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: Math.max(2000, batch.length * 18),
    response_format: { type: 'json_object' },
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('OpenAI returned HTTP ' + res.statusCode));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content || '';
          resolve(parseLabels(text, batch));
        } catch (e) {
          reject(new Error('Invalid classification response: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('classification request timed out')));
    req.write(body);
    req.end();
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function classifyWithRetry(batch, batchNumber, totalBatches) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await classifyBatch(batch);
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      console.warn('Batch ' + batchNumber + '/' + totalBatches + ' failed (' + e.message + '); retrying');
      await wait(attempt * 2000);
    }
  }
  throw new Error('Unreachable classification state');
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  if (!fs.existsSync(SOURCE_FILE)) throw new Error('Full pre-prune source not found: ' + SOURCE_FILE);

  const source = readJson(SOURCE_FILE);
  const registry = new Set(readJson(REGISTRY_FILE).map(icon => icon.key));
  const entries = normalizeEntries(source, registry);
  const digest = sourceDigest(entries);
  const labels = loadProgress(digest, entries.length);
  const pending = entries.map((entry, id) => ({ id, ...entry })).filter(entry => !labels[entry.id]);
  const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

  console.log('Classifying ' + entries.length + ' phrases with ' + MODEL + ' in ' + totalBatches + ' batches');
  console.log('Already complete: ' + (entries.length - pending.length) + '; pending: ' + pending.length);

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
    const result = await classifyWithRetry(batch, batchNumber, totalBatches);
    Object.assign(labels, result);
    saveProgress(digest, entries.length, labels);
    console.log('Completed batch ' + batchNumber + '/' + totalBatches + ' (' + Object.keys(labels).length + '/' + entries.length + ')');
  }

  const phrases = entries.map((entry, id) => ({ ...entry, mood: labels[id] }));
  const counts = phrases.reduce((result, entry) => {
    result[entry.mood] = (result[entry.mood] || 0) + 1;
    return result;
  }, {});
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    version: 1,
    source: path.relative(path.join(__dirname, '..'), SOURCE_FILE),
    sourceDigest: digest,
    model: MODEL,
    count: phrases.length,
    classifiedAt: new Date().toISOString(),
    moods: counts,
    phrases,
  }, null, 2));
  console.log('Wrote ' + OUTPUT_FILE);
  console.log('Mood counts: ' + JSON.stringify(counts));
}

if (require.main === module) {
  main().catch(error => {
    console.error('Classification failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { normalizeEntries, sourceDigest, readJson };
