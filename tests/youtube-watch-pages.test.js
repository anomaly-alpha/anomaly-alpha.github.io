'use strict';

// =====================================================================
// tests/youtube-watch-pages.test.js
// Verifies per-video watch pages: VideoObject shape, uploadDate format,
// SEO head tags, one-video-per-page, sitemap coverage and link integrity.
// Node assert + temporary directories. No external test framework.
// =====================================================================

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');

var gen = require('../scripts/generate-youtube-creators');
var watch = require('../scripts/generate-watch-pages');

// ===== HARNESS =====

var passed = 0;
var failed = 0;
var errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failed++;
    errors.push(name + ': ' + err.message);
    console.log('  \u2717 ' + name);
    console.log('    ' + err.message);
  }
}

// ===== FIXTURES =====

var _seq = 0;

function nextVideoId() {
  _seq++;
  return 'W' + String(_seq).padStart(10, '0');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function makeVideo(overrides) {
  var id = nextVideoId();
  var video = {
    id: id,
    title: 'Test Video ' + id,
    description: 'A description for ' + id + ' covering Invincible Guarding the Globe gameplay.',
    category: 'Guides',
    published: daysAgo(3),
    lastChecked: today(),
    status: 'active',
    featured: true,
    sourceUrl: 'https://www.youtube.com/watch?v=' + id,
    canonicalUrl: 'https://www.youtube.com/watch?v=' + id,
    evidenceNote: 'Evidence for ' + id + '.',
    statusReason: ''
  };
  Object.keys(overrides || {}).forEach(function (k) { video[k] = overrides[k]; });
  return video;
}

function makeCreator(id, displayOrder, videoOverrides) {
  var videos = [];
  for (var i = 0; i < 6; i++) {
    var merged = { published: daysAgo(2 + i * 3) };
    if (videoOverrides && videoOverrides[i]) {
      Object.keys(videoOverrides[i]).forEach(function (k) { merged[k] = videoOverrides[i][k]; });
    }
    videos.push(makeVideo(merged));
  }
  return {
    id: id,
    name: 'Creator ' + id,
    handle: '@' + id,
    channelUrl: 'https://www.youtube.com/@' + id,
    description: 'Description for ' + id + '.',
    tags: ['Guides'],
    status: 'active',
    displayOrder: displayOrder,
    lastChecked: today(),
    feedLastChecked: today(),
    videos: videos,
    channelId: 'UC' + 'a'.repeat(22),
    sourceUrl: 'https://www.youtube.com/@' + id
  };
}

// Minimal provenance records that satisfy validateData without cross-referencing creators.
function makeCandidateSources() {
  return [{
    sourceUrl: 'https://www.youtube.com/@fixture-channel',
    kind: 'channel',
    lastChecked: today(),
    resolutionStatus: 'unresolved',
    resolvedCreatorId: null,
    statusReason: 'Fixture record, not resolved to a creator.'
  }];
}

function makeOgImageSources() {
  return [{
    sourceUrl: 'https://example.com/fixture-og.png',
    license: 'CC0',
    attribution: 'Fixture attribution',
    lastChecked: today()
  }];
}

function makeData(creators) {
  return {
    updated: today(),
    contentMaintainer: 'Anomaly',
    reviewCadenceDays: 90,
    featuredCreatorId: creators[0].id,
    candidateSources: makeCandidateSources(),
    ogImageSources: makeOgImageSources(),
    creators: creators
  };
}

function makeTempRoot(data) {
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-watch-test-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'youtube-creators.json'), JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(root, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n  ' + watch.SITEMAP_START + '\n  ' + watch.SITEMAP_END + '\n</urlset>\n',
    'utf8'
  );
  return root;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function pageGraph(html) {
  var m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'page should contain ld+json');
  var raw = m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<\\\//g, '</');
  return JSON.parse(raw);
}

// =====================================================================
// DATETIME
// =====================================================================

console.log('\nDatetime tests:');

test('toIsoDateTime adds a UTC offset to date-only input', function () {
  assert.strictEqual(gen.toIsoDateTime('2026-10-31'), '2026-10-31T00:00:00+00:00');
});

test('toIsoDateTime rejects malformed input', function () {
  assert.strictEqual(gen.toIsoDateTime('31-10-2026'), '');
  assert.strictEqual(gen.toIsoDateTime(''), '');
  assert.strictEqual(gen.toIsoDateTime(null), '');
});

test('buildVideoObject emits a timezone-qualified uploadDate', function () {
  var creator = makeCreator('c1', 1).name;
  var video = makeVideo({ published: '2026-10-31' });
  var vo = gen.buildVideoObject(video, { name: creator, channelUrl: 'https://www.youtube.com/@c1' });
  assert.strictEqual(vo.uploadDate, '2026-10-31T00:00:00+00:00', 'uploadDate must carry an offset');
  assert.ok(!/\d{4}-\d{2}-\d{2}$/.test(vo.uploadDate), 'must not be a bare date');
});

