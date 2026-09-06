require('dotenv').config();
const RPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');
const {
  createMoodWindow,
  isSleepTime: isPresenceSleepTime,
  loadPresenceContract,
} = require('./features/presence/presenceContract');
const { loadSharedCatalog } = require('./features/presence/sharedCatalogAdapter');
const { LOCAL_STATE_PATH, loadMoodState, saveMoodState } = require('./features/presence/presenceState');

const clientId = '982308134871765022';
const RETRY_MS = 15000;
const PRESENCE_CONTRACT = loadPresenceContract();
const ROTATE_MS = PRESENCE_CONTRACT.phraseRotationMs;
const MOOD_IDS = new Set(PRESENCE_CONTRACT.moods);
const INITIAL_MOOD_STATE = loadMoodState(LOCAL_STATE_PATH);
const LOG_FILE = path.join(__dirname, 'data', 'rpc.log');
let retryTimer = null;
let rotateTimer = null;
let rotationPool = [];
let lastIndex = -1;
let currentMoodState = INITIAL_MOOD_STATE.state;

const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'icon-registry.json'), 'utf8'));

function log(line) {
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, '[' + new Date().toISOString() + '] ' + line + '\n'); } catch (e) {}
}

function normalizeEntries(entries) {
  const seen = new Set();
  return (entries || []).filter(entry => {
    if (!entry || !entry.key || !entry.details || !entry.state || !MOOD_IDS.has(entry.mood)) return false;
    const signature = (entry.details + '|' + entry.state).toLowerCase();
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function buildFallback() {
  const icons = new Map(ICONS.map(icon => [icon.key, icon]));
  return normalizeEntries([
    { key: 'skarn_eye', details: 'Watching from the shadows', state: 'Silent judgment', mood: 'observing' },
    { key: 'skarn_sleep', details: 'Pretending to be asleep', state: 'Mortals pass by', mood: 'dormant' },
    { key: 'skarn_dislike', details: 'Another futile request', state: 'Patience wears thin', mood: 'displeased' },
  ]).map(entry => ({ ...entry, label: icons.get(entry.key)?.label || entry.key }));
}

function loadRotationPool() {
  try {
    const pool = loadSharedCatalog(undefined, ICONS);
    if (pool.length === 0) throw new Error('catalog has no RPC-compatible entries');
    log('Loaded shared presence catalog: ' + pool.length + ' RPC-compatible phrases');
    return pool;
  } catch (error) {
    log('Shared presence catalog unavailable; using static fallback: ' + error.message);
    return buildFallback();
  }
}

function getState() {
  const now = Date.now();
  const state = createMoodWindow({ now, random: Math.random(), process: 'skarn-rpc', previousState: currentMoodState, contract: PRESENCE_CONTRACT });
  return { id: state.mood, detail: state.mood.charAt(0).toUpperCase() + state.mood.slice(1), dwellMs: Math.max(0, state.moodUntil - now), state };
}

function getCurrentMood() {
  const now = Date.now();
  const enteredSleep = currentMoodState && currentMoodState.mood !== 'dormant' && isPresenceSleepTime(now, PRESENCE_CONTRACT);
  if (currentMoodState && now < currentMoodState.moodUntil && !enteredSleep) {
    return { id: currentMoodState.mood, detail: currentMoodState.mood.charAt(0).toUpperCase() + currentMoodState.mood.slice(1), dwellMs: currentMoodState.moodUntil - now };
  }
  const next = getState();
  currentMoodState = next.state;
  try { saveMoodState(LOCAL_STATE_PATH, currentMoodState); } catch (error) { log('Failed to save mood state: ' + error.message); }
  log('Mood: ' + next.id + ' | until ' + new Date(currentMoodState.moodUntil).toISOString());
  return { id: next.id, detail: next.detail, dwellMs: next.dwellMs };
}

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
  return { details: entry.details, state: entry.state, largeImageKey: 'skarn_logo', largeImageText: 'Skarn Bot', smallImageKey: entry.key, smallImageText: entry.label, instance: false, type: 0, startTimestamp: 1000 };
}

function startRotation(rpc) {
  if (rotateTimer) clearInterval(rotateTimer);
  rotateTimer = setInterval(() => {
    try { const activity = buildActivity(); rpc.setActivity(activity); log('Rotated: ' + activity.smallImageKey + ' — ' + activity.details + ' / ' + activity.state); }
    catch (error) { log('Rotation error: ' + error.message); }
  }, ROTATE_MS);
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; connect(); }, RETRY_MS);
}

async function connect() {
  if (rotationPool.length === 0) rotationPool = loadRotationPool();
  const rpc = new RPC.Client({ transport: 'ipc' });
  rpc.on('ready', () => { log('Rich Presence connected!'); rpc.setActivity(buildActivity()); startRotation(rpc); log('Rotation: every ' + (ROTATE_MS / 1000) + 's | Phrases: ' + rotationPool.length); });
  rpc.on('error', error => log('Error: ' + error.message));
  rpc.on('disconnected', () => { log('Disconnected — retrying in ' + RETRY_MS / 1000 + 's'); if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; } scheduleRetry(); });
  rpc.login({ clientId }).catch(error => { log('Failed to connect: ' + error.message); scheduleRetry(); });
}

log('Skarn RPC starting...');
connect();
