const fs = require('fs');
const path = require('path');

const { createActivityRenderer } = require('../features/presence/activityRenderer');
const { NEWS_HEADLINE_MAX_GRAPHEMES, NEWS_METADATA_MAX_GRAPHEMES } = require('../features/news/newsQuality');
const { NEWS_MAX_ITEMS_PER_SOURCE } = require('../features/presence/candidateSelector');
const { evaluateTitle, displayWithinBudget } = require('../features/news/newsQuality');
const { normalizeIconMetadata } = require('../features/presence/repetitionPolicy');
const { validateNewsState, mergeNewsItems } = require('../features/news/newsState');

const ROOT = path.join(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'news-state.json');
const CONFIG_PATH = path.join(ROOT, 'data', 'news-sources.json');
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatTimestamp(value) {
  const timestamp = Number.isFinite(value) ? value : Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return 'unknown';
  return new Date(timestamp).toISOString();
}

function parseArgs(argv) {
  const options = { limit: DEFAULT_LIMIT, topic: null, source: null, links: false, quality: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--links') {
      options.links = true;
      continue;
    }
    if (argument === '--quality') {
      options.quality = true;
      continue;
    }
    const match = argument.match(/^--(limit|topic|source)(?:=(.*))?$/);
    if (!match) throw new Error('unknown argument: ' + argument);
    const key = match[1];
    const value = match[2] === undefined ? argv[++index] : match[2];
    if (!value || String(value).startsWith('--')) throw new Error('--' + key + ' requires a value');
    if (key === 'limit') {
      const limit = Number(value);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new Error('--limit must be an integer from 1 through ' + MAX_LIMIT);
      }
      options.limit = limit;
    } else {
      options[key] = String(value).trim().toLowerCase();
      if (!options[key]) throw new Error('--' + key + ' must not be empty');
    }
  }
  return options;
}

function loadPreviewState(now) {
  if (!fs.existsSync(CACHE_PATH)) return null;
  const raw = readJson(CACHE_PATH);
  const validation = validateNewsState(raw);
  if (!validation.ok) throw new Error('news cache is invalid: ' + validation.errors.join('; '));
  const config = readJson(CONFIG_PATH);
  return {
    cache: mergeNewsItems(raw, [], { now, maxAgeMs: config.maxAgeMs }),
    sourceById: new Map((config.sources || []).map(source => [source.id, source])),
    cacheUpdatedAt: raw.updatedAt,
    lastPollAt: raw.lastPollAt,
    lastSuccessAt: raw.lastSuccessAt,
  };
}

function isSelectableSource(item, sourceById) {
  if (!sourceById || sourceById.size === 0) return true;
  const source = sourceById.get(item.sourceId);
  return !source || (source.enabled !== false && !source.quarantineReason);
}

function selectItems(items, options, sourceById) {
  return items
    .filter(item => isSelectableSource(item, sourceById))
    .filter(item => !options.topic || String(item.topic).toLowerCase() === options.topic)
    .filter(item => !options.source || [item.sourceId, item.sourceName].some(value => String(value).toLowerCase().includes(options.source)))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, options.limit);
}

function projectActiveItems(items, limit) {
  const groups = new Map();
  for (const item of items) {
    const key = item.sourceId || item.sourceName || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.values()).flatMap(group => group
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || String(left.id).localeCompare(String(right.id)))
    .slice(0, limit));
}

