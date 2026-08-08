// ===== Presence cycler =====
const { moderatedChatCompletion } = require('../../ai/client');
const { getAppState, setAppState, getFlag, setFlag } = require('../../db/ops');
const { roles } = require('../../persona/roles');

const POOL_SIZE = parseInt(process.env.PRESENCE_POOL_SIZE, 10) || 300;
const CYCLE_MS = parseInt(process.env.PRESENCE_CYCLE_MS, 10) || 120000;
const REFRESH_DAYS = parseInt(process.env.PRESENCE_REFRESH_DAYS, 10) || 7;
const REFRESH_MS = REFRESH_DAYS * 86400000;
const REGEN_THROTTLE_MS = 24 * 60 * 60 * 1000;
const STATIC_DEFAULT = 'the mortals squabble';
const KEY_PHRASES = 'presence_phrases';
const KEY_GENERATED_AT = 'presence_phrases_generated_at';
const KEY_LAST_REGEN = 'presence_regen_at';

// Local isSleepTime copy mirroring bot.js:79-85 — importing from bot.js would be a circular require.
const SLEEP_START = process.env.SLEEP_START !== undefined ? parseInt(process.env.SLEEP_START) : 1;
const SLEEP_END = process.env.SLEEP_END !== undefined ? parseInt(process.env.SLEEP_END) : 7;
const SLEEP_TIMEZONE = process.env.SLEEP_TIMEZONE !== undefined ? parseInt(process.env.SLEEP_TIMEZONE) : 0;

function isSleepTime() {
  const now = new Date();
  const hour = (now.getUTCHours() + SLEEP_TIMEZONE + 24) % 24;
  if (SLEEP_START === SLEEP_END) return false;
  if (SLEEP_START < SLEEP_END) return hour >= SLEEP_START && hour < SLEEP_END;
  return hour >= SLEEP_START || hour < SLEEP_END;
}

let pool = [];
let poolIndex = 0;
let generating = false;

// ===== Pool helpers =====

function currentPhrase() {
  return pool.length > 0 ? pool[poolIndex % pool.length] : STATIC_DEFAULT;
}

function advancePhrase() {
  if (pool.length === 0) return STATIC_DEFAULT;
  poolIndex = (poolIndex + 1) % pool.length;
  return pool[poolIndex];
}

function _setPool(phrases, index) {
  pool = phrases;
  poolIndex = index || 0;
}

// ===== Persistence (app_state) =====

function loadPool() {
  const raw = getAppState(KEY_PHRASES);
  if (!raw) return null;
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const seen = new Set();
  const valid = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const phrase = item.trim();
    const wordCount = phrase.length > 0 ? phrase.split(/\s+/).length : 0;
    if (wordCount < 1 || wordCount > 8 || seen.has(phrase)) continue;
    seen.add(phrase);
    valid.push(phrase);
  }
  return valid.length > 0 ? valid : null;
}

function getGeneratedAt() {
  const raw = getAppState(KEY_GENERATED_AT);
  const ts = parseInt(raw, 10);
  return isNaN(ts) ? 0 : ts;
}

function storePool(phrases) {
  setAppState(KEY_PHRASES, JSON.stringify(phrases));
  setAppState(KEY_GENERATED_AT, String(Date.now()));
}

// ===== Generation =====

function _parsePool(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.phrases)) return null;
  const seen = new Set();
  const phrases = [];
  for (const item of parsed.phrases) {
    if (typeof item !== 'string') continue;
    const phrase = item.trim();
    const words = phrase.length > 0 ? phrase.split(/\s+/).length : 0;
    if (words < 1 || words > 8 || seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
  }
  return phrases.length > 0 ? phrases : null;
}

async function generatePool() {
  const result = await moderatedChatCompletion({
    userId: 'presence:cycler',
    bucket: 'presence',
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: roles.presence },
      { role: 'user', content: 'Return JSON {"phrases": ["...", "..."]} with exactly ' + POOL_SIZE + ' phrases, each 8 words or fewer, in Skarn\'s dry observing voice.' },
    ],
    max_tokens: 6000,
    temperature: 1.0,
    response_format: { type: 'json_object' },
  });
  if (!result.success) return null;
  return _parsePool(result.completion.choices[0].message.content);
}

async function generateAndStore() {
  if (generating) return null;
  generating = true;
  try {
    const phrases = await generatePool();
    if (!phrases) {
      console.log('[Presence] Generation failed — keeping existing pool');
      return null;
    }
    pool = phrases;
    poolIndex = 0;
    storePool(phrases);
    console.log('[Presence] Generated ' + phrases.length + ' phrases');
    return phrases;
  } finally {
    // Always release the guard and stamp the attempt so the 24h regen throttle
    // also covers failures (avoids retrying a dead AI path every 2 min).
    generating = false;
    setFlag(KEY_LAST_REGEN, String(Date.now()));
  }
}

async function maybeRegenerate() {
  if (generating) return { phrases: pool, stale: true };
  const stored = loadPool();
  const generatedAt = getGeneratedAt();
  const lastRegen = parseInt(getFlag(KEY_LAST_REGEN), 10) || 0;
  const wantsRegen = !stored || Date.now() - generatedAt >= REFRESH_MS;
  const throttled = Date.now() - lastRegen < REGEN_THROTTLE_MS;
  if (!wantsRegen || throttled) return { phrases: stored || pool, stale: false };
  const fresh = await generateAndStore();
  return fresh ? { phrases: pool, stale: false } : { phrases: stored || pool, stale: true };
}

function refreshInBackground() {
  maybeRegenerate().catch(function(e) {
    console.error('[Presence] Refresh error:', e.message);
  });
}

// ===== Cycling =====

function setActivity(client, phrase) {
  if (!client || !client.user) return;
  client.user.setActivity(phrase, { type: 3 });
}

function startPresenceCycler(client) {
  const stored = loadPool();
  pool = stored || [STATIC_DEFAULT];
  poolIndex = 0;
  if (stored) {
    console.log('[Presence] Loaded ' + stored.length + ' phrases from app_state');
  } else {
    console.log('[Presence] No stored phrases — falling back to static default');
  }
  setActivity(client, currentPhrase());

  refreshInBackground();

  setInterval(() => {
    if (isSleepTime()) {
      refreshInBackground();
      return;
    }
    setActivity(client, advancePhrase());
    refreshInBackground();
  }, CYCLE_MS);
}

module.exports = { startPresenceCycler, maybeRegenerate, _parsePool, _setPool, currentPhrase, advancePhrase };
