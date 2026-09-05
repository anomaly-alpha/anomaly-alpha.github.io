require('dotenv').config();
const RPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');
const https = require('https');

const clientId = '982308134871765022';
const RETRY_MS = 15000;
const ROTATE_MS = 10 * 1000;            // 10 seconds
const REGEN_MS = 12 * 60 * 60 * 1000;   // 12 hours
const REGEN_BATCH = 50;                 // phrases to generate per regen
const ACTIVE_POOL_LIMIT = 500;
const ARCHIVE_LIMIT = 2000;
const MOOD_DWELL_MS = 10 * 60 * 1000;
const MOOD_IDS = new Set(['dormant', 'observing', 'pondering', 'displeased']);
const LOG_FILE = path.join(__dirname, 'data', 'rpc.log');
const PHRASE_CACHE = path.join(__dirname, 'data', 'rpc-phrases.json');
const MOOD_CLASSIFICATION = path.join(__dirname, 'data', 'rpc-phrase-moods.json');

let retryTimer = null;
let rotateTimer = null;
let regenTimer = null;
let rotationPool = [];  // [{ key, details, state }, ...]
let lastIndex = -1;
let activeRpc = null;
let phraseMoodMap = new Map();
let currentMood = null;
let moodUntil = 0;

// ── Icon registry ────────────────────────────────────────
// Loaded from data/icon-registry.json — add/remove icons there.

const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'icon-registry.json'), 'utf8'));
const ICONS_BY_KEY = new Map(ICONS.map(icon => [icon.key, icon]));
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
let archivedEntries = [];

// ── Asset and phrase normalization ────────────────────────

function entrySignature(entry) {
  return entry.key + '|' + entry.details + '|' + entry.state;
}

function addToArchive(entries, reason) {
  const seen = new Set(archivedEntries.map(entrySignature));
  (entries || []).forEach(entry => {
    if (!entry || !entry.key || !entry.details || !entry.state) return;
    const archived = {
      key: String(entry.key),
      details: String(entry.details).slice(0, 60),
      state: String(entry.state).slice(0, 60),
      reason: reason || entry.reason || 'unsupported-asset',
    };
    const signature = entrySignature(archived);
    if (seen.has(signature)) return;
    archivedEntries.push(archived);
    seen.add(signature);
  });
}

function normalizeEntry(entry) {
  if (!entry || !entry.key || !entry.details || !entry.state) return null;
  const key = ASSET_ALIASES[entry.key] || entry.key;
  const icon = ICONS_BY_KEY.get(key);
  if (!icon) return null;
  const original = {
    key: entry.key,
    details: String(entry.details),
    state: String(entry.state),
  };
  const rewrite = PHRASE_REWRITES[key + '|' + original.details + '|' + original.state];
  const details = rewrite ? rewrite.details : original.details.slice(0, 60);
  const state = rewrite ? rewrite.state : original.state.slice(0, 60);
  const mood = MOOD_IDS.has(entry.mood) ? entry.mood : phraseMoodMap.get(entrySignature({ key, details, state })) || phraseMoodMap.get(entrySignature(original)) || 'observing';
  return {
    key,
    details,
    state,
    label: icon.label,
    mood,
  };
}

function normalizeEntries(entries) {
  const active = [];
  const unsupported = [];
  const duplicates = [];
  const seen = new Set();
  (entries || []).forEach(entry => {
    const normalized = normalizeEntry(entry);
    if (!normalized) {
      unsupported.push(entry);
      return;
    }
    const signature = (normalized.details + '|' + normalized.state).toLowerCase();
    if (seen.has(signature)) {
      duplicates.push(entry);
      return;
    }
    seen.add(signature);
    active.push(normalized);
  });
  return { active, unsupported, duplicates };
}

function capActivePool(entries) {
  if (entries.length <= ACTIVE_POOL_LIMIT) return { active: entries, pruned: [] };
  return {
    active: entries.slice(-ACTIVE_POOL_LIMIT),
    pruned: entries.slice(0, -ACTIVE_POOL_LIMIT),
  };
}

function capArchive() {
  if (archivedEntries.length <= ARCHIVE_LIMIT) return;
  const protectedEntries = archivedEntries.filter(entry => entry.reason === 'unsupported-asset' || entry.reason === 'duplicate');
  const otherEntries = archivedEntries.filter(entry => entry.reason !== 'unsupported-asset' && entry.reason !== 'duplicate');
  const remaining = Math.max(0, ARCHIVE_LIMIT - protectedEntries.length);
  archivedEntries = [...protectedEntries.slice(0, ARCHIVE_LIMIT), ...otherEntries.slice(-remaining)];
}

