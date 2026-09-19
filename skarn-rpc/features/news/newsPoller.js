const fs = require('fs');
const path = require('path');

const { DEFAULT_ALLOWED_HOSTS, requestFeed } = require('./feedClient');
const { parseFeedDetailed } = require('./feedParser');
const {
  ALL_TIME_MAX_AGE_MS,
  DEFAULT_MAX_AGE_MS,
  MAX_ITEMS,
  STATE_PATH,
  diagnostic,
  loadNewsState,
  mergeNewsItems,
  saveNewsState,
} = require('./newsState');

const CONFIG_PATH = path.join(__dirname, '../../data/news-sources.json');
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const JITTER_RATIO = 0.1;
const APPROVED_FEED_HOSTS = new Set(DEFAULT_ALLOWED_HOSTS.map(host => host.toLowerCase()));

function loadNewsConfig(filePath) {
  const target = filePath || CONFIG_PATH;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function validateNewsConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return { ok: false, errors: ['config must be an object'] };
  if (config.schemaVersion !== 1) errors.push('unsupported schemaVersion');
  if (config.mode !== undefined && !['ambient', 'news'].includes(config.mode)) errors.push('mode must be ambient or news');
  if (config.freshnessMode !== undefined && !['fresh', 'retroactive'].includes(config.freshnessMode)) errors.push('freshnessMode must be fresh or retroactive');
  if (config.maxItemsPerSource !== undefined && (!Number.isSafeInteger(config.maxItemsPerSource) || config.maxItemsPerSource < 1 || config.maxItemsPerSource > MAX_ITEMS)) errors.push('maxItemsPerSource must be from 1 through ' + MAX_ITEMS);
  if (config.newsDwellMs !== undefined && (!Number.isSafeInteger(config.newsDwellMs) || config.newsDwellMs < 10000 || config.newsDwellMs > 15 * 60 * 1000)) errors.push('newsDwellMs must be from 10000ms through 900000ms');
  if (typeof config.enabled !== 'boolean') errors.push('enabled must be boolean');
  if (!Number.isSafeInteger(config.pollIntervalMs) || config.pollIntervalMs < 60000) errors.push('pollIntervalMs must be at least one minute');
  if (!Number.isSafeInteger(config.maxAgeMs) || config.maxAgeMs <= 0 || config.maxAgeMs > DEFAULT_MAX_AGE_MS) errors.push('maxAgeMs must be from 1ms through six hours');
  if (!Array.isArray(config.sources) || config.sources.length !== 15) errors.push('exactly fifteen sources are required');
  const ids = new Set();
  const hosts = new Set();
  (config.sources || []).forEach((source, index) => {
    const prefix = 'sources[' + index + ']';
    for (const field of ['id', 'name', 'domain', 'feedUrl', 'topicFamily', 'trustClass', 'iconRole']) {
      if (typeof source[field] !== 'string' || source[field].trim() === '') errors.push(prefix + '.' + field + ' is required');
    }
    if (ids.has(source.id)) errors.push(prefix + '.id is duplicated');
    ids.add(source.id);
    if (hosts.has(source.domain)) errors.push(prefix + '.domain is duplicated');
    hosts.add(source.domain);
    const normalizedDomain = String(source.domain || '').toLowerCase().replace(/[.]$/, '');
    if (!APPROVED_FEED_HOSTS.has(normalizedDomain)) errors.push(prefix + '.domain is not an approved feed host');
    try {
      const url = new URL(source.feedUrl);
      if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== normalizedDomain) errors.push(prefix + '.feedUrl must be HTTPS on its declared domain');
    } catch (error) {
      errors.push(prefix + '.feedUrl is invalid');
    }
    if (typeof source.enabled !== 'boolean') errors.push(prefix + '.enabled must be boolean');
    if (!Number.isSafeInteger(source.pollIntervalMs) || source.pollIntervalMs < 60000) errors.push(prefix + '.pollIntervalMs is invalid');
    if (!Number.isSafeInteger(source.maxAgeMs) || source.maxAgeMs <= 0 || source.maxAgeMs > DEFAULT_MAX_AGE_MS) errors.push(prefix + '.maxAgeMs must be from 1ms through six hours');
    if (source.maxResponseBytes !== undefined && (!Number.isSafeInteger(source.maxResponseBytes) || source.maxResponseBytes < 64 * 1024 || source.maxResponseBytes > 4 * 1024 * 1024)) errors.push(prefix + '.maxResponseBytes must be between 64KiB and 4MiB');
    if (!Number.isSafeInteger(source.basePriority) || source.basePriority < 0) errors.push(prefix + '.basePriority is invalid');
    const rule = source.highSalience;
    if (!rule || !Array.isArray(rule.sourceIds) || !Array.isArray(rule.topicFamilies) || !Array.isArray(rule.titleAny) || !Array.isArray(rule.titleAll) || !Array.isArray(rule.titleNone)) {
      errors.push(prefix + '.highSalience must contain explicit source/topic/title rules');
    }
  });
  return { ok: errors.length === 0, errors };
}

function randomJitter(random, base) {
  const value = typeof random === 'function' ? Number(random()) : Math.random();
  const bounded = Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
  return Math.floor(base * JITTER_RATIO * bounded);
}