test('buildVideoObject satisfies Google required properties', function () {
  var video = makeVideo();
  var vo = gen.buildVideoObject(video, { name: 'C', channelUrl: 'https://www.youtube.com/@c' });
  assert.ok(vo.name, 'name required');
  assert.ok(vo.thumbnailUrl, 'thumbnailUrl required');
  assert.ok(vo.uploadDate, 'uploadDate required');
  assert.strictEqual(vo['@type'], 'VideoObject');
  assert.ok(vo.embedUrl.indexOf('youtube-nocookie.com/embed/' + video.id) !== -1, 'privacy-enhanced embedUrl');
});

test('buildVideoObject omits contentUrl instead of declaring a page URL as media', function () {
  var vo = gen.buildVideoObject(makeVideo(), { name: 'C', channelUrl: 'https://www.youtube.com/@c' });
  assert.strictEqual(vo.contentUrl, undefined, 'contentUrl must not be the watch page URL');
});

// =====================================================================
// WATCH PAGE RENDERING
// =====================================================================

console.log('\nWatch page rendering tests:');

test('watch page declares exactly one VideoObject', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var html = watch.renderPage(data, data.creators[0].videos[0], data.creators[0]);
  assert.strictEqual((html.match(/"@type": "VideoObject"/g) || []).length, 1, 'only one video per watch page');
});

test('watch page wires WebPage.mainEntity to its VideoObject', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var graph = pageGraph(watch.renderPage(data, data.creators[0].videos[0], data.creators[0]));
  var page = graph['@graph'].find(function (n) { return n['@type'] === 'WebPage'; });
  var vo = graph['@graph'].find(function (n) { return n['@type'] === 'VideoObject'; });
  assert.ok(page && vo, 'both nodes present');
  assert.strictEqual(page.mainEntity['@id'], vo['@id'], 'mainEntity must reference the video');
});

test('watch page player is present at load without user interaction', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var html = watch.renderPage(data, data.creators[0].videos[0], data.creators[0]);
  assert.ok(/<iframe[\s\S]*?loading="eager"/.test(html), 'iframe must load eagerly, not behind a facade');
  assert.ok(html.indexOf('youtube-nocookie.com/embed/') !== -1, 'privacy-enhanced embed');
  assert.ok(!/script\.js/.test(html), 'watch pages must not depend on script.js');
});

test('watch page has canonical, h1, breadcrumb and video metadata tags', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var video = data.creators[0].videos[0];
  var html = watch.renderPage(data, video, data.creators[0]);
  assert.ok(html.indexOf('<link rel="canonical" href="' + gen.watchPageUrl(video) + '">') !== -1, 'self canonical');
  assert.ok(/<h1[^>]*>/.test(html), 'h1 present');
  assert.ok(html.indexOf('gem-breadcrumb') !== -1, 'breadcrumb present');
  assert.ok(html.indexOf('og:type" content="video.other"') !== -1, 'og:type video');
  assert.ok(html.indexOf('og:video:url') !== -1, 'og:video tags');
  assert.ok(html.indexOf('"@type": "BreadcrumbList"') !== -1, 'BreadcrumbList schema');
});

test('watch page links back to the directory and its creator', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var creator = data.creators[0];
  var html = watch.renderPage(data, creator.videos[0], creator);
  assert.ok(html.indexOf('../../guide/creators/') !== -1, 'links to creator directory');
  assert.ok(html.indexOf(creator.channelUrl) !== -1, 'links to the creator channel');
});

test('HTML escaping applies to titles and descriptions', function () {
  var data = makeData([makeCreator('c1', 1, [{ title: '<script>alert(1)</script>', description: '"><img src=x>' }])]);
  var html = watch.renderPage(data, data.creators[0].videos[0], data.creators[0]);
  assert.ok(html.indexOf('<script>alert(1)</script>') === -1, 'title must be escaped');
  assert.ok(html.indexOf('<img src=x>') === -1, 'description must be escaped');
});

// =====================================================================
// META UNIQUENESS
// =====================================================================

console.log('\nMeta uniqueness tests:');

test('duplicate titles are disambiguated with the publish date', function () {
  var data = makeData([
    makeCreator('c1', 1, [{ title: 'Same Title', published: daysAgo(5) }, { title: 'Same Title', published: daysAgo(9) }])
  ]);
  var items = gen.getVisibleFeedItems(data);
  var meta = watch.assignUniqueMeta(items);
  var titles = items.map(function (i) { return meta[i.video.id].title; });
  assert.strictEqual(new Set(titles).size, titles.length, 'every title tag must be unique');
});

test('duplicate descriptions are disambiguated', function () {
  var data = makeData([
    makeCreator('c1', 1, [{ description: 'Identical description.' }, { description: 'Identical description.' }])
  ]);
  var items = gen.getVisibleFeedItems(data);
  var meta = watch.assignUniqueMeta(items);
  var descs = items.map(function (i) { return meta[i.video.id].description; });
  assert.strictEqual(new Set(descs).size, descs.length, 'every meta description must be unique');
});

test('meta descriptions stay within a sane length', function () {
  var long = 'x'.repeat(400);
  var data = makeData([makeCreator('c1', 1, [{ description: long }])]);
  var meta = watch.assignUniqueMeta(gen.getVisibleFeedItems(data));
  var out = meta[data.creators[0].videos[0].id].description;
  assert.ok(out.length <= 160, 'should be trimmed, got ' + out.length);
});