function loadMoodClassification() {
  try {
    const data = JSON.parse(fs.readFileSync(MOOD_CLASSIFICATION, 'utf8'));
    const map = new Map();
    (data.phrases || []).forEach(entry => {
      if (!entry || !MOOD_IDS.has(entry.mood)) return;
      map.set(entrySignature(entry), entry.mood);
    });
    phraseMoodMap = map;
    log('Loaded ' + map.size + ' phrase mood classifications');
  } catch (e) {
    phraseMoodMap = new Map();
  }
}

// ── Logging ──────────────────────────────────────────────

function log(line) {
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, '[' + new Date().toISOString() + '] ' + line + '\n'); } catch (e) {}
}

// ── State detection (standalone) ─────────────────────────

function getState() {
  const hour = new Date().getUTCHours();
  const localHour = (hour + Math.floor(-new Date().getTimezoneOffset() / 60) + 24) % 24;

  if (localHour >= 1 && localHour < 7) {
    return { id: 'dormant', detail: 'Dormant', dwellMs: MOOD_DWELL_MS };
  }

  const roll = Math.random();
  if (roll < 0.05) return { id: 'displeased', detail: 'Displeased', dwellMs: MOOD_DWELL_MS };
  if (roll < 0.15) return { id: 'pondering', detail: 'Pondering', dwellMs: MOOD_DWELL_MS };
  return { id: 'observing', detail: 'Observing', dwellMs: MOOD_DWELL_MS };
}

function getCurrentMood() {
  const now = Date.now();
  const state = getState();
  if (state.id !== 'dormant' && currentMood && currentMood.id !== 'dormant' && now < moodUntil) return currentMood;
  if (currentMood?.id !== state.id) log('Mood: ' + state.id);
  currentMood = state;
  moodUntil = now + state.dwellMs;
  return currentMood;
}

// ── Phrase generation via OpenAI ──────────────────────────

