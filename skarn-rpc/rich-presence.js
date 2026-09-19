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
const { createActivityLogger } = require('./features/presence/activityLogger');
const { createActivityPublisher } = require('./features/presence/activityPublisher');
const { createCandidateSelector } = require('./features/presence/candidateSelector');
const { createActivityRenderer } = require('./features/presence/activityRenderer');
const { createRepetitionPolicy, normalizeIconMetadata } = require('./features/presence/repetitionPolicy');
const { ALL_TIME_MAX_AGE_MS, createNewsPoller, loadNewsConfig } = require('./features/news/newsPoller');

const clientId = '982308134871765022';
const RETRY_MS = 15000;
const PRESENCE_CONTRACT = loadPresenceContract();
const ROTATE_MS = PRESENCE_CONTRACT.phraseRotationMs;
const MOOD_IDS = new Set(PRESENCE_CONTRACT.moods);
const INITIAL_MOOD_STATE = loadMoodState(LOCAL_STATE_PATH);
const LOG_FILE = path.join(__dirname, 'data', 'rpc.log');
const PRESENCE_STARTED_AT = new Date();
let retryTimer = null;
let rotateTimer = null;
let rotationPool = [];
let lastIndex = -1;
let currentMoodState = INITIAL_MOOD_STATE.state;

const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'icon-registry.json'), 'utf8'));
const ICON_OVERRIDES = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'icon-role-overrides.json'), 'utf8'));
const ICON_METADATA = normalizeIconMetadata(ICONS, ICON_OVERRIDES);
const NEWS_REACTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'news-reactions.json'), 'utf8'));
const NEWS_CONFIG = loadNewsConfig(path.join(__dirname, 'data', 'news-sources.json'));
const NEWS_MODE = NEWS_CONFIG.mode === 'news';
const NEWS_MAX_AGE_MS = NEWS_CONFIG.freshnessMode === 'retroactive' ? ALL_TIME_MAX_AGE_MS : NEWS_CONFIG.maxAgeMs;
const activityLogger = createActivityLogger({ logFile: LOG_FILE });
const publisher = createActivityPublisher({
  logger: (event, fields) => activityLogger.log(event, fields),
});
const repetitionPolicy = createRepetitionPolicy();
const activityRenderer = createActivityRenderer({ iconMetadata: ICON_METADATA, reactions: NEWS_REACTIONS, largeImageText: 'Skarn Warmaster', startTimestamp: PRESENCE_STARTED_AT });
const newsPoller = createNewsPoller({ config: NEWS_CONFIG });
const candidateSelector = createCandidateSelector({
  maxAgeMs: NEWS_MAX_AGE_MS,
  newsDwellMs: NEWS_CONFIG.newsDwellMs || 3 * 60 * 1000,
  newsPoller,
  renderAmbient: entry => activityRenderer.renderAmbient(entry, PRESENCE_STARTED_AT),
  renderNews: (item, now) => activityRenderer.renderNews(item, now),
  renderNewsFallback: now => activityRenderer.renderSystem(
    'News mode · No fresh items',
    'Approved feeds · awaiting fresh signal',
    'skarn_eye',
    PRESENCE_STARTED_AT,
  ),
  newsOnly: NEWS_MODE,
  sources: NEWS_CONFIG.sources,
});

function log(event, fields) {
  activityLogger.log(event, fields);
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
    log('shared_catalog_loaded', { phraseCount: pool.length });
    return pool;
  } catch (error) {
    log('shared_catalog_fallback', { code: error.code || 'SHARED_CATALOG_UNAVAILABLE', name: error.name || 'Error' });
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
  try { saveMoodState(LOCAL_STATE_PATH, currentMoodState); } catch (error) { log('mood_state_save_failed', { code: error.code || 'MOOD_STATE_SAVE_FAILED', name: error.name || 'Error' }); }
  log('mood_changed', { mood: next.id, moodUntil: currentMoodState.moodUntil });
  return { id: next.id, detail: next.detail, dwellMs: next.dwellMs };
}

function buildAmbientCandidate() {
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
    kind: mood.id === 'dormant' ? 'quiet' : 'ambient',
    id: 'ambient:' + entry.key,
    phraseId: entry.key,
    phraseHash: entry.details + '|' + entry.state,
    details: entry.details,
    state: entry.state,
    iconKey: entry.key,
    iconLabel: entry.label,
    topic: 'general',
    salience: 'low',
    startTimestamp: PRESENCE_STARTED_AT,
  };
}

function buildSelectedActivity(now) {
  const ambient = buildAmbientCandidate();
  const selected = candidateSelector.select(ambient, now);
  if (!selected || !selected.activity) return null;
  const policyCandidate = {
    ...selected,
    details: selected.activity.details,
    state: selected.activity.state,
    iconKey: selected.activity.smallImageKey,
  };
  const decision = repetitionPolicy.consider(policyCandidate, now);
  if (!decision.allowed && !selected.allowCooldownOverride) return null;
  return { candidate: selected, activity: selected.activity };
}

function publishActivity(event) {
  const selected = buildSelectedActivity(Date.now());
  if (!selected) return Promise.resolve(false);
  return publisher.publish({ ...selected.activity, priority: selected.candidate.kind === 'news' ? 20 : 1 }).then(published => {
    if (published) log(event, {
      kind: selected.candidate.kind,
      iconKey: selected.activity.smallImageKey,
      salience: selected.candidate.salience || 'normal',
    });
    return published;
  }, error => {
    log('activity_publish_callback_failed', { code: error.code || 'PUBLISH_CALLBACK_FAILED', name: error.name || 'Error' });
  });
}

function stopRotation() {
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
}

function startRotation() {
  if (rotateTimer) clearInterval(rotateTimer);
  rotateTimer = setInterval(() => {
    try {
      publishActivity('activity_tick');
    } catch (error) {
      log('rotation_failed', { code: error.code || 'ROTATION_FAILED', name: error.name || 'Error' });
    }
  }, ROTATE_MS);
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; connect(); }, RETRY_MS);
}

function destroyUnattachedClient(rpc) {
  if (!rpc || typeof rpc.destroy !== 'function') return;
  try {
    const result = rpc.destroy();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) {}
}

async function connect() {
  if (rotationPool.length === 0) rotationPool = loadRotationPool();
  const rpc = new RPC.Client({ transport: 'ipc' });
  rpc.on('ready', () => {
    log('rpc_connected', {});
    publisher.setClient(rpc);
    try {
      newsPoller.start();
      publishActivity('activity_initial');
      startRotation();
      log('rotation_started', { intervalMs: ROTATE_MS, phraseCount: rotationPool.length, newsMode: NEWS_MODE });
    } catch (error) {
      log('initial_activity_failed', { code: error.code || 'INITIAL_ACTIVITY_FAILED', name: error.name || 'Error' });
    }
  });
  rpc.on('error', error => log('rpc_error', { code: error.code || 'RPC_ERROR', name: error.name || 'Error' }));
  rpc.on('disconnected', () => {
    stopRotation();
    newsPoller.stop();
    publisher.disconnectClient();
    log('rpc_disconnected', { retryMs: RETRY_MS });
    scheduleRetry();
  });
  rpc.login({ clientId }).catch(error => {
    destroyUnattachedClient(rpc);
    log('rpc_connect_failed', { code: error.code || 'RPC_CONNECT_FAILED', name: error.name || 'Error' });
    scheduleRetry();
  });
}

log('rpc_starting', {});
connect();
