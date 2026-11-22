'use strict';

// =====================================================================
// tests/event-timeline.test.js
// Burst detection, labelling, rendering and freshness wiring for
// scripts/generate-event-timeline.js. Fixtures are synthetic; one
// section checks the committed output against the live dataset.
// =====================================================================

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var timeline = require('../scripts/generate-event-timeline');

var ROOT = path.resolve(__dirname, '..');

var passed = 0;
var failed = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failed++;
    failures.push({ name: name, message: err.message });
    console.log('  \u2717 ' + name);
  }
}

function section(name) {
  console.log('\n' + name + ':');
}

// ===== FIXTURES =====

var videoSeq = 0;

function makeVideo(title, published, category, description) {
  videoSeq++;
  return {
    id: 'V' + String(videoSeq).padStart(10, '0'),
    title: title,
    description: description || '',
    category: category || 'Events',
    published: published,
    status: 'active',
    // collectVideos() precomputes this lowercased haystack; hand-built fixtures need it too.
    text: (title + ' ' + (description || '')).toLowerCase(),
    youtube: { descriptionExcerpt: '' }
  };
}

function makeCreator(id, status, videos) {
  return { id: id, name: 'Creator ' + id, status: status || 'active', videos: videos };
}

function makeData(creators) {
  return { updated: '2026-11-22', creators: creators };
}

function entity(id, name, type, aliases) {
  return {
    id: id,
    name: name,
    type: type,
    aliases: aliases || [],
    guideHref: '/guide/pvp/',
    source: { publisher: 'Ubisoft Mobile Support', title: 'Test', url: 'https://example.test/faq' }
  };
}

// =====================================================================
// DETECTION
// =====================================================================

section('Detection');

test('a window with enough videos from enough creators is a burst', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), makeVideo('v2', '2026-11-19')]),
    makeCreator('b', 'active', [makeVideo('v3', '2026-11-19'), makeVideo('v4', '2026-11-18')]),
    makeCreator('c', 'active', [makeVideo('v5', '2026-11-18')])
  ]));
  var bursts = timeline.detectBursts(videos);
  assert.strictEqual(bursts.length, 1);
  assert.strictEqual(bursts[0].videos.length, 5);
  assert.strictEqual(bursts[0].creatorCount, 3);
});

test('too few videos is not a burst', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20')]),
    makeCreator('b', 'active', [makeVideo('v2', '2026-11-19')]),
    makeCreator('c', 'active', [makeVideo('v3', '2026-11-18'), makeVideo('v4', '2026-11-18')])
  ]));
  assert.strictEqual(timeline.detectBursts(videos).length, 0);
});

test('too few creators is not a burst', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), makeVideo('v2', '2026-11-19'), makeVideo('v3', '2026-11-18')]),
    makeCreator('b', 'active', [makeVideo('v4', '2026-11-18'), makeVideo('v5', '2026-11-18')])
  ]));
  assert.strictEqual(timeline.detectBursts(videos).length, 0);
});

test('videos further apart than the window do not combine', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), makeVideo('v2', '2026-11-20')]),
    makeCreator('b', 'active', [makeVideo('v3', '2026-11-20'), makeVideo('v4', '2026-11-20')]),
    makeCreator('c', 'active', [makeVideo('v5', '2026-11-20')]),
    makeCreator('d', 'active', [makeVideo('v6', '2026-11-01'), makeVideo('v7', '2026-11-01')])
  ]));
  var bursts = timeline.detectBursts(videos);
  assert.strictEqual(bursts.length, 1, 'only the tight group qualifies');
  assert.strictEqual(bursts[0].videos.length, 5);
  assert.strictEqual(bursts[0].end, '2026-11-20');
});

test('hidden creators never contribute to a burst', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20')]),
    makeCreator('b', 'active', [makeVideo('v2', '2026-11-20')]),
    makeCreator('c', 'hidden', [makeVideo('v3', '2026-11-20'), makeVideo('v4', '2026-11-20'), makeVideo('v5', '2026-11-20')])
  ]));
  assert.strictEqual(timeline.detectBursts(videos).length, 0);
});

