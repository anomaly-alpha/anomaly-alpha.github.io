const {
  deriveSalience,
  selectIconForTopic,
  selectTopicFamily,
} = require('./repetitionPolicy');
const {
  NEWS_FIELD_MAX_BYTES,
  NEWS_HEADLINE_MAX_GRAPHEMES,
  NEWS_METADATA_MAX_GRAPHEMES,
  compactTitle,
  evaluateTitle,
  graphemes,
  normalizeTitle,
} = require('../news/newsQuality');

const MAX_LINE_BYTES = 128;
const NEWS_HEADLINE_MAX_CHARS = NEWS_HEADLINE_MAX_GRAPHEMES;
const NEWS_METADATA_MAX_CHARS = NEWS_METADATA_MAX_GRAPHEMES;
const TOPIC_LABELS = Object.freeze({
  ai: 'AI',
  games: 'Games',
  release: 'Release',
  science: 'Science',
  space: 'Space',
  general: 'News',
});

function truncateUtf8(value, maxBytes) {
  const text = String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  const suffix = '…';
  let output = '';
  for (const grapheme of graphemes(text)) {
    if (Buffer.byteLength(output + grapheme + suffix, 'utf8') > maxBytes) break;
    output += grapheme;
  }
  return output ? output + suffix : graphemes(text)[0] || '';
}

function truncateVisible(value, maxChars, maxBytes = MAX_LINE_BYTES) {
  const text = normalizeTitle(value);
  const compact = compactTitle(text, { maxGraphemes: maxChars });
  return truncateUtf8(compact || text, maxBytes);
}

function formatAge(publishedAt, now) {
  const timestamp = Date.parse(String(publishedAt || ''));
  if (!Number.isFinite(timestamp)) return 'new';
  const elapsed = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h';
  return Math.floor(hours / 24) + 'd';
}

function compactNewsState(topic, age, source) {
  const label = TOPIC_LABELS[topic] || TOPIC_LABELS.general;
  const sourceLabel = truncateVisible(source || 'source', 24, NEWS_FIELD_MAX_BYTES);
  return truncateVisible(label + ' · ' + sourceLabel + ' · ' + age, NEWS_METADATA_MAX_GRAPHEMES, NEWS_FIELD_MAX_BYTES);
}

function createActivityRenderer(options) {
  const config = options || {};
  const iconMetadata = Array.isArray(config.iconMetadata) ? config.iconMetadata : [];
  const largeImageKey = config.largeImageKey || 'skarn_logo';
  const largeImageText = config.largeImageText || 'Skarn Bot';

  function assets(icon, startTimestamp) {
    return {
      largeImageKey,
      largeImageText,
      smallImageKey: icon ? icon.key : 'skarn_eye',
      smallImageText: icon ? (icon.tooltip || icon.label || icon.key) : 'Watching',
      instance: false,
      type: 0,
      startTimestamp,
    };
  }

  function renderAmbient(entry, startTimestamp) {
    const icon = iconMetadata.find(candidate => candidate.key === (entry.key || entry.iconKey || entry.smallImageKey)) || entry;
    return {
      details: truncateUtf8(entry.details, MAX_LINE_BYTES),
      state: truncateUtf8(entry.state, MAX_LINE_BYTES),
      ...assets(icon, startTimestamp),
    };
  }

  function renderNews(item, now) {
    const topic = selectTopicFamily(item);
    const salience = deriveSalience(item);
    const source = item.sourceName || item.sourceId || 'source';
    const age = formatAge(item.publishedAt || item.updatedAt, now);
    const icon = selectIconForTopic(iconMetadata, topic, salience, { seed: item.id, newsOnly: true });
    const quality = evaluateTitle(item.title, { sourceId: item.sourceId });
    return {
      details: truncateVisible(quality.displayTitle || item.title, NEWS_HEADLINE_MAX_GRAPHEMES, NEWS_FIELD_MAX_BYTES),
      state: compactNewsState(topic, age, source),
      ...assets(icon, item.startTimestamp || config.startTimestamp || new Date(now)),
    };
  }

  function renderSystem(details, state, iconKey, startTimestamp) {
    const icon = iconMetadata.find(candidate => candidate.key === iconKey) || iconMetadata[0];
    return {
      details: truncateUtf8(details, MAX_LINE_BYTES),
      state: truncateUtf8(state, MAX_LINE_BYTES),
      ...assets(icon, startTimestamp),
    };
  }

  return { renderAmbient, renderNews, renderSystem };
}

function renderActivity(candidate, options) {
  const config = options || {};
  const renderer = createActivityRenderer(config);
  const now = Number.isFinite(config.now) ? config.now : Date.now();
  if (candidate && candidate.kind === 'news') return renderer.renderNews(candidate, now);
  if (candidate && ['system', 'recovery', 'failure'].includes(candidate.kind)) {
    return renderer.renderSystem(candidate.details || 'Presence state', candidate.state || 'Standing by', candidate.iconKey, candidate.startTimestamp || config.startTimestamp);
  }
  return renderer.renderAmbient({ ...candidate, key: candidate && (candidate.key || candidate.iconKey || candidate.smallImageKey) }, candidate && candidate.startTimestamp || config.startTimestamp);
}

module.exports = {
  MAX_LINE_BYTES,
  NEWS_HEADLINE_MAX_GRAPHEMES,
  NEWS_METADATA_MAX_GRAPHEMES,
  NEWS_HEADLINE_MAX_CHARS,
  NEWS_METADATA_MAX_CHARS,
  compactNewsState,
  createActivityRenderer,
  formatAge,
  renderActivity,
  truncateUtf8,
  truncateVisible,
};
