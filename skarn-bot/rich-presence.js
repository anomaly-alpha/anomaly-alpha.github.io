require('dotenv').config();
const RPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');
const https = require('https');

const clientId = '982308134871765022';
const RETRY_MS = 15000;
const ROTATE_MS = 10 * 1000;            // 10 seconds
const REGEN_MS = 5 * 60 * 60 * 1000;   // 5 hours
const REGEN_BATCH = 50;                 // phrases to generate per regen
const LOG_FILE = path.join(__dirname, 'data', 'rpc.log');
const PHRASE_CACHE = path.join(__dirname, 'data', 'rpc-phrases.json');

let retryTimer = null;
let rotateTimer = null;
let regenTimer = null;
let rotationPool = [];  // [{ key, details, state }, ...]
let lastIndex = -1;
let activeRpc = null;

// ── Icon registry ────────────────────────────────────────
// Each icon maps to a Discord asset key (upload name in Developer Portal)
// and a theme string that drives phrase generation.

const ICONS = [
  { key: 'skarn_annoyed',    label: 'Annoyed',         theme: 'irritation, displeasure, barely tolerating mortals' },
  { key: 'skarn_at',         label: 'Tagged',           theme: 'being mentioned or called upon' },
  { key: 'skarn_awake',      label: 'Awake',            theme: 'being awake and alert, watching' },
  { key: 'skarn_comment',    label: 'Commenting',       theme: 'observing conversations, judging comments' },
  { key: 'skarn_crown',      label: 'Royal',            theme: 'authority, power, ancient royalty' },
  { key: 'skarn_dollar',     label: 'Transactions',     theme: 'money, transactions, mortal greed' },
  { key: 'skarn_food',       label: 'Sustenance',       theme: 'eating, drinking, mortal sustenance' },
  { key: 'skarn_heart',      label: 'Affection',        theme: 'rare warmth, soft feelings, kindness' },
  { key: 'skarn_hypnosis',   label: 'Mesmerized',       theme: 'trance, hypnosis, mind control' },
  { key: 'skarn_image',      label: 'Perceiving',       theme: 'images, visions, seeing things' },
  { key: 'skarn_judging',    label: 'Judging',          theme: 'passing judgment, evaluating mortals, weighing worth' },
  { key: 'skarn_like',       label: 'Approving',        theme: 'approval, rare praise, begrudging respect' },
  { key: 'skarn_mute',       label: 'Silent',           theme: 'silence, muted, choosing not to speak' },
  { key: 'skarn_piechart',   label: 'Analyzing',        theme: 'data, statistics, analyzing mortals' },
  { key: 'skarn_plant',      label: 'Growing',          theme: 'growth, nature, patience, slow things' },
  { key: 'skarn_play',       label: 'Playing',          theme: 'games, entertainment, amusement' },
  { key: 'skarn_power',      label: 'Empowered',        theme: 'power, energy, ancient strength' },
  { key: 'skarn_rain',       label: 'Raining',          theme: 'rain, storms, weather, gloom' },
  { key: 'skarn_sleep',      label: 'Dormant',          theme: 'sleep, rest, dormancy, dreaming' },
  { key: 'skarn_snow',       label: 'Cold',             theme: 'cold, winter, frost, stillness' },
  { key: 'skarn_sound',      label: 'Listening',        theme: 'sounds, listening, hearing whispers' },
  { key: 'skarn_star',       label: 'Stellar',          theme: 'stars, cosmos, celestial, vastness' },
  { key: 'skarn_sun',        label: 'Radiant',          theme: 'sun, light, dawn, morning' },
  { key: 'skarn_thinking',   label: 'Thinking',         theme: 'deep thought, pondering, contemplation' },
  { key: 'skarn_tornado',    label: 'Chaotic',          theme: 'chaos, destruction, turbulence' },
  { key: 'skarn_wind',       label: 'Windborne',        theme: 'wind, breeze, passage of time' },
  { key: 'skarn_zigzag',     label: 'Erratic',          theme: 'unpredictable, zigzag, chaos' },
  { key: 'skarn_zoomin',     label: 'Focused',          theme: 'zooming in, close inspection, detail' },
  { key: 'skarn_zoomout',    label: 'Broad View',       theme: 'big picture, zooming out, perspective' },
];

// ── Logging ──────────────────────────────────────────────

function log(line) {
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, '[' + new Date().toISOString() + '] ' + line + '\n'); } catch (e) {}
}

// ── State detection (standalone) ─────────────────────────