function generateBatch(existing) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log('No OPENAI_API_KEY — using cache only');
      return resolve(existing.length > 0 ? existing : buildFallback());
    }

    // Pick random icons for this batch
    const shuffled = [...ICONS].sort(() => Math.random() - 0.5);
    const batchIcons = shuffled.slice(0, Math.min(REGEN_BATCH, ICONS.length));
    const iconList = batchIcons.map(i => `- ${i.key}: ${i.theme}`).join('\n');

    const prompt = `You are Skarn, a 10,000-year-old retired demon who serves as a Discord bot. Your voice is dry, wise, and quietly amused by mortals.

Generate ${REGEN_BATCH} short inner-monologue LINE PAIRS. Each pair has two lines:
- "details": the primary thought (max 5 words, punchy)
- "state": a secondary thought or follow-up (max 5 words, complementary)
- "mood": exactly one of "dormant", "observing", "pondering", or "displeased"

SHORT is everything. Every word must earn its place.

Rules:
- Dry humor, quiet observation, ancient perspective
- Never use the words "Skarn" or "I" — third-person inner thoughts
- The two lines complement each other, not repeat
- Mood describes the emotional atmosphere of the pair, not the icon itself
- Vary the tone: menacing, weary, amused, warm, philosophical
- MAX 5 WORDS per line. No exceptions.

Icons and their themes:
${iconList}

Output a flat JSON array of objects. Each object has "key", "details", "state", and "mood". No grouping by icon — just flat pairs.
[{"key":"skarn_at","details":"Summoned again","state":"Patience thins","mood":"displeased"}, ...]

No markdown, no text outside the JSON. ${REGEN_BATCH} entries minimum.`;

    const body = JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.0,
      max_tokens: 8000,
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content || '';
          const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
          const raw = JSON.parse(cleaned);
          const arr = Array.isArray(raw) ? raw : raw.icons || raw.pool || Object.values(raw).find(v => Array.isArray(v)) || [];

          const newEntries = arr
            .filter(e => e.key && e.details && e.state)
            .map(e => ({ key: e.key, details: String(e.details).slice(0, 60), state: String(e.state).slice(0, 60), mood: MOOD_IDS.has(e.mood) ? e.mood : '' }));

          const normalized = [];
          const unsupported = [];
          newEntries.forEach(entry => {
            const normalizedEntry = normalizeEntry(entry);
            if (normalizedEntry) normalized.push(normalizedEntry);
            else unsupported.push(entry);
          });
          addToArchive(unsupported);

          const existingSet = new Set(existing.map(e => (e.details + '|' + e.state).toLowerCase()));
          const unique = normalized.filter(e => {
            const signature = (e.details + '|' + e.state).toLowerCase();
            if (existingSet.has(signature)) return false;
            existingSet.add(signature);
            return true;
          });

          const merged = [...existing, ...unique];
          const capped = capActivePool(merged);
          addToArchive(capped.pruned, 'pool-overflow');
          capArchive();
          log('Generated ' + newEntries.length + ' new, ' + unique.length + ' unique, ' + unsupported.length + ' archived, active: ' + capped.active.length);
          saveCache(capped.active);
          resolve(capped.active);
        } catch (e) {
          log('Parse error: ' + e.message);
          resolve(existing.length > 0 ? existing : buildFallback());
        }
      });
    });

    req.on('error', (e) => {
      log('API error: ' + e.message);
      resolve(existing.length > 0 ? existing : buildFallback());
    });

    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function initialGenerate() {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const existing = loadCache();

    if (!apiKey) {
      log('No OPENAI_API_KEY — using cache');
      return resolve(existing || buildFallback());
    }

    if (existing && existing.length > 0) {
      log('Cache has ' + existing.length + ' active phrases, skipping startup generation');
      resolve(existing);
      return;
    }

    // First run or small cache — generate a large initial batch
    const iconList = ICONS.map(i => `- ${i.key}: ${i.theme}`).join('\n');
    const prompt = `You are Skarn, a 10,000-year-old retired demon who serves as a Discord bot. Your voice is dry, wise, and quietly amused by mortals.

Generate 200 short inner-monologue LINE PAIRS. Each pair has two lines:
- "details": the primary thought (max 5 words, punchy)
- "state": a secondary thought or follow-up (max 5 words, complementary)
- "mood": exactly one of "dormant", "observing", "pondering", or "displeased"

SHORT is everything. Every word must earn its place.

Rules:
- Dry humor, quiet observation, ancient perspective
- Never use the words "Skarn" or "I" — third-person inner thoughts
- The two lines complement each other, not repeat
- Mood describes the emotional atmosphere of the pair, not the icon itself
- Vary the tone: menacing, weary, amused, warm, philosophical, threatening
- MAX 5 WORDS per line. No exceptions.

Icons and their themes:
${iconList}

Output a flat JSON array of objects. Each object has "key", "details", "state", and "mood".
[{"key":"skarn_at","details":"Summoned again","state":"Patience thins","mood":"displeased"}, ...]

No markdown, no text outside the JSON. 200 entries minimum.`;

    const body = JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.0,
      max_tokens: 16000,
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content || '';
          const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
          const raw = JSON.parse(cleaned);
          const arr = Array.isArray(raw) ? raw : raw.icons || raw.pool || Object.values(raw).find(v => Array.isArray(v)) || [];

          const newEntries = arr
            .filter(e => e.key && e.details && e.state)
            .map(e => ({ key: e.key, details: String(e.details).slice(0, 60), state: String(e.state).slice(0, 60), mood: MOOD_IDS.has(e.mood) ? e.mood : '' }));

          const normalized = [];
          const unsupported = [];
          newEntries.forEach(entry => {
            const normalizedEntry = normalizeEntry(entry);
            if (normalizedEntry) normalized.push(normalizedEntry);
            else unsupported.push(entry);
          });
          addToArchive(unsupported);

          const existingSet = existing ? new Set(existing.map(e => (e.details + '|' + e.state).toLowerCase())) : new Set();
          const unique = normalized.filter(e => {
            const signature = (e.details + '|' + e.state).toLowerCase();
            if (existingSet.has(signature)) return false;
            existingSet.add(signature);
            return true;
          });
          const merged = existing ? [...existing, ...unique] : unique;
          const capped = capActivePool(merged);
          addToArchive(capped.pruned, 'pool-overflow');
          capArchive();

          log('Initial generation: ' + unique.length + ' unique phrases, ' + unsupported.length + ' archived, active: ' + capped.active.length);
          saveCache(capped.active);
          resolve(capped.active);
        } catch (e) {
          log('Parse error: ' + e.message);
          resolve(existing || buildFallback());
        }
      });
    });

    req.on('error', (e) => {
      log('API error: ' + e.message);
      resolve(existing || buildFallback());
    });

    req.setTimeout(90000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Phrase cache ──────────────────────────────────────────

function loadCache() {
  archivedEntries = [];
  loadMoodClassification();
  try {
    const data = JSON.parse(fs.readFileSync(PHRASE_CACHE, 'utf8'));
    let pool = data.pool;
    let migratedLegacy = false;
    if (Array.isArray(pool) && pool[0]?.lines) {
      const flat = [];
      pool.forEach(entry => {
        (entry.lines || []).forEach(line => {
          if (line.details && line.state) flat.push({ key: entry.key, details: line.details, state: line.state });
        });
      });
      pool = flat;
      migratedLegacy = true;
      log('Migrated ' + pool.length + ' phrases from legacy format');
    }
    if (!Array.isArray(pool) || pool.length === 0) return null;

    addToArchive(Array.isArray(data.archive) ? data.archive : []);
    const normalized = normalizeEntries(pool);
    addToArchive(normalized.unsupported);
    addToArchive(normalized.duplicates, 'duplicate');
    const capped = capActivePool(normalized.active);
    addToArchive(capped.pruned, 'pool-overflow');
    capArchive();

    const aliasesChanged = pool.some(entry => {
      const normalizedEntry = normalizeEntry(entry);
      return normalizedEntry && (normalizedEntry.key !== entry.key || normalizedEntry.details !== entry.details || normalizedEntry.state !== entry.state);
    });
    const needsMigration = migratedLegacy || aliasesChanged || normalized.unsupported.length > 0 || normalized.duplicates.length > 0 || capped.pruned.length > 0 || !Array.isArray(data.archive);
    if (needsMigration) saveCache(capped.active);

    log('Loaded ' + capped.active.length + ' active phrases; archived ' + archivedEntries.length + ' inactive phrases');
    return capped.active.length > 0 ? capped.active : null;
  } catch (e) {}
  return null;
}

function saveCache(entries) {
  try {
    capArchive();
    fs.writeFileSync(PHRASE_CACHE, JSON.stringify({
      pool: entries,
      archive: archivedEntries,
      count: entries.length,
      archivedCount: archivedEntries.length,
      generatedAt: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    log('Failed to cache: ' + e.message);
  }
}

function buildFallback() {
  return normalizeEntries([
    { key: 'skarn_eye', details: 'Watching from the shadows', state: 'Silent judgment' },
    { key: 'skarn_sleep', details: 'Pretending to be asleep', state: 'Mortals pass by' },
    { key: 'skarn_dislike', details: 'Another futile request', state: 'Patience wears thin' },
  ]).active;
}

// ── Activity builder ─────────────────────────────────────

function buildActivity() {
  const mood = getCurrentMood();
  const moodEntries = rotationPool.filter(entry => entry.mood === mood.id);
  const candidates = moodEntries.length > 0 ? moodEntries : rotationPool;
  let idx;
  do {
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    idx = rotationPool.indexOf(candidate);
  } while (idx === lastIndex && candidates.length > 1);
  lastIndex = idx;

  const entry = rotationPool[idx];

  return {
    details: entry.details,
    state: entry.state,
    largeImageKey: 'skarn_logo',
    largeImageText: 'Skarn Bot',
    smallImageKey: entry.key,
    smallImageText: entry.label,
    instance: false,
    type: 0,
    startTimestamp: 1000,
  };
}

// ── Rotation ─────────────────────────────────────────────

function startRotation(rpc) {
  if (rotateTimer) clearInterval(rotateTimer);
  rotateTimer = setInterval(() => {
    try {
      const activity = buildActivity();
      rpc.setActivity(activity);
      log('Rotated: ' + activity.smallImageKey + ' — ' + activity.details + ' / ' + activity.state);
    } catch (e) {
      log('Rotation error: ' + e.message);
    }
  }, ROTATE_MS);
}

// ── Regeneration ─────────────────────────────────────────

function scheduleRegen() {
  if (regenTimer) clearTimeout(regenTimer);
  regenTimer = setTimeout(async () => {
    log('Appending new phrases to pool...');
    rotationPool = await generateBatch(rotationPool);
    lastIndex = -1;
    scheduleRegen();
  }, REGEN_MS);
}

// ── Connection ───────────────────────────────────────────

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(function () { retryTimer = null; connect(); }, RETRY_MS);
}

async function connect() {
  if (rotationPool.length === 0) {
    rotationPool = await initialGenerate();
  }

  const rpc = new RPC.Client({ transport: 'ipc' });

  rpc.on('ready', () => {
    log('Rich Presence connected!');
    activeRpc = rpc;

    rpc.setActivity(buildActivity());
    startRotation(rpc);
    scheduleRegen();

    log('Rotation: every ' + (ROTATE_MS / 1000) + 's | Phrases: ' + rotationPool.length + ' | Regen: +' + REGEN_BATCH + ' every ' + (REGEN_MS / 3600000) + 'h');
  });

  rpc.on('error', (err) => log('Error: ' + err.message));
  rpc.on('disconnected', () => {
    log('Disconnected — retrying in ' + RETRY_MS / 1000 + 's');
    activeRpc = null;
    if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    scheduleRetry();
  });

  rpc.login({ clientId }).catch((err) => {
    log('Failed to connect: ' + err.message);
    log('Retrying in ' + RETRY_MS / 1000 + 's (is Discord running?)');
    scheduleRetry();
  });
}

// ── Start ────────────────────────────────────────────────

log('Skarn RPC starting...');
connect();