test('pending creators do contribute to a burst', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), makeVideo('v2', '2026-11-20')]),
    makeCreator('b', 'active', [makeVideo('v3', '2026-11-20')]),
    makeCreator('c', 'pending', [makeVideo('v4', '2026-11-20'), makeVideo('v5', '2026-11-20')])
  ]));
  var bursts = timeline.detectBursts(videos);
  assert.strictEqual(bursts.length, 1, 'a dormant channel still documented the event');
  assert.strictEqual(bursts[0].creatorCount, 3);
});

test('unavailable videos never contribute to a burst', function () {
  var gone = makeVideo('gone', '2026-11-20');
  gone.status = 'unavailable';
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), gone]),
    makeCreator('b', 'active', [makeVideo('v2', '2026-11-20')]),
    makeCreator('c', 'active', [makeVideo('v3', '2026-11-20')])
  ]));
  assert.strictEqual(videos.length, 3);
});

test('no published date is shared by two different bursts', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), makeVideo('v2', '2026-11-15'), makeVideo('v3', '2026-11-10')]),
    makeCreator('b', 'active', [makeVideo('v4', '2026-11-20'), makeVideo('v5', '2026-11-15'), makeVideo('v6', '2026-11-10')]),
    makeCreator('c', 'active', [makeVideo('v7', '2026-11-20'), makeVideo('v8', '2026-11-15'), makeVideo('v9', '2026-11-10')])
  ]));
  var bursts = timeline.detectBursts(videos);
  // A burst legitimately holds several videos from one date; what must never happen is the
  // same date being claimed by two bursts.
  var owner = {};
  for (var b = 0; b < bursts.length; b++) {
    for (var v = 0; v < bursts[b].videos.length; v++) {
      var date = bursts[b].videos[v].published;
      if (owner[date] === undefined) owner[date] = b;
      assert.strictEqual(owner[date], b, 'date ' + date + ' appears in bursts ' + owner[date] + ' and ' + b);
    }
  }
  var burstDates = bursts.map(function (x) { return x.start + '..' + x.end; });
  assert.strictEqual(new Set(burstDates).size, burstDates.length, 'burst ranges must not repeat');
});

test('a burst range spans its real first and last video dates', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('v1', '2026-11-20'), makeVideo('v2', '2026-11-17')]),
    makeCreator('b', 'active', [makeVideo('v3', '2026-11-19'), makeVideo('v4', '2026-11-18')]),
    makeCreator('c', 'active', [makeVideo('v5', '2026-11-18')])
  ]));
  var bursts = timeline.detectBursts(videos);
  assert.strictEqual(bursts[0].end, '2026-11-20');
  assert.strictEqual(bursts[0].start, '2026-11-17', 'range starts at the first video, not the window edge');
});

// =====================================================================
// LABELLING
// =====================================================================

section('Labelling');

function burstOf(titles) {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', titles.map(function (t) { return makeVideo(t, '2026-11-20'); })),
    makeCreator('b', 'active', titles.map(function (t) { return makeVideo(t, '2026-11-20'); })),
    makeCreator('c', 'active', [makeVideo('filler', '2026-11-20')])
  ]));
  return { videos: videos, creatorCount: 3, start: '2026-11-20', end: '2026-11-20' };
}

test('a curated event entity names the burst', function () {
  var burst = burstOf(['Trick or Treat part 1', 'Trick or Treat part 2']);
  var label = timeline.labelBurst(burst, [entity('trick-or-treat', 'Trick or Treat', 'event', ['trick or treat'])]);
  assert.strictEqual(label.status, 'confirmed');
  assert.strictEqual(label.label, 'Trick or Treat');
  assert.strictEqual(label.entityId, 'trick-or-treat');
  assert.ok(label.guideHref, 'guide href travels with the label');
  assert.ok(label.source && label.source.url, 'publisher source travels with the label');
});

test('a single-word alias never matches', function () {
  var bare = entity('recruitment-shops', "Cecil's Recruitment Department", 'event', ['recruit', 'summon']);
  assert.deepStrictEqual(timeline.entityAliases(bare), ['cecil\'s recruitment department']);
  var burst = burstOf(['KRADD SUMMONS', 'Huge summon session']);
  var label = timeline.labelBurst(burst, [bare]);
  assert.strictEqual(label.status, 'unlabelled', 'bare "summon" must not name a burst');
});

test('a system entity never names a burst', function () {
  var entities = timeline.eligibleEntities([
    entity('artifacts', 'Artifacts', 'system', ['artifacts guide']),
    entity('art-outlet', "Art's Outlet", 'event', ['art\'s outlet'])
  ]);
  assert.strictEqual(entities.length, 1);
  assert.strictEqual(entities[0].id, 'art-outlet');
});

