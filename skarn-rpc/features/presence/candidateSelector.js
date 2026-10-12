const { compareCandidates, deriveSalience } = require('./repetitionPolicy');
const { evaluateTitle } = require('../news/newsQuality');

const NEWS_DWELL_MS = 3 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const NEWS_RANDOM_HISTORY_SIZE = 20;
const NEWS_RANDOM_SOURCE_HISTORY_SIZE = 8;
const NEWS_MAX_ITEMS_PER_SOURCE = 10;

function timestampOf(item) {
  const timestamp = Date.parse(item && (item.updatedAt || item.publishedAt || item.fetchedAt || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function hasTitlePromotion(item, source) {
  const rule = source && source.highSalience;
  if (!rule) return false;
  const title = String(item.title || '').toLowerCase();
  const includes = term => title.includes(String(term).toLowerCase());
  const sourceMatch = !Array.isArray(rule.sourceIds) || rule.sourceIds.includes(item.sourceId || source.id);
  const topicMatch = !Array.isArray(rule.topicFamilies) || rule.topicFamilies.includes(item.topic) || rule.topicFamilies.includes(source.topicFamily);
  const any = Array.isArray(rule.titleAny) ? rule.titleAny : [];
  const all = Array.isArray(rule.titleAll) ? rule.titleAll : [];
  const none = Array.isArray(rule.titleNone) ? rule.titleNone : [];
  return sourceMatch && topicMatch && any.length > 0 && any.some(includes) && all.every(includes) && !none.some(includes);
}

function isSelectableSource(source) {
  return !source || (source.enabled !== false && !source.quarantineReason);
}

function createCandidateSelector(options) {
  const config = options || {};
  const newsPoller = config.newsPoller || null;
  const renderNews = typeof config.renderNews === 'function' ? config.renderNews : null;
  const renderNewsFallback = typeof config.renderNewsFallback === 'function' ? config.renderNewsFallback : null;
  const newsOnly = config.newsOnly === true;
  const renderAmbient = typeof config.renderAmbient === 'function' ? config.renderAmbient : null;
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const maxAgeMs = Number.isSafeInteger(config.maxAgeMs) && config.maxAgeMs > 0 ? config.maxAgeMs : DEFAULT_MAX_AGE_MS;
  const dwellMs = Number.isSafeInteger(config.newsDwellMs) && config.newsDwellMs > 0 ? config.newsDwellMs : NEWS_DWELL_MS;
  const maxItemsPerSource = Number.isSafeInteger(config.maxItemsPerSource) && config.maxItemsPerSource > 0 ? config.maxItemsPerSource : NEWS_MAX_ITEMS_PER_SOURCE;
  const random = typeof config.random === 'function' ? config.random : Math.random;
  let activeNews = null;
  let activeUntil = 0;
  let recentNewsIds = [];
  let recentNewsSources = [];

  function randomValue() {
    const value = Number(random());
    return Number.isFinite(value) && value >= 0 && value < 1 ? value : Math.random();
  }

  function rememberNews(item) {
    if (!item || !item.id) return;
    recentNewsIds = [item.id, ...recentNewsIds.filter(previous => previous !== item.id)].slice(0, NEWS_RANDOM_HISTORY_SIZE);
    if (item.sourceId) recentNewsSources = [item.sourceId, ...recentNewsSources.filter(previous => previous !== item.sourceId)].slice(0, NEWS_RANDOM_SOURCE_HISTORY_SIZE);
  }

  function newsWeight(item, now) {
    const salienceWeight = item.salience === 'high' ? 1.8 : item.salience === 'critical' ? 2.2 : 1;
    const confidenceWeight = 0.75 + (0.25 * Math.max(0, Math.min(1, Number(item.confidence) || 0)));
    const priorityWeight = 0.85 + (0.15 * Math.max(0, Math.min(100, Number(item.basePriority) || 0)) / 100);
    const age = Math.max(0, now - timestampOf(item));
    const freshnessWeight = 1 + (0.25 * Math.max(0, 1 - Math.min(1, age / maxAgeMs)));
    return salienceWeight * confidenceWeight * priorityWeight * freshnessWeight;
  }

  function chooseRandomNews(items, now, excludedId) {
    const eligible = items.filter(item => item.id !== excludedId);
    if (eligible.length === 0) return null;
    const varied = eligible.filter(item => !recentNewsIds.includes(item.id));
    const sourceVaried = varied.filter(item => !item.sourceId || !recentNewsSources.includes(item.sourceId));
    const pool = sourceVaried.length >= Math.min(5, varied.length)
      ? sourceVaried
      : varied.length > 0 ? varied : eligible;
    const weights = pool.map(item => newsWeight(item, now));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!(total > 0)) return pool[Math.floor(randomValue() * pool.length)];
    let cursor = randomValue() * total;
    for (let index = 0; index < pool.length; index++) {
      cursor -= weights[index];
      if (cursor <= 0) return pool[index];
    }
    return pool[pool.length - 1];
  }

  function capBySource(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.sourceId || item.sourceName || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const capped = [];
    for (const group of groups.values()) {
      group.sort((left, right) => timestampOf(right) - timestampOf(left) || (right.basePriority || 0) - (left.basePriority || 0) || String(left.id).localeCompare(String(right.id)));
      capped.push(...group.slice(0, maxItemsPerSource));
    }
    return capped;
  }

  function getNewsCandidates(now, supplied) {
    const items = supplied || (newsPoller && typeof newsPoller.getCandidates === 'function' ? newsPoller.getCandidates() : []);
    const normalized = items.map(item => {
      const source = item.source || sources.find(candidate => candidate.id === item.sourceId) || {};
      const salience = hasTitlePromotion(item, source) ? 'high' : deriveSalience({ ...item, source });
      const quality = evaluateTitle(item.title, { sourceId: item.sourceId, shortTitleExceptions: source.shortTitleExceptions });
      return { ...item, kind: 'news', source, salience, quality, confidence: Number.isFinite(item.confidence) ? item.confidence : (source.trustClass === 'official' ? 0.95 : 0.75) };
    }).filter(item => {
      const timestamp = timestampOf(item);
      return isSelectableSource(item.source) && item.quality.eligible && timestamp > 0 && timestamp <= now && now - timestamp <= maxAgeMs;
    });
    return capBySource(normalized).sort(compareCandidates);
  }

  function wrapNews(item, now) {
    const activity = renderNews ? renderNews(item, now) : item.activity || item;
    return {
      ...item,
      activity,
      allowCooldownOverride: true,
      basePriority: item.basePriority || 0,
      details: activity.details,
      iconKey: activity.smallImageKey || item.iconKey,
      state: activity.state,
    };
  }

  function ambientResult(entry, now) {
    if (!entry) return null;
    const activity = renderAmbient ? renderAmbient(entry, now) : entry.activity || entry;
    return {
      activity,
      allowCooldownOverride: false,
      basePriority: 10,
      details: activity.details,
      id: entry.id || entry.key,
      kind: entry.kind || 'ambient',
      iconKey: activity.smallImageKey || entry.iconKey,
      salience: entry.salience || 'low',
      state: activity.state,
      topic: entry.topic || 'general',
    };
  }

  function select(input, now) {
    const timestamp = Number.isFinite(now) ? now : Date.now();
    const grouped = input && !Array.isArray(input) && (Array.isArray(input.news) || Array.isArray(input.ambient) || Array.isArray(input.system));
    const ambient = grouped ? (input.ambient || input.quiet || [])[0] : input;
    const systems = grouped ? (input.system || input.recovery || []) : [];
    const system = systems.slice().sort((left, right) => (right.priority || 0) - (left.priority || 0))[0];
    if (system) {
      activeNews = null;
      activeUntil = 0;
      return system;
    }

    const available = getNewsCandidates(timestamp, grouped ? input.news : null);
    const activeExpired = Boolean(activeNews && activeUntil <= timestamp);
    let selected = activeNews && !activeExpired ? activeNews : null;
    const next = chooseRandomNews(available, timestamp, activeNews && activeNews.id);
    const best = available.find(item => !activeNews || item.id !== activeNews.id) || null;
    if (!selected && next) {
      selected = wrapNews(next, timestamp);
      activeNews = selected;
      activeUntil = timestamp + dwellMs;
      rememberNews(selected);
    } else if (selected && best && best.id !== selected.id && (best.confidence || 0) > (selected.confidence || 0) && compareCandidates(best, selected) < 0) {
      selected = wrapNews(best, timestamp);
      activeNews = selected;
      activeUntil = timestamp + dwellMs;
      rememberNews(selected);
    } else if (!next && activeExpired) {
      activeNews = null;
      activeUntil = 0;
      selected = null;
    }
    if (selected) return selected;
    if (newsOnly) {
      const activity = renderNewsFallback ? renderNewsFallback(timestamp) : null;
      if (!activity) return null;
      return {
        activity,
        allowCooldownOverride: true,
        basePriority: 20,
        details: activity.details,
        id: 'news:empty',
        kind: 'news',
        iconKey: activity.smallImageKey,
        salience: 'normal',
        state: activity.state,
        topic: 'general',
      };
    }
    return ambientResult(ambient, timestamp);
  }

  function reset() {
    activeNews = null;
    activeUntil = 0;
    recentNewsIds = [];
    recentNewsSources = [];
  }

  return { getActive: () => activeNews, getNewsCandidates: now => getNewsCandidates(Number.isFinite(now) ? now : Date.now()), reset, select };
}

module.exports = { DEFAULT_MAX_AGE_MS, NEWS_DWELL_MS, NEWS_MAX_ITEMS_PER_SOURCE, NEWS_RANDOM_HISTORY_SIZE, createCandidateSelector };