function createNewsPoller(options) {
  const settings = options || {};
  const config = settings.config || loadNewsConfig(settings.configPath);
  const validation = validateNewsConfig(config);
  if (!validation.ok) throw new Error('invalid news config: ' + validation.errors.join('; '));
  const retentionMaxAgeMs = config.freshnessMode === 'retroactive' ? ALL_TIME_MAX_AGE_MS : config.maxAgeMs;
  const clock = typeof settings.now === 'function' ? settings.now : () => Date.now();
  const random = settings.random || Math.random;
  const request = settings.requestFeed || requestFeed;
  const parse = settings.parseFeedDetailed || parseFeedDetailed;
  const statePath = settings.statePath || STATE_PATH;
  const maxItemsPerSource = config.freshnessMode === 'retroactive' ? config.maxItemsPerSource : undefined;
  let state = settings.state || loadNewsState(statePath, { now: clock(), maxAgeMs: retentionMaxAgeMs, maxItemsPerSource });
  let inFlight = null;
  let timer = null;
  let running = false;
  let nextPollAt = null;
  let lastError = null;
  let consecutiveFailures = 0;

  function sourceStatus(sourceId) {
    return state.sources[sourceId] || {
      etag: null,
      lastModified: null,
      lastPollAt: null,
      lastSuccessAt: null,
      lastError: null,
      consecutiveFailures: 0,
    };
  }

  function setSourceStatus(source, value) {
    state.sources = { ...state.sources, [source.id]: value };
  }

  function isStale(now) {
    if (!config.enabled) return false;
    const latest = state.lastSuccessAt;
    return !latest || now - latest > retentionMaxAgeMs || state.items.length === 0;
  }

  function getStatus() {
    const now = clock();
    return {
      enabled: config.enabled,
      running,
      inFlight: Boolean(inFlight),
      lastSuccessAt: state.lastSuccessAt,
      lastError,
      stale: isStale(now),
      candidateCount: state.items.length,
      nextPollAt,
      consecutiveFailures,
    };
  }

  function getCandidates() {
    return isStale(clock()) ? [] : state.items.slice();
  }

  function scheduleNext() {
    if (!running || timer) return;
    const base = consecutiveFailures > 0
      ? Math.min(MAX_BACKOFF_MS, config.pollIntervalMs * Math.pow(2, Math.min(consecutiveFailures - 1, 10)))
      : config.pollIntervalMs;
    const delay = base + randomJitter(random, base);
    nextPollAt = clock() + delay;
    timer = setTimeout(() => {
      timer = null;
      nextPollAt = null;
      poll().catch(() => {});
    }, delay);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  async function pollOnce() {
    const startedAt = clock();
    let successes = 0;
    let failures = 0;
    let accepted = [];
    for (const source of config.sources.filter(candidate => candidate.enabled)) {
      const previous = sourceStatus(source.id);
      try {
        const result = await request(source.feedUrl, {
          allowlist: [source.domain],
          maxResponseBytes: source.maxResponseBytes,
          timeoutMs: Math.min(source.pollIntervalMs, 15000),
          validators: { etag: previous.etag, lastModified: previous.lastModified },
        });
        const sourceNow = clock();
        if (result.statusCode === 304) {
          setSourceStatus(source, {
            ...previous,
            etag: result.etag || previous.etag,
            lastModified: result.lastModified || previous.lastModified,
            lastPollAt: sourceNow,
            lastSuccessAt: sourceNow,
            lastError: null,
            consecutiveFailures: 0,
            rejectedCount: 0,
          });
          successes++;
          continue;
        }
        const parsed = await parse(result.body, source, { now: sourceNow, maxAgeMs: retentionMaxAgeMs });
        accepted = accepted.concat(parsed.items);
        setSourceStatus(source, {
          ...previous,
          etag: result.etag || previous.etag,
          lastModified: result.lastModified || previous.lastModified,
          lastPollAt: sourceNow,
          lastSuccessAt: sourceNow,
          lastError: null,
          consecutiveFailures: 0,
          rejectedCount: parsed.rejected.length,
        });
        successes++;
      } catch (error) {
        failures++;
        const sourceNow = clock();
        setSourceStatus(source, {
          ...previous,
          lastPollAt: sourceNow,
          lastError: diagnostic(error),
          consecutiveFailures: previous.consecutiveFailures + 1,
        });
      }
    }
    const finishedAt = clock();
    state = mergeNewsItems(state, accepted, { now: finishedAt, maxAgeMs: retentionMaxAgeMs, maxItemsPerSource });
    state.lastPollAt = finishedAt;
    if (successes > 0) {
      state.lastSuccessAt = finishedAt;
      state.lastError = failures > 0 ? 'PARTIAL_POLL_FAILURE' : null;
      consecutiveFailures = 0;
      lastError = failures > 0 ? 'PARTIAL_POLL_FAILURE' : null;
    } else {
      consecutiveFailures++;
      state.lastError = failures > 0 ? 'POLL_FAILED' : 'NO_ENABLED_SOURCES';
      lastError = state.lastError;
    }
    state = saveNewsState(statePath, state, { now: finishedAt, maxAgeMs: retentionMaxAgeMs, maxItemsPerSource });
    return getStatus();
  }

  function poll() {
    if (!config.enabled) return Promise.resolve(getStatus());
    if (inFlight) return inFlight;
    inFlight = pollOnce()
      .catch(error => {
        lastError = diagnostic(error);
        consecutiveFailures++;
        throw error;
      })
      .finally(() => {
        inFlight = null;
        scheduleNext();
      });
    return inFlight;
  }

  function start(options) {
    if (!config.enabled) return getStatus();
    running = true;
    const immediate = !options || options.immediate !== false;
    if (immediate) poll().catch(() => {});
    else scheduleNext();
    return getStatus();
  }

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    nextPollAt = null;
    return getStatus();
  }

  return { getCandidates, getStatus, loadNewsConfig, poll, start, stop };
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_MAX_AGE_MS,
  ALL_TIME_MAX_AGE_MS,
  MAX_BACKOFF_MS,
  createNewsPoller,
  loadNewsConfig,
  validateNewsConfig,
};