test('one creator naming an entity is not enough', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('Trick or Treat', '2026-11-20'), makeVideo('Trick or Treat again', '2026-11-20')]),
    makeCreator('b', 'active', [makeVideo('another topic', '2026-11-20'), makeVideo('more filler', '2026-11-20')]),
    makeCreator('c', 'active', [makeVideo('filler', '2026-11-20')])
  ]));
  var label = timeline.labelBurst({ videos: videos, creatorCount: 3 }, [entity('trick-or-treat', 'Trick or Treat', 'event', [])]);
  assert.strictEqual(label.status, 'unlabelled');
});

test('a version quoted by two creators labels the burst', function () {
  var burst = burstOf(['Update 3.8 is here', 'NEW Update 3.8 review']);
  var label = timeline.labelBurst(burst, []);
  assert.strictEqual(label.status, 'derived');
  assert.strictEqual(label.label, 'Update 3.8');
});

test('a version named by one creator only is not used', function () {
  var videos = timeline.collectVideos(makeData([
    makeCreator('a', 'active', [makeVideo('Update 3.8 is here', '2026-11-20'), makeVideo('other', '2026-11-20')]),
    makeCreator('b', 'active', [makeVideo('other one', '2026-11-20'), makeVideo('other two', '2026-11-20')]),
    makeCreator('c', 'active', [makeVideo('filler', '2026-11-20')])
  ]));
  var label = timeline.labelBurst({ videos: videos, creatorCount: 3 }, []);
  assert.strictEqual(label.status, 'unlabelled');
});

test('a version outranks a topical entity match', function () {
  var burst = burstOf(['Update 3.7 patch notes', 'Update 3.7 breakdown']);
  var label = timeline.labelBurst(burst, [entity('patch-notes', 'Patch notes', 'update', ['patch notes'])]);
  assert.strictEqual(label.status, 'derived');
  assert.strictEqual(label.label, 'Update 3.7');
});

test('localised update words are recognised', function () {
  assert.strictEqual(timeline.labelBurst(burstOf(['ATUALIZAÇÃO 3.6 chegou', 'Atualizacao 3.6 review']), []).label, 'Update 3.6');
  assert.strictEqual(timeline.labelBurst(burstOf(['actualización 3.5 ya', 'Actualizacion 3.5 review']), []).label, 'Update 3.5');
});

test('a labelled burst always beats an unnamed one in rendering order', function () {
  var named = { videos: [makeVideo('Trick or Treat', '2026-11-20')], creatorCount: 2, start: '2026-11-20', end: '2026-11-20' };
  var unnamed = { videos: [makeVideo('random', '2026-11-01')], creatorCount: 2, start: '2026-11-01', end: '2026-11-01' };
  var html = timeline.renderTimelineHtml([
    { burst: named, label: { status: 'confirmed', label: 'Trick or Treat', guideHref: '', source: null } },
    { burst: unnamed, label: { status: 'unlabelled', label: null, guideHref: '', source: null } }
  ]);
  assert.ok(html.indexOf('Trick or Treat') < html.indexOf('Unnamed activity'), 'named rows come first even when older');
});

// =====================================================================
// RENDERING
// =====================================================================

section('Rendering');

test('the timeline declares no structured data', function () {
  var html = timeline.renderTimelineHtml([
    { burst: burstOf(['Trick or Treat']), label: { status: 'confirmed', label: 'Trick or Treat', guideHref: '/guide/pvp/', source: null } }
  ]);
  assert.strictEqual(html.indexOf('@type'), -1, 'inferred events must not be marked up as facts');
  assert.strictEqual(html.indexOf('ld+json'), -1);
});

test('titles are escaped in links', function () {
  var burst = { videos: [makeVideo('<script>alert(1)</script>', '2026-11-20')], creatorCount: 1, start: '2026-11-20', end: '2026-11-20' };
  var html = timeline.renderTimelineHtml([{ burst: burst, label: { status: 'unlabelled', label: null, guideHref: '', source: null } }]);
  assert.strictEqual(html.indexOf('<script>alert(1)</script>'), -1);
  assert.ok(html.indexOf('&lt;script&gt;') !== -1);
});