function formatQuality(result) {
  if (!result) return 'Local Rich Presence news quality audit\n\nNo local news cache exists yet.';
  const storedItems = result.cache.items;
  if (storedItems.length === 0) {
    return [
      'Local Rich Presence news quality audit',
      '',
      'The local news cache is empty after applying the current 24-hour freshness policy.',
      'No selectable, eligible, or projected items are available.',
    ].join('\n');
  }
  const items = storedItems.filter(item => isSelectableSource(item, result.sourceById));
  const classified = items.map(item => ({ item, quality: evaluateTitle(item.title, { sourceId: item.sourceId }) }));
  const reasonCounts = {};
  let eligible = 0;
  let overBudget = 0;
  for (const entry of classified) {
    reasonCounts[entry.quality.reason] = (reasonCounts[entry.quality.reason] || 0) + 1;
    if (entry.quality.eligible) eligible++;
    if (!displayWithinBudget(entry.quality.displayTitle || entry.item.title, NEWS_HEADLINE_MAX_GRAPHEMES, 128)) overBudget++;
  }
  const projected = projectActiveItems(classified.filter(entry => entry.quality.eligible).map(entry => entry.item), NEWS_MAX_ITEMS_PER_SOURCE);
  const sourceCounts = {};
  for (const item of projected) sourceCounts[item.sourceName || item.sourceId || 'unknown'] = (sourceCounts[item.sourceName || item.sourceId || 'unknown'] || 0) + 1;
  const reasons = Object.entries(reasonCounts).sort(([left], [right]) => left.localeCompare(right));
  const examples = classified.filter(entry => !entry.quality.eligible).slice(0, 10);
  const lines = [
    'Local Rich Presence news quality audit',
    'Cache items: ' + storedItems.length,
    'Selectable items: ' + items.length,
    'Excluded disabled/quarantined: ' + (storedItems.length - items.length),
    'Eligible: ' + eligible,
    'Rejected: ' + (items.length - eligible),
    'Over budget: ' + overBudget + ' (headline ' + NEWS_HEADLINE_MAX_GRAPHEMES + ' graphemes; field 128 bytes)',
    'Projected active pool: ' + projected.length + ' (max ' + NEWS_MAX_ITEMS_PER_SOURCE + ' per source)',
    'Reason counts: ' + (reasons.length ? reasons.map(([reason, count]) => reason + '=' + count).join(', ') : 'none'),
    'Source concentration: ' + (Object.keys(sourceCounts).length ? Object.entries(sourceCounts).sort(([, left], [, right]) => right - left).slice(0, 10).map(([source, count]) => source + '=' + count).join(', ') : 'none'),
    'Examples: ' + (examples.length ? '' : 'none'),
  ];
  for (const { item, quality } of examples) lines.push('- ' + (item.sourceName || item.sourceId) + ': ' + item.title + ' [' + quality.reason + ']');
  return lines.join('\n');
}

function createRenderer() {
  const registry = readJson(path.join(ROOT, 'data', 'icon-registry.json'));
  const overrides = readJson(path.join(ROOT, 'data', 'icon-role-overrides.json'));
  return createActivityRenderer({
    iconMetadata: normalizeIconMetadata(registry, overrides),
    largeImageText: 'Skarn Warmaster',
  });
}

function formatPreview(result, options, now) {
  if (!result) return 'Local Rich Presence news preview\n\nNo local news cache exists yet.';
  if (options.quality) return formatQuality(result);
  const items = selectItems(result.cache.items, options, result.sourceById);
  const filter = [options.topic && 'topic=' + options.topic, options.source && 'source~' + options.source].filter(Boolean).join(', ');
  const lines = [
    'Local Rich Presence news preview',
    'Cache: ' + result.cache.items.length + ' valid items',
    'Cache updated: ' + formatTimestamp(result.cacheUpdatedAt),
    'Last poll: ' + formatTimestamp(result.lastPollAt),
    'Last success: ' + formatTimestamp(result.lastSuccessAt),
    'Showing: ' + items.length + (filter ? ' (' + filter + ')' : ' newest'),
    '',
  ];
  if (result.cache.items.length === 0) {
    lines.push('No fresh cached items are available within the current 24-hour freshness policy.');
    return lines.join('\n');
  }
  if (items.length === 0) {
    lines.push('No cached items match the requested filter.');
    return lines.join('\n');
  }
  const renderer = createRenderer();
  items.forEach((item, index) => {
    const activity = renderer.renderNews(item, now);
    lines.push(String(index + 1).padStart(2, '0') + '.');
    lines.push(activity.details);
    lines.push(activity.state);
    if (options.links) lines.push(item.canonicalUrl);
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

function usage() {
  return [
    'Usage: node scripts/preview-news.js [--limit N] [--topic NAME] [--source TEXT] [--links] [--quality]',
    'Default: show the 10 newest cached items using the exact Discord details/state renderer.',
    'Maximum: 50 items per preview. --quality audits the cache without polling or writing.',
  ].join('\n');
}

function main(argv) {
  const options = parseArgs(argv);
  const now = Date.now();
  console.log(formatPreview(loadPreviewState(now), options, now));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error('News preview failed: ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  formatPreview,
  loadPreviewState,
  parseArgs,
  selectItems,
};