// =====================================================================
// GENERATION + SITEMAP
// =====================================================================

console.log('\nGeneration tests:');

test('generate writes one directory per visible video plus a hub', function () {
  var data = makeData([makeCreator('c1', 1), makeCreator('c2', 2)]);
  var root = makeTempRoot(data);
  try {
    var out = watch.generate(root);
    assert.ok(out.success, out.errors.join('; '));
    assert.strictEqual(out.written, 12, '6 videos x 2 creators');
    assert.ok(fs.existsSync(path.join(root, 'watch', 'index.html')), 'hub written');
    data.creators[0].videos.forEach(function (v) {
      assert.ok(fs.existsSync(path.join(root, 'watch', v.id, 'index.html')), 'watch page for ' + v.id);
    });
  } finally {
    cleanup(root);
  }
});

test('generate prunes watch pages for removed videos', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var root = makeTempRoot(data);
  try {
    fs.mkdirSync(path.join(root, 'watch'), { recursive: true });
    fs.writeFileSync(path.join(root, 'watch', watch.WATCH_CSS), '/* fixture */', 'utf8');

    watch.generate(root);
    var stale = path.join(root, 'watch', 'ZZZZZZZZZZZ');
    fs.mkdirSync(stale, { recursive: true });
    fs.writeFileSync(path.join(stale, 'index.html'), 'stale', 'utf8');

    var out = watch.generate(root);
    assert.ok(out.removed.indexOf('ZZZZZZZZZZZ') !== -1, 'stale directory reported');
    assert.ok(!fs.existsSync(stale), 'stale directory deleted');
    assert.ok(fs.existsSync(path.join(root, 'watch', watch.WATCH_CSS)), 'stylesheet preserved');
    assert.ok(fs.existsSync(path.join(root, 'watch', 'index.html')), 'hub preserved');
  } finally {
    cleanup(root);
  }
});

test('generate is idempotent', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var root = makeTempRoot(data);
  try {
    watch.generate(root);
    var first = fs.readFileSync(path.join(root, 'watch', data.creators[0].videos[0].id, 'index.html'), 'utf8');
    var firstSitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    watch.generate(root);
    var second = fs.readFileSync(path.join(root, 'watch', data.creators[0].videos[0].id, 'index.html'), 'utf8');
    var secondSitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    assert.strictEqual(first, second, 'page output should be stable');
    assert.strictEqual(firstSitemap, secondSitemap, 'sitemap should be stable');
  } finally {
    cleanup(root);
  }
});

test('sitemap lists the hub and every watch page exactly once', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var root = makeTempRoot(data);
  try {
    watch.generate(root);
    var xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    var locs = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
    assert.strictEqual(locs.length, 7, 'hub + 6 videos');
    var watchLocs = locs.filter(function (l) { return l.indexOf('/watch/') !== -1; });
    assert.strictEqual(watchLocs.length, 7, 'all watch URLs present');
    assert.strictEqual(new Set(watchLocs).size, 7, 'no duplicates');
    assert.ok(watchLocs.some(function (l) { return l.indexOf('/watch/</loc>') !== -1; }), 'hub listed');
  } finally {
    cleanup(root);
  }
});

test('sitemap update fails loudly without markers', function () {
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-watch-sitemap-'));
  try {
    var sitemapPath = path.join(root, 'sitemap.xml');
    fs.writeFileSync(sitemapPath, '<?xml version="1.0"?><urlset></urlset>', 'utf8');
    assert.throws(function () {
      watch.updateSitemap(sitemapPath, { updated: today(), creators: [] });
    }, /markers/, 'should throw when markers are missing');
  } finally {
    cleanup(root);
  }
});

// =====================================================================
// RELATED VIDEO SELECTION
// =====================================================================

console.log('\nRelated video tests:');

test('same-creator selection excludes the current video', function () {
  var data = makeData([makeCreator('c1', 1)]);
  var creator = data.creators[0];
  var current = creator.videos[0];
  var related = watch.sameCreatorVideos(data, current, creator);
  assert.ok(related.every(function (v) { return v.id !== current.id; }), 'current video excluded');
  assert.ok(related.length <= 5, 'respects the cap');
});

test('same-category selection only returns matching categories', function () {
  var data = makeData([
    makeCreator('c1', 1, [{ category: 'Events' }, { category: 'Guides' }, { category: 'Events' }])
  ]);
  var items = gen.getVisibleFeedItems(data);
  var current = items.filter(function (i) { return i.video.category === 'Events'; })[0].video;
  var related = watch.sameCategoryVideos(items, current);
  assert.ok(related.every(function (i) { return i.video.category === 'Events'; }), 'only same category');
  assert.ok(related.every(function (i) { return i.video.id !== current.id; }), 'current excluded');
});

// =====================================================================
// SUMMARY
// =====================================================================

console.log('\n========================================');
console.log(passed + failed + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('\nFailed tests:');
  errors.forEach(function (e) { console.log('  - ' + e); });
  process.exit(1);
}
console.log('All tests passed.');