test('a single-day burst renders one time element', function () {
  var burst = { videos: [makeVideo('x', '2026-11-20')], creatorCount: 1, start: '2026-11-20', end: '2026-11-20' };
  var html = timeline.renderTimelineHtml([{ burst: burst, label: { status: 'unlabelled', label: null, guideHref: '', source: null } }]);
  assert.strictEqual((html.match(/<time /g) || []).length, 1);
});

test('a multi-day burst renders both ends', function () {
  var burst = { videos: [makeVideo('x', '2026-11-20')], creatorCount: 1, start: '2026-11-14', end: '2026-11-20' };
  var html = timeline.renderTimelineHtml([{ burst: burst, label: { status: 'unlabelled', label: null, guideHref: '', source: null } }]);
  assert.strictEqual((html.match(/<time /g) || []).length, 2);
});

test('at most three videos are linked per burst', function () {
  var videos = [];
  for (var i = 0; i < 6; i++) videos.push(makeVideo('video ' + i, '2026-11-20'));
  var burst = { videos: videos, creatorCount: 3, start: '2026-11-20', end: '2026-11-20' };
  var html = timeline.renderTimelineHtml([{ burst: burst, label: { status: 'unlabelled', label: null, guideHref: '', source: null } }]);
  assert.strictEqual((html.match(/href="\.\.\/\.\.\/watch\//g) || []).length, 3);
  assert.ok(html.indexOf('and 3 more') !== -1);
});

test('a labelled burst links its own topic before unrelated neighbours', function () {
  // A burst is a time window: the newest video here is about something else entirely.
  var videos = [
    makeVideo('Unrelated arena push', '2026-11-20'),
    makeVideo('Trick or Treat part 2', '2026-11-19'),
    makeVideo('Trick or Treat part 1', '2026-11-18')
  ];
  var burst = { videos: videos, creatorCount: 3, start: '2026-11-18', end: '2026-11-20' };
  var html = timeline.renderTimelineHtml([{
    burst: burst,
    label: { status: 'confirmed', label: 'Trick or Treat', entityId: 't', matchTerms: ['trick or treat'], guideHref: '', source: null }
  }]);
  assert.ok(html.indexOf('Trick or Treat part 2') < html.indexOf('Unrelated arena push'), 'on-topic videos come first');
});

test('an unnamed burst links newest first', function () {
  var videos = [
    makeVideo('newest topic', '2026-11-20'),
    makeVideo('middle topic', '2026-11-19'),
    makeVideo('oldest topic', '2026-11-18')
  ];
  var burst = { videos: videos, creatorCount: 3, start: '2026-11-18', end: '2026-11-20' };
  var html = timeline.renderTimelineHtml([{ burst: burst, label: { status: 'unlabelled', label: null, matchTerms: [], guideHref: '', source: null } }]);
  assert.ok(html.indexOf('newest topic') < html.indexOf('middle topic'));
});

// =====================================================================
// FRESHNESS
// =====================================================================

section('Freshness');

var FRESHNESS_FIXTURE = [
  '<meta name="date" content="2026-11-07">',
  '<meta property="article:modified_time" content="2026-11-07T00:00:00Z">',
  '"dateModified": "2026-11-07T00:00:00+00:00"',
  'Updated <time datetime="2026-11-07">Nov 7, 2026</time>',
  'Last updated: <time datetime="2026-11-07">Nov 7, 2026</time>'
].join('\n');

test('all five in-page date fields move together', function () {
  var out = timeline.syncFreshness(FRESHNESS_FIXTURE, '2026-11-22');
  assert.strictEqual((out.match(/2026-11-07/g) || []).length, 0, 'no stale field survives');
  assert.ok(out.indexOf('<meta name="date" content="2026-11-22">') !== -1);
  assert.ok(out.indexOf('content="2026-11-22T00:00:00Z"') !== -1);
  assert.ok(out.indexOf('"dateModified": "2026-11-22T00:00:00+00:00"') !== -1);
  assert.strictEqual((out.match(/Nov 22, 2026/g) || []).length, 2);
});

test('a missing date field is an error, not a silent pass', function () {
  assert.throws(function () {
    timeline.syncFreshness('<meta name="date" content="2026-11-07">', '2026-11-22');
  }, /freshness field 1 not found/);
});

test('the sitemap rewrite touches only the event entry', function () {
  var xml = [
    '<url><loc>https://anomaly-alpha.github.io/guide/code/</loc><lastmod>2026-01-01</lastmod></url>',
    '<url><loc>https://anomaly-alpha.github.io/guide/event/</loc><lastmod>2026-11-07</lastmod></url>'
  ].join('\n');
  var out = timeline.renderSitemapLastmod(xml, '2026-11-22');
  assert.ok(out.indexOf('<loc>https://anomaly-alpha.github.io/guide/code/</loc><lastmod>2026-01-01</lastmod>') !== -1, 'other entries untouched');
  assert.ok(out.indexOf('<loc>https://anomaly-alpha.github.io/guide/event/</loc><lastmod>2026-11-22</lastmod>') !== -1);
});

test('marker replacement refuses a page without markers', function () {
  assert.throws(function () {
    timeline.replaceRegion('<html></html>', 'block');
  }, /markers missing/);
});

test('marker replacement refuses duplicated markers', function () {
  var html = '<!--EVENT_TIMELINE_START--><!--EVENT_TIMELINE_END--><!--EVENT_TIMELINE_START--><!--EVENT_TIMELINE_END-->';
  assert.throws(function () {
    timeline.replaceRegion(html, 'block');
  }, /exactly once/);
});

// =====================================================================
// COMMITTED OUTPUT
// =====================================================================

section('Committed output');

test('the committed signals file matches the live dataset', function () {
  var result = timeline.generate({ rootDir: ROOT });
  var committed = fs.readFileSync(path.join(ROOT, 'data', 'event-signals.json'), 'utf8');
  assert.strictEqual(result.signalsJson, committed, 'run npm run generate-events');
});

test('every committed burst meets the thresholds and has a real label', function () {
  var signals = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'event-signals.json'), 'utf8'));
  var context = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'game-context.json'), 'utf8'));
  var names = context.entities.map(function (e) { return e.name; });
  assert.ok(signals.bursts.length > 0, 'expected at least one burst');
  for (var i = 0; i < signals.bursts.length; i++) {
    var burst = signals.bursts[i];
    assert.ok(burst.videoCount >= timeline.MIN_BURST_VIDEOS, burst.start + ' has too few videos');
    assert.ok(burst.creatorCount >= timeline.MIN_BURST_CREATORS, burst.start + ' has too few creators');
    if (burst.status === 'confirmed') {
      assert.ok(names.indexOf(burst.label) !== -1, 'confirmed label "' + burst.label + '" is not a curated entity name');
      assert.ok(burst.entityId, 'confirmed bursts carry an entityId');
    }
    if (burst.status === 'derived') {
      assert.ok(/^Update \d+(\.\d+)+$/.test(burst.label), 'derived label "' + burst.label + '" is not a quoted version');
    }
    if (burst.status === 'unlabelled') {
      assert.strictEqual(burst.label, null, 'unlabelled bursts carry no label');
    }
  }
});

