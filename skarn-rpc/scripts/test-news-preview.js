const assert = require('assert/strict');

const { NEWS_HEADLINE_MAX_CHARS, NEWS_METADATA_MAX_CHARS } = require('../features/presence/activityRenderer');
const { graphemeCount } = require('../features/news/newsQuality');
const { formatPreview, parseArgs, selectItems } = require('./preview-news');

const NOW = Date.parse('2026-09-20T13:43:00.000Z');
const STORY = {
  id: 'preview-story',
  title: 'A deliberately long headline that must remain factual while fitting on a compact mobile Discord line',
  canonicalUrl: 'https://example.test/story',
  sourceId: 'official-feed',
  sourceName: 'Official feed',
  publishedAt: '2026-09-20T13:42:00.000Z',
  updatedAt: '2026-09-20T13:42:00.000Z',
  fetchedAt: '2026-09-20T13:42:30.000Z',
  topic: 'release',
  confidence: 0.95,
  basePriority: 80,
  salience: 'normal',
  iconRole: 'movement',
  safetyDecision: 'accepted',
};
const DISABLED_STORY = { ...STORY, id: 'disabled-story', sourceId: 'quarantined-feed', sourceName: 'Quarantined feed' };

function testArguments() {
  assert.deepEqual(parseArgs([]), { limit: 10, topic: null, source: null, links: false, quality: false });
  assert.deepEqual(parseArgs(['--limit', '4', '--topic=release', '--source', 'official', '--links', '--quality']), {
    limit: 4, topic: 'release', source: 'official', links: true, quality: true,
  });
  assert.throws(() => parseArgs(['--all']), /unknown argument/);
  assert.throws(() => parseArgs(['--limit', '51']), /--limit must be an integer/);
  assert.throws(() => parseArgs(['--topic', '--links']), /--topic requires a value/);
  assert.throws(() => parseArgs(['--source=--quality']), /--source requires a value/);
  assert.throws(() => parseArgs(['--unexpected']), /unknown argument/);
}

function testSelection() {
  const other = { ...STORY, id: 'other', sourceId: 'other-feed', sourceName: 'Other feed', topic: 'science' };
  assert.equal(selectItems([STORY, other], parseArgs(['--topic', 'release'])).length, 1);
  assert.equal(selectItems([STORY, other], parseArgs(['--source', 'official'])).length, 1);
  assert.equal(selectItems([STORY, DISABLED_STORY], parseArgs([]), new Map([
    ['official-feed', { id: 'official-feed', enabled: true }],
    ['quarantined-feed', { id: 'quarantined-feed', enabled: false, quarantineReason: 'TIMEOUT' }],
  ])).length, 1);
}

function testFormatting() {
  const result = {
    cache: { items: [STORY, DISABLED_STORY], updatedAt: NOW, lastPollAt: NOW, lastSuccessAt: NOW },
    sourceById: new Map([
      ['official-feed', { id: 'official-feed', enabled: true }],
      ['quarantined-feed', { id: 'quarantined-feed', enabled: false, quarantineReason: 'TIMEOUT' }],
    ]),
    cacheUpdatedAt: NOW,
    lastPollAt: NOW,
    lastSuccessAt: NOW,
  };
  const output = formatPreview(result, parseArgs([]), NOW);
  const lines = output.split('\n');
  const details = lines.find(line => line.startsWith('A deliberately'));
  const state = lines.find(line => line.startsWith('Release ·'));
  assert(details);
  assert(state);
  assert(Array.from(details).length <= NEWS_HEADLINE_MAX_CHARS);
  assert(Array.from(state).length <= NEWS_METADATA_MAX_CHARS);
  assert(graphemeCount(details) <= NEWS_HEADLINE_MAX_CHARS);
  assert(graphemeCount(state) <= NEWS_METADATA_MAX_CHARS);
  assert(Buffer.byteLength(details, 'utf8') <= 128);
  assert(Buffer.byteLength(state, 'utf8') <= 128);
  assert(!output.includes('The gears have received'));
  assert(!output.includes(STORY.canonicalUrl));
  assert(formatPreview(result, parseArgs(['--links']), NOW).includes(STORY.canonicalUrl));
  const quality = formatPreview(result, parseArgs(['--quality']), NOW);
  assert(quality.includes('Projected active pool:'));
  assert(quality.includes('Excluded disabled/quarantined: 1'));
  assert(formatPreview({ ...result, cache: { ...result.cache, items: [] } }, parseArgs([]), NOW).includes('No fresh cached items are available'));
  assert(formatPreview({ ...result, cache: { ...result.cache, items: [] } }, parseArgs(['--quality']), NOW).includes('cache is empty'));
  assert(formatPreview(null, parseArgs([]), NOW).includes('No local news cache exists yet.'));
}

testArguments();
testSelection();
testFormatting();
console.log('news preview tests passed: shared renderer, limits, filters, links, and empty-cache behavior');
