require('dotenv').config();
const RPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');
const https = require('https');

const clientId = '982308134871765022';
const RETRY_MS = 15000;
const ROTATE_MS = 2 * 60 * 1000;       // 2 minutes
const REGEN_MS = 5 * 60 * 60 * 1000;   // 5 hours
const LOG_FILE = path.join(__dirname, 'data', 'rpc.log');
const PHRASE_CACHE = path.join(__dirname, 'data', 'rpc-phrases.json');

let retryTimer = null;
let rotateTimer = null;
let regenTimer = null;
let rotationPool = [];  // [{ icon, lines: [{ details, state }, ...] }, ...]
let poolIndex = 0;
let lineIndex = 0;
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

function generatePhrasesForIcons() {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log('No OPENAI_API_KEY — using cached or fallback');
      return resolve(loadCache() || buildFallback());
    }

    // Build a prompt that generates phrases for ALL icons in one call
    const iconList = ICONS.map(i => `- ${i.key}: ${i.theme}`).join('\n');
    const prompt = `You are Skarn, a 10,000-year-old retired demon who serves as a Discord bot. Your voice is dry, wise, and quietly amused by mortals.

Generate short inner-monologue LINE PAIRS for each icon theme below. Each icon gets exactly 6 pairs. Each pair has two lines:
- "details": the primary thought (max 10 words, punchy)
- "state": a secondary thought or follow-up (max 8 words, complementary)

The two lines should feel like a complete thought split across two lines — like a setup + punchline or a observation + reflection. Together they paint a picture of Skarn's mood for that icon.

Rules:
- Dry humor, quiet observation, ancient perspective
- Never use the words "Skarn" or "I" — these are third-person inner thoughts
- The two lines should complement each other, not repeat
- Vary the tone across the 6 pairs: some menacing, some weary, some amused, some surprisingly warm
- Match the icon's theme

Icons and their themes:
${iconList}

Output format — strict JSON array, no markdown:
[
  {"key": "skarn_at", "lines": [{"details": "line 1", "state": "line 2"}, {"details": "line 1", "state": "line 2"}, {"details": "line 1", "state": "line 2"}, {"details": "line 1", "state": "line 2"}, {"details": "line 1", "state": "line 2"}, {"details": "line 1", "state": "line 2"}]},
  {"key": "skarn_awake", "lines": [{"details": "line 1", "state": "line 2"}, ...]}
]
...one entry per icon, 6 line pairs each. No text outside the JSON.`;

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
          // Strip markdown code fences if present
          const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
          const raw = JSON.parse(cleaned);

          // Handle both { icons: [...] }, { pool: [...] }, and bare array
          const arr = Array.isArray(raw) ? raw : raw.icons || raw.pool || raw.phrases || Object.values(raw).find(v => Array.isArray(v)) || [];

          const pool = ICONS.map(icon => {
            const match = arr.find(a => a.key === icon.key);
            // Support both new format (lines: [{details, state}]) and legacy (phrases: ["..."])
            let lines = match?.lines?.filter(l => l?.details && l?.state) || [];
            if (lines.length === 0 && match?.phrases) {
              lines = match.phrases.filter(p => typeof p === 'string' && p.length <= 60)
                .map(p => ({ details: p, state: '<+HUSH>' }));
            }
            return { ...icon, lines };
          }).filter(entry => entry.lines.length > 0);

          if (pool.length >= 10) {
            const totalLines = pool.reduce((n, e) => n + e.lines.length, 0);
            log('Generated ' + totalLines + ' line pairs across ' + pool.length + ' icons');
            saveCache(pool);
            resolve(pool);
          } else {
            log('Too few icons generated (' + pool.length + '), using cache/fallback');
            resolve(loadCache() || buildFallback());
          }
        } catch (e) {
          log('Parse error: ' + e.message);
          resolve(loadCache() || buildFallback());
        }
      });
    });

    req.on('error', (e) => {
      log('API error: ' + e.message);
      resolve(loadCache() || buildFallback());
    });

    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Phrase cache ──────────────────────────────────────────

function loadCache() {
  try {
    const data = JSON.parse(fs.readFileSync(PHRASE_CACHE, 'utf8'));
    const pool = data.pool || data.icons;
    if (pool && pool.length >= 10) {
      // Migrate legacy format: phrases=["..."] → lines=[{details,state}]
      const migrated = pool.map(entry => {
        if (entry.lines && entry.lines.length > 0) return entry;
        if (entry.phrases) {
          return { ...entry, lines: entry.phrases.map(p => ({ details: p, state: '<+HUSH>' })) };
        }
        return entry;
      }).filter(e => e.lines && e.lines.length > 0);
      const total = migrated.reduce((n, e) => n + e.lines.length, 0);
      log('Loaded cached pool: ' + total + ' line pairs across ' + migrated.length + ' icons');
      return migrated;
    }
  } catch (e) {}
  return null;
}

function saveCache(pool) {
  try {
    fs.writeFileSync(PHRASE_CACHE, JSON.stringify({
      pool,
      generatedAt: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    log('Failed to cache: ' + e.message);
  }
}

function buildFallback() {
  return ICONS.map(icon => ({
    key: icon.key,
    label: icon.label,
    theme: icon.theme,
    lines: [{ details: 'watching from the shadows', state: '<+HUSH>' }],
  }));
}

// ── Activity builder ─────────────────────────────────────

function buildActivity() {
  const entry = rotationPool[poolIndex % rotationPool.length];
  const line = entry.lines[lineIndex % entry.lines.length];

  // Advance indices
  lineIndex++;
  if (lineIndex >= entry.lines.length) {
    lineIndex = 0;
    poolIndex++;
  }

  return {
    details: line.details,
    state: line.state,
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
    log('Regenerating phrase pool...');
    rotationPool = await generatePhrasesForIcons();
    poolIndex = 0;
    lineIndex = 0;
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
    rotationPool = await generatePhrasesForIcons();
  }

  const rpc = new RPC.Client({ transport: 'ipc' });

  rpc.on('ready', () => {
    log('Rich Presence connected!');
    activeRpc = rpc;

    rpc.setActivity(buildActivity());
    startRotation(rpc);
    scheduleRegen();

    const totalLines = rotationPool.reduce((n, e) => n + e.lines.length, 0);
    log('Rotation: every ' + (ROTATE_MS / 1000) + 's | Icons: ' + rotationPool.length + ' | Line pairs: ' + totalLines + ' | Regen: every ' + (REGEN_MS / 3600000) + 'h');
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
