const { compareCandidates, deriveSalience } = require('./repetitionPolicy');

const NEWS_DWELL_MS = 3 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

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
  let activeNews = null;
  let activeUntil = 0;

  function getNewsCandidates(now, supplied) {
    const items = supplied || (newsPoller && typeof newsPoller.getCandidates === 'function' ? newsPoller.getCandidates() : []);
    return items.map(item => {
      const source = item.source || sources.find(candidate => candidate.id === item.sourceId) || {};
      const salience = hasTitlePromotion(item, source) ? 'high' : deriveSalience({ ...item, source });
      return { ...item, kind: 'news', source, salience, confidence: Number.isFinite(item.confidence) ? item.confidence : (source.trustClass === 'official' ? 0.95 : 0.75) };
    }).filter(item => {
      const timestamp = timestampOf(item);
      return timestamp > 0 && timestamp <= now && now - timestamp <= maxAgeMs;
    }).sort(compareCandidates);
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
    const best = available.find(item => !activeExpired || !activeNews || item.id !== activeNews.id) || null;
    if (!selected && best) {
      selected = wrapNews(best, timestamp);
      activeNews = selected;
      activeUntil = timestamp + dwellMs;
    } else if (selected && best && best.id !== selected.id && (best.confidence || 0) > (selected.confidence || 0) && compareCandidates(best, selected) < 0) {
      selected = wrapNews(best, timestamp);
      activeNews = selected;
      activeUntil = timestamp + dwellMs;
    } else if (!best && activeExpired) {
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
  }

  return { getActive: () => activeNews, reset, select };
}

module.exports = { DEFAULT_MAX_AGE_MS, NEWS_DWELL_MS, createCandidateSelector };