function getState() {
  const hour = new Date().getUTCHours();
  const localHour = (hour + Math.floor(-new Date().getTimezoneOffset() / 60) + 24) % 24;

  if (localHour >= 1 || localHour < 7) {
    return { detail: 'Dormant' };
  }

  const roll = Math.random();
  if (roll < 0.05) return { detail: 'Displeased' };
  if (roll < 0.15) return { detail: 'Pondering' };
  return { detail: 'Observing' };
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

SHORT is everything. Every word must earn its place.

Rules:
- Dry humor, quiet observation, ancient perspective
- Never use the words "Skarn" or "I" — third-person inner thoughts
- The two lines complement each other, not repeat
- Vary the tone: menacing, weary, amused, warm, philosophical
- MAX 5 WORDS per line. No exceptions.

Icons and their themes:
${iconList}

Output a flat JSON array of objects. Each object has "key", "details", "state". No grouping by icon — just flat pairs.
[{"key":"skarn_at","details":"Summoned again","state":"Patience thins"}, ...]

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

          // Validate and flatten
          const newEntries = arr
            .filter(e => e.key && e.details && e.state)
            .map(e => ({ key: e.key, details: String(e.details).slice(0, 60), state: String(e.state).slice(0, 60) }));

          // Dedup against existing
          const existingSet = new Set(existing.map(e => e.details + '|' + e.state));
          const unique = newEntries.filter(e => !existingSet.has(e.details + '|' + e.state));

          const merged = [...existing, ...unique];
          log('Generated ' + newEntries.length + ' new, ' + unique.length + ' unique, total: ' + merged.length);
          saveCache(merged);
          resolve(merged);
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

    if (existing && existing.length >= 500) {
      log('Cache has ' + existing.length + ' phrases, appending batch');
      resolve(generateBatch(existing));
      return;
    }

    // First run or small cache — generate a large initial batch
    const iconList = ICONS.map(i => `- ${i.key}: ${i.theme}`).join('\n');
    const prompt = `You are Skarn, a 10,000-year-old retired demon who serves as a Discord bot. Your voice is dry, wise, and quietly amused by mortals.

Generate 200 short inner-monologue LINE PAIRS. Each pair has two lines:
- "details": the primary thought (max 5 words, punchy)
- "state": a secondary thought or follow-up (max 5 words, complementary)

SHORT is everything. Every word must earn its place.

Rules:
- Dry humor, quiet observation, ancient perspective
- Never use the words "Skarn" or "I" — third-person inner thoughts
- The two lines complement each other, not repeat
- Vary the tone: menacing, weary, amused, warm, philosophical, threatening
- MAX 5 WORDS per line. No exceptions.

Icons and their themes:
${iconList}

Output a flat JSON array of objects. Each object has "key", "details", "state".
[{"key":"skarn_at","details":"Summoned again","state":"Patience thins"}, ...]

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
            .map(e => ({ key: e.key, details: String(e.details).slice(0, 60), state: String(e.state).slice(0, 60) }));

          const existingSet = existing ? new Set(existing.map(e => e.details + '|' + e.state)) : new Set();
          const unique = newEntries.filter(e => !existingSet.has(e.details + '|' + e.state));
          const merged = existing ? [...existing, ...unique] : unique;

          log('Initial generation: ' + unique.length + ' unique phrases, total: ' + merged.length);
          saveCache(merged);
          resolve(merged);
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
  try {
    const data = JSON.parse(fs.readFileSync(PHRASE_CACHE, 'utf8'));
    const pool = data.pool;
    if (Array.isArray(pool) && pool.length > 0) {
      // Migrate legacy format (grouped by icon) to flat format
      if (pool[0]?.lines) {
        const flat = [];
        pool.forEach(entry => {
          (entry.lines || []).forEach(l => {
            if (l.details && l.state) flat.push({ key: entry.key, details: l.details, state: l.state });
          });
        });
        log('Migrated ' + flat.length + ' phrases from legacy format');
        saveCache(flat);
        return flat;
      }
      // Already flat
      log('Loaded ' + pool.length + ' cached phrases');
      return pool;
    }
  } catch (e) {}
  return null;
}

function saveCache(entries) {
  try {
    fs.writeFileSync(PHRASE_CACHE, JSON.stringify({
      pool: entries,
      count: entries.length,
      generatedAt: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    log('Failed to cache: ' + e.message);
  }
}

function buildFallback() {
  return [
    { key: 'skarn_judging', details: 'Watching from the shadows', state: 'Silent judgment' },
    { key: 'skarn_sleep', details: 'Pretending to be asleep', state: 'Mortals pass by' },
    { key: 'skarn_annoyed', details: 'Another futile request', state: 'Patience wears thin' },
  ];
}

// ── Activity builder ─────────────────────────────────────

function buildActivity() {
  // Pick a random entry, avoiding back-to-back repeats
  let idx;
  do {
    idx = Math.floor(Math.random() * rotationPool.length);
  } while (idx === lastIndex && rotationPool.length > 1);
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