test('the committed page carries the rendered timeline between its markers', function () {
  var html = fs.readFileSync(path.join(ROOT, 'guide', 'event', 'index.html'), 'utf8');
  var start = html.indexOf('<!--EVENT_TIMELINE_START-->');
  var end = html.indexOf('<!--EVENT_TIMELINE_END-->');
  assert.ok(start !== -1 && end > start, 'markers must exist');
  var region = html.slice(start, end);
  assert.ok(region.indexOf('gem-event-timeline__list') !== -1, 'timeline list is rendered');
  assert.strictEqual(region.indexOf('@type'), -1, 'no structured data in the timeline region');
  assert.strictEqual(html.indexOf('"@type": "Event"'), -1, 'no Event schema on the page');
});

test('the event page freshness fields are not stale', function () {
  var html = fs.readFileSync(path.join(ROOT, 'guide', 'event', 'index.html'), 'utf8');
  var signals = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'event-signals.json'), 'utf8'));
  assert.ok(html.indexOf('"dateModified": "' + signals.updated) !== -1, 'dateModified must match the data it was built from');
  assert.ok(html.indexOf('Last updated: <time datetime="' + signals.updated + '">') !== -1);
});

// =====================================================================
// SUMMARY
// =====================================================================

console.log('\n' + '='.repeat(40));
console.log(passed + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('\nFailed tests:');
  failures.forEach(function (f) { console.log('  \u2717 ' + f.name + ': ' + f.message); });
  process.exit(1);
}
console.log('All tests passed.');
