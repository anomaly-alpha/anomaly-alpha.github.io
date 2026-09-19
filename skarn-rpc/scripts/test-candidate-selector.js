const assert = require('assert');
const fs = require('fs');
const { createCandidateSelector } = require('../features/presence/candidateSelector');
const { createActivityRenderer } = require('../features/presence/activityRenderer');
const { normalizeIconMetadata } = require('../features/presence/repetitionPolicy');

const publishedAt = new Date(1700000000000).toISOString();
const news = {
  id: 'news-1',
  title: 'A release arrives',
  topic: 'release',
  salience: 'normal',
  basePriority: 80,
  sourceName: 'Official feed',
  publishedAt,
};
let candidates = [news];
const selector = createCandidateSelector({
  newsDwellMs: 180000,
  newsPoller: { getCandidates: () => candidates },
  renderNews: item => ({ details: 'News · ' + item.title, state: 'Watching · 1m · ' + item.sourceName }),
});
const ambient = { activity: { details: 'Ambient', state: 'Quiet' }, id: 'ambient-1', kind: 'ambient', priority: 10 };
const first = selector.select(ambient, 1700000000000);
assert.strictEqual(first.kind, 'news');
assert.strictEqual(first.activity.details, 'News · A release arrives');
const duringDwell = selector.select(ambient, 1700000000000 + 120000);
assert.strictEqual(duringDwell.id, 'news-1');
candidates = [];
const afterDwell = selector.select(ambient, 1700000000000 + 240000);
assert.strictEqual(afterDwell.kind, 'ambient');

const newsOnlySelector = createCandidateSelector({
  newsOnly: true,
  newsPoller: { getCandidates: () => [] },
  renderNewsFallback: () => ({ details: 'News mode · No fresh items', state: 'Approved feeds · awaiting fresh signal', smallImageKey: 'skarn_eye' }),
});
const noFreshNews = newsOnlySelector.select(ambient, 1700000000000);
assert.strictEqual(noFreshNews.kind, 'news');
assert.strictEqual(noFreshNews.activity.details, 'News mode · No fresh items');

const iconRegistry = JSON.parse(fs.readFileSync('data/icon-registry.json', 'utf8'));
const iconOverrides = JSON.parse(fs.readFileSync('data/icon-role-overrides.json', 'utf8'));
const reactions = JSON.parse(fs.readFileSync('data/news-reactions.json', 'utf8'));
const renderer = createActivityRenderer({
  iconMetadata: normalizeIconMetadata(iconRegistry, iconOverrides),
  reactions,
});
const rendered = renderer.renderNews({
  id: 'news-rendered',
  title: 'A deliberately long headline that must remain factual while fitting on one compact Discord line without swallowing the source',
  topic: 'release',
  salience: 'normal',
  sourceName: 'Official feed',
  publishedAt,
}, 1700000060000);
assert(Buffer.byteLength(rendered.details, 'utf8') <= 128);
assert(Buffer.byteLength(rendered.state, 'utf8') <= 128);
assert(rendered.state.includes('Official feed'));
assert(rendered.state.includes('1m'));
assert(rendered.smallImageKey);

let competing = [{ ...news, id: 'ordinary', confidence: 0.5, salience: 'normal' }];
const confidenceSelector = createCandidateSelector({
  newsDwellMs: 180000,
  newsPoller: { getCandidates: () => competing },
  renderNews: item => ({ details: 'News · ' + item.title, state: 'Reaction · 1m · ' + item.sourceName }),
});
confidenceSelector.select(ambient, 1700000000000);
competing = [{ ...news, id: 'stronger', title: 'Breaking release arrives', confidence: 0.99, salience: 'high' }];
assert.strictEqual(confidenceSelector.select(ambient, 1700000000001).id, 'stronger');

const recovery = selector.select({
  system: [{ id: 'recovery', kind: 'recovery', priority: 100, activity: { details: 'Discord restored', state: 'Presence resumes' } }],
  ambient: [ambient],
  news: [],
}, 1700000000002);
assert.strictEqual(recovery.id, 'recovery');
console.log('candidate selector tests passed');
