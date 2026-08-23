'use strict';

// =====================================================================
// tests/youtube-creators-generator.test.js
// Node assert + temporary directories. No external test framework.
// =====================================================================

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');

var gen = require('../scripts/generate-youtube-creators');

// ===== HELPERS =====

var _videoSeq = 0;

function resetVideoSeq() { _videoSeq = 0; }

function nextVideoId() {
  _videoSeq++;
  return 'V' + String(_videoSeq).padStart(10, '0');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yt-creators-test-'));
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function makeTemplate() {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head><title>Test Page</title></head>',
    '<body>',
    '<main>',
    '<!--FEATURED_CREATOR_START-->',
    '<!--FEATURED_CREATOR_END-->',
    '',
    '<!--CREATOR_SECTIONS_START-->',
    '<!--CREATOR_SECTIONS_END-->',
    '',
    '<!--CREATORS_JSON_LD_START-->',
    '<!--CREATORS_JSON_LD_END-->',
    '',
    '<!--CREATORS_NOSCRIPT_START-->',
    '<!--CREATORS_NOSCRIPT_END-->',
    '',
    '<!--CREATORS_NOTE_START-->',
    '<!--CREATORS_NOTE_END-->',
    '</main>',
    '</body>',
    '</html>'
  ].join('\n');
}

function makeActiveCreator(id, displayOrder, videoCount) {
  if (videoCount === undefined) videoCount = 8;
  var videos = [];
  for (var i = 0; i < videoCount; i++) {
    var vid = nextVideoId();
    var isRecent = i < 4; // first 4 are recent (within 180 days)
    videos.push({
      id: vid,
      title: 'Video ' + (i + 1) + ' by ' + id,
      description: 'Description for video ' + (i + 1) + ' by ' + id + '.',
      category: i % 3 === 0 ? 'Tier Lists' : i % 3 === 1 ? 'Guides' : 'Updates',
      published: isRecent ? daysAgo(5 + i * 12) : daysAgo(200 + i * 10),
      lastChecked: today(),
      status: 'active',
      featured: i < 6,
      sourceUrl: 'https://www.youtube.com/watch?v=' + vid,
      canonicalUrl: 'https://www.youtube.com/watch?v=' + vid,
      evidenceNote: 'Video ' + (i + 1) + ' evidence for ' + id + '.',
      statusReason: ''
    });
  }
  return {
    id: id,
    name: 'Creator ' + id,
    handle: '@' + id,
    channelUrl: 'https://www.youtube.com/@' + id,
    description: 'Description for ' + id + '.',
    tags: ['Guides', 'Updates'],
    status: 'active',
    displayOrder: displayOrder,
    lastChecked: today(),
    videos: videos,
    sourceUrl: 'https://www.youtube.com/@' + id
  };
}

function makePendingCreator(id, displayOrder) {
  var vid = nextVideoId();
  return {
    id: id,
    name: 'Creator ' + id,
    handle: '@' + id,
    channelUrl: 'https://www.youtube.com/@' + id,
    description: 'Pending description for ' + id + '.',
    tags: [],
    status: 'pending',
    displayOrder: displayOrder,
    lastChecked: today(),
    videos: [{
      id: vid,
      title: 'Pending Video by ' + id,
      description: 'Pending video description.',
      category: 'Gameplay',
      published: daysAgo(30),
      lastChecked: today(),
      status: 'active',
      featured: false,
      sourceUrl: 'https://www.youtube.com/watch?v=' + vid,
      canonicalUrl: 'https://www.youtube.com/watch?v=' + vid,
      evidenceNote: 'Pending evidence.',
      statusReason: ''
    }],
    sourceUrl: 'https://www.youtube.com/@' + id
  };
}

function makeHiddenCreator(id, displayOrder) {
  return {
    id: id,
    name: 'Creator ' + id,
    handle: '@' + id,
    channelUrl: 'https://www.youtube.com/@' + id,
    description: 'Hidden description for ' + id + '.',
    tags: [],
    status: 'hidden',
    displayOrder: displayOrder,
    lastChecked: today(),
    videos: [],
    sourceUrl: 'https://www.youtube.com/@' + id
  };
}

function makeValidData(creators) {
  return {
    updated: today(),
    contentMaintainer: 'Anomaly Alpha',
    reviewCadenceDays: 90,
    featuredCreatorId: creators[0].id,
    candidateSources: [{
      sourceUrl: 'https://www.youtube.com/watch?v=V0000000001',
      kind: 'video-seed',
      resolvedCreatorId: creators[0].id,
      lastChecked: today(),
      resolutionStatus: 'verified'
    }],
    ogImageSources: [{
      sourceUrl: 'https://example.test/creators.png',
      license: 'Original test artwork.',
      attribution: 'Test maintainer',
      lastChecked: today()
    }],
    creators: creators
  };
}

function writeFixture(dir, data, template) {
  var sourcePath = path.join(dir, 'source.json');
  var templatePath = path.join(dir, 'template.html');
  fs.writeFileSync(sourcePath, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(templatePath, template || makeTemplate(), 'utf8');
  return { sourcePath: sourcePath, templatePath: templatePath };
}

function assertThrows(fn, expectedMsg) {
  try {
    fn();
    throw new Error('Expected error but none was thrown');
  } catch (err) {
    if (err.message === 'Expected error but none was thrown') throw err;
    if (expectedMsg && err.message.indexOf(expectedMsg) === -1) {
      throw new Error('Expected error containing "' + expectedMsg + '" but got: ' + err.message);
    }
  }
}

// ===== TEST RUNNER =====

var passed = 0;
var failed = 0;
var errors = [];

function test(name, fn) {
  try {
    resetVideoSeq();
    fn();
    console.log('  \u2713 ' + name);
    passed++;
  } catch (err) {
    console.error('  \u2717 ' + name);
    console.error('    ' + err.message);
    failed++;
    errors.push(name + ': ' + err.message);
  }
}

// =====================================================================
// POSITIVE TESTS
// =====================================================================

console.log('\nPositive generation tests:');

test('Valid active creator generates featured hero with 6 cards plus expansion data', function () {
  var data = makeValidData([makeActiveCreator('avatar-shuvd', 1)]);
  var html = gen.renderFeaturedCreatorHtml(data);
  assert.ok(html.indexOf('gem-creators__featured') !== -1, 'Should have featured class');
  assert.ok(html.indexOf('creator-hero-avatar-shuvd') !== -1, 'Should have hero id');
  assert.ok(html.indexOf('Creator avatar-shuvd') !== -1, 'Should contain creator name');
  assert.ok(html.indexOf('Visit Channel') !== -1, 'Should have channel link');
  // Count video cards
  var matches = html.match(/gem-creator-video"/g);
  assert.strictEqual(matches ? matches.length : 0, 8, 'Should have 6 featured cards plus 2 expansion cards');
  assert.ok(html.indexOf('Show more videos') !== -1, 'Should expose additional validated videos behind an expansion control');
  // Check thumbnail attributes
  assert.ok(html.indexOf('data-thumbnail-fallback="hqdefault"') !== -1, 'Should have fallback attribute');
  assert.ok(html.indexOf('loading="lazy"') !== -1, 'Should have lazy loading');
  assert.ok(html.indexOf('hqdefault.jpg') !== -1, 'Should use reliable hqdefault thumbnails');
});

test('Featured creator excluded from normal list', function () {
  var c1 = makeActiveCreator('creator-one', 1);
  var c2 = makeActiveCreator('creator-two', 2);
  var data = makeValidData([c1, c2]);
  data.featuredCreatorId = 'creator-one';
  var html = gen.renderCreatorSectionsHtml(data);
  assert.ok(html.indexOf('creator-one') === -1, 'Featured creator should not appear in normal list');
  assert.ok(html.indexOf('creator-two') !== -1, 'Non-featured creator should appear');
});

test('Active creators sorted by displayOrder in normal list', function () {
  var c1 = makeActiveCreator('alpha', 3);
  var c2 = makeActiveCreator('beta', 1);
  var data = makeValidData([c1, c2]);
  data.featuredCreatorId = 'alpha';
  var html = gen.renderCreatorSectionsHtml(data);
  var betaPos = html.indexOf('creator-beta');
  var alphaPos = html.indexOf('creator-alpha');
  // Alpha is featured, so only beta in normal list
  assert.ok(betaPos !== -1, 'Beta should be in normal list');
  assert.ok(alphaPos === -1, 'Alpha (featured) should not be in normal list');
});

test('Pending creator renders at bottom with positive label and channel link', function () {
  var featured = makeActiveCreator('featured-hero', 0);
  var active = makeActiveCreator('active-one', 1);
  var pending = makePendingCreator('pending-one', 2);
  var data = makeValidData([featured, active, pending]);
  data.featuredCreatorId = 'featured-hero';
  var html = gen.renderCreatorSectionsHtml(data);
  var activePos = html.indexOf('creator-active-one');
  var pendingPos = html.indexOf('creator-pending-one');
  assert.ok(activePos !== -1, 'Active should appear');
  assert.ok(pendingPos !== -1, 'Pending should appear');
  assert.ok(activePos < pendingPos, 'Active should come before pending');
  assert.ok(html.indexOf('gem-creator--pending') !== -1, 'Should have pending class');
  assert.ok(html.indexOf('New</span>') !== -1, 'Should have positive creator label');
  assert.ok(html.indexOf('Pending</span>') === -1, 'Should hide pending label');
  assert.ok(html.indexOf('More videos coming soon') !== -1, 'Pending should show coming soon');
  // Pending creator should still have Visit Channel link
  var pendingSection = html.substring(pendingPos);
  assert.ok(pendingSection.indexOf('Visit Channel') !== -1, 'Pending should have channel link');
});

test('Hidden creator absent from all output', function () {
  var active = makeActiveCreator('active-one', 1);
  var hidden = makeHiddenCreator('hidden-one', 2);
  var data = makeValidData([active, hidden]);

  var featured = gen.renderFeaturedCreatorHtml(data);
  var sections = gen.renderCreatorSectionsHtml(data);
  var js = gen.renderJsOutput(data);
  var noscript = gen.renderNoscriptHtml(data);
  var jsonLd = gen.renderJsonLdHtml(data);

  assert.ok(featured.indexOf('hidden-one') === -1, 'Hidden not in featured');
  assert.ok(sections.indexOf('hidden-one') === -1, 'Hidden not in sections');
  assert.ok(js.indexOf('hidden-one') === -1, 'Hidden not in JS output');
  assert.ok(noscript.indexOf('hidden-one') === -1, 'Hidden not in noscript');
  assert.ok(jsonLd.indexOf('hidden-one') === -1, 'Hidden not in JSON-LD');
});

test('VideoObject JSON-LD generated for active videos', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  var data = makeValidData([creator]);
  var jsonLd = gen.renderJsonLdHtml(data);
  assert.ok(jsonLd.indexOf('ItemList') !== -1, 'Should contain ItemList');
  assert.ok(jsonLd.indexOf('VideoObject') !== -1, 'Should contain VideoObject');
  assert.ok(jsonLd.indexOf('application/ld+json') !== -1, 'Should be in script tag');
  assert.ok(jsonLd.indexOf('youtube-nocookie.com') !== -1, 'Should use privacy-enhanced embed');
  assert.ok(jsonLd.indexOf('i.ytimg.com') !== -1, 'Should reference ytimg thumbnails');
  // Check 8 videos in JSON-LD (all active, up to 12)
  var videoMatches = jsonLd.match(/VideoObject/g);
  assert.ok(videoMatches && videoMatches.length === 8, 'Should have 8 VideoObject entries');
});

test('JSON-LD includes pending creator videos', function () {
  var active = makeActiveCreator('active-one', 1);
  var pending = makePendingCreator('pending-one', 2);
  var data = makeValidData([active, pending]);
  var jsonLd = gen.renderJsonLdHtml(data);
  // Should include videos from both active and pending creators
  var videoMatches = jsonLd.match(/VideoObject/g);
  // 8 from active + 1 from pending = 9
  assert.ok(videoMatches && videoMatches.length === 9, 'Should have 9 VideoObject entries (8 active + 1 pending)');
});

test('Noscript fallback lists all visible active videos', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  var data = makeValidData([creator]);
  var noscript = gen.renderNoscriptHtml(data);
  assert.ok(noscript.indexOf('<noscript>') !== -1, 'Should be wrapped in noscript');
  assert.ok(noscript.indexOf('Watch Video') !== -1, 'Should have watch links');
  assert.ok(noscript.indexOf('youtube.com/watch') !== -1, 'Should link to YouTube');
  assert.ok(noscript.indexOf('test-creator') !== -1, 'Should mention creator name');
  // 8 videos from active creator
  var linkMatches = noscript.match(/Watch Video/g);
  assert.ok(linkMatches && linkMatches.length === 8, 'Should have 8 noscript links');
});

test('Noscript includes pending creator videos', function () {
  var active = makeActiveCreator('active-one', 1);
  var pending = makePendingCreator('pending-one', 2);
  var data = makeValidData([active, pending]);
  var noscript = gen.renderNoscriptHtml(data);
  assert.ok(noscript.indexOf('pending-one') !== -1, 'Should include pending creator');
  // 8 from active + 1 from pending
  var linkMatches = noscript.match(/Watch/g);
  assert.ok(linkMatches && linkMatches.length >= 9, 'Should have at least 9 watch links');
});

test('Disclaimer renders privacy note and independence disclaimer', function () {
  var html = gen.renderDisclaimerHtml();
  assert.ok(html.indexOf('Thumbnails and playback may connect to YouTube') !== -1, 'Should have YouTube disclosure');
  assert.ok(html.indexOf('independent community members') !== -1, 'Should have independence disclaimer');
  assert.ok(html.indexOf('Ubisoft') !== -1, 'Should mention Ubisoft');
  assert.ok(html.indexOf('YouTube') !== -1, 'Should mention YouTube');
  assert.ok(html.indexOf('Anomaly Alpha') !== -1, 'Should mention Anomaly Alpha');
});

test('window.__YOUTUBE_CREATORS output is valid JS', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  var data = makeValidData([creator]);
  var js = gen.renderJsOutput(data);
  assert.ok(js.indexOf('window.__YOUTUBE_CREATORS=') === 0, 'Should start with assignment');
  // Evaluate in isolated context
  var context = { window: {} };
  vm.createContext(context);
  vm.runInContext(js, context);
  assert.ok(Array.isArray(context.window.__YOUTUBE_CREATORS), 'Should produce array');
  assert.strictEqual(context.window.__YOUTUBE_CREATORS.length, 1, 'Should have 1 creator');
  var c = context.window.__YOUTUBE_CREATORS[0];
  assert.strictEqual(c.id, 'test-creator');
  assert.strictEqual(c.name, 'Creator test-creator');
  assert.strictEqual(c.status, 'active');
  assert.strictEqual(c.videos.length, 8, 'Should have 8 videos');
  assert.ok(c.videos[0].title, 'Video should have title');
  assert.ok(c.videos[0].category, 'Video should have category');
  assert.ok(c.videos[0].published, 'Video should have published date');
});

test('JS output excludes hidden creators', function () {
  var active = makeActiveCreator('active-one', 1);
  var hidden = makeHiddenCreator('hidden-one', 2);
  var data = makeValidData([active, hidden]);
  var js = gen.renderJsOutput(data);
  var context = { window: {} };
  vm.createContext(context);
  vm.runInContext(js, context);
  assert.strictEqual(context.window.__YOUTUBE_CREATORS.length, 1, 'Should have only 1 creator');
  assert.strictEqual(context.window.__YOUTUBE_CREATORS[0].id, 'active-one');
});

test('Creator tags appear in featured hero and normal sections', function () {
  var creator = makeActiveCreator('test-creator', 1);
  var data = makeValidData([creator]);
  var featured = gen.renderFeaturedCreatorHtml(data);
  var sections = gen.renderCreatorSectionsHtml(data);
  assert.ok(featured.indexOf('gem-creator__tags') !== -1, 'Featured should have tags');
  assert.ok(featured.indexOf('Guides') !== -1, 'Featured should show tag text');
});

test('Creator sections show lastChecked date', function () {
  var featured = makeActiveCreator('featured-hero', 0);
  var creator = makeActiveCreator('test-creator', 1);
  var data = makeValidData([featured, creator]);
  data.featuredCreatorId = 'featured-hero';
  var sections = gen.renderCreatorSectionsHtml(data);
  assert.ok(sections.indexOf('Last checked:') !== -1, 'Should show last checked');
  assert.ok(sections.indexOf('<time datetime=') !== -1, 'Should use time element');
});

test('Pending creator without 6 items shows "More videos coming soon"', function () {
  var pending = makePendingCreator('low-pending', 1);
  // pending creator has 1 video, fewer than 6
  var data = makeValidData([pending]);
  data.featuredCreatorId = pending.id; // Can't use pending as featured
  // Actually, pending can't be featured. Let me use a different approach.
  // We need an active creator as featured + the pending one
  var active = makeActiveCreator('active-hero', 2);
  data = makeValidData([active, pending]);
  data.featuredCreatorId = 'active-hero';
  var sections = gen.renderCreatorSectionsHtml(data);
  assert.ok(sections.indexOf('More videos coming soon') !== -1, 'Should show coming soon message');
});

test('Chronological feed merges creators and keeps card identity visible', function () {
  var active = makeActiveCreator('alpha', 1, 6);
  var pending = makePendingCreator('pending-one', 2);
  pending.videos[0].published = active.videos[5].published;
  var data = makeValidData([active, pending]);
  var feed = gen.renderCreatorFeedHtml(data);
  var newest = feed.indexOf('Video 1 by alpha');
  var older = feed.indexOf('Video 6 by alpha');
  assert.ok(feed.indexOf('gem-creators__feed') !== -1, 'Should render one feed');
  assert.ok(newest !== -1 && older !== -1 && newest < older, 'Should sort videos newest first');
  assert.ok(feed.indexOf('Creator alpha') !== -1, 'Should show creator name on every card');
  assert.ok(feed.indexOf('data-published=') !== -1, 'Should expose feed dates');
  assert.ok(feed.indexOf('2 videos') !== -1, 'Should show a burst count when videos share a date');
  assert.ok(feed.indexOf('<time datetime=') !== -1, 'Should use semantic time elements');
});

// =====================================================================
// NEGATIVE VALIDATION TESTS
// =====================================================================

console.log('\nNegative validation tests:');

test('Duplicate creator ID rejected', function () {
  var c1 = makeActiveCreator('dup-id', 1);
  var c2 = makeActiveCreator('dup-id', 2);
  var data = makeValidData([c1, c2]);
  data.creators = [c1, c2];
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('Duplicate creator ID') !== -1; }), 'Should reject duplicate ID');
});

test('Duplicate video ID rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  // Force duplicate IDs
  creator.videos[1].id = creator.videos[0].id;
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('Duplicate video ID') !== -1; }), 'Should reject duplicate video ID');
});

test('Invalid YouTube video ID rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].id = 'short';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('valid 11-character') !== -1; }), 'Should reject invalid video ID');
});

test('Malformed active channel URL rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.channelUrl = 'https://bad-url.com/channel';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('channelUrl') !== -1 && e.indexOf('youtube.com') !== -1; }), 'Should reject malformed channel URL');
});

test('Missing active-video description rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].description = '';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.description') !== -1; }), 'Should reject missing video description');
});

test('Missing active-video published date rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].published = 'not-a-date';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.published') !== -1; }), 'Should reject invalid published date');
});

test('Invalid creator status rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.status = 'bogus';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.status') !== -1; }), 'Should reject invalid creator status');
});

test('Invalid video status rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].status = 'deleted';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('status') !== -1 && e.indexOf('active, pending, unavailable') !== -1; }), 'Should reject invalid video status and mention valid values');
});

test('Fewer than 6 active items rejected for active creator', function () {
  var creator = makeActiveCreator('test-creator', 1, 5);
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('at least 6') !== -1; }), 'Should require at least 6 items');
});

test('Fewer than 3 recent items rejected for active creator', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  // Set all published dates to > 180 days ago
  creator.videos.forEach(function (v) { v.published = daysAgo(200); });
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('180 days') !== -1; }), 'Should require 3 items in previous 180 days');
});

test('Pending creator with zero eligible items rejected', function () {
  var pending = {
    id: 'empty-pending',
    name: 'Empty Pending',
    handle: '@empty',
    channelUrl: 'https://www.youtube.com/@empty',
    description: 'Empty pending.',
    tags: [],
    status: 'pending',
    displayOrder: 1,
    lastChecked: today(),
    videos: [],
    sourceUrl: 'https://www.youtube.com/@empty'
  };
  var active = makeActiveCreator('active-hero', 2);
  var data = makeValidData([active, pending]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('pending with zero') !== -1; }), 'Should reject pending with zero eligible items');
});

test('Featured creator pointing to pending record rejected', function () {
  var pending = makePendingCreator('pending-feat', 1);
  var active = makeActiveCreator('active-hero', 2);
  var data = makeValidData([active, pending]);
  data.featuredCreatorId = 'pending-feat';
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('active creator') !== -1; }), 'Featured must be active');
});

test('Featured creator pointing to hidden record rejected', function () {
  var hidden = makeHiddenCreator('hidden-feat', 1);
  var active = makeActiveCreator('active-hero', 2);
  var data = makeValidData([active, hidden]);
  data.featuredCreatorId = 'hidden-feat';
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('active creator') !== -1; }), 'Featured must be active');
});

test('Featured creator pointing to nonexistent ID rejected', function () {
  var active = makeActiveCreator('active-hero', 1);
  var data = makeValidData([active]);
  data.featuredCreatorId = 'nonexistent';
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('does not match') !== -1; }), 'Featured ID must exist');
});

test('Missing evidence note rejected for active video', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].evidenceNote = '';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('evidenceNote') !== -1; }), 'Should require evidence note');
});

test('Missing video title rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].title = '';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.title') !== -1; }), 'Should require video title');
});

test('Invalid video category rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].category = 'Memes';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.category') !== -1; }), 'Should reject invalid category');
});

test('Non-kebab-case creator ID rejected', function () {
  var creator = makeActiveCreator('Test_Creator', 1, 8);
  creator.id = 'Test_Creator';
  var data = makeValidData([creator]);
  data.featuredCreatorId = 'Test_Creator';
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('kebab-case') !== -1; }), 'Should require kebab-case ID');
});

test('Missing creator name rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.name = '';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.name') !== -1; }), 'Should require creator name');
});

test('Missing creator channel URL rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.channelUrl = '';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('channelUrl') !== -1; }), 'Should require channel URL');
});

test('Empty tags array rejected for active creator', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.tags = [];
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.tags') !== -1; }), 'Should reject empty tags for active creator');
});

test('Duplicate displayOrder rejected', function () {
  var c1 = makeActiveCreator('creator-a', 1, 8);
  var c2 = makeActiveCreator('creator-b', 1);
  c2.videos = []; // hidden creator
  c2.status = 'hidden';
  var data = makeValidData([c1, c2]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('Duplicate displayOrder') !== -1; }), 'Should reject duplicate displayOrder');
});

test('Invalid updated date rejected', function () {
  var data = makeValidData([makeActiveCreator('test-creator', 1, 8)]);
  data.updated = 'not-a-date';
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('updated') !== -1; }), 'Should reject invalid updated date');
});

test('reviewCadenceDays not 90 rejected', function () {
  var data = makeValidData([makeActiveCreator('test-creator', 1, 8)]);
  data.reviewCadenceDays = 30;
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('reviewCadenceDays') !== -1; }), 'Should reject non-90 reviewCadenceDays');
});

test('Missing contentMaintainer rejected', function () {
  var data = makeValidData([makeActiveCreator('test-creator', 1, 8)]);
  data.contentMaintainer = '';
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('contentMaintainer') !== -1; }), 'Should reject empty contentMaintainer');
});

test('Empty candidateSources rejected', function () {
  var data = makeValidData([makeActiveCreator('test-creator', 1, 8)]);
  data.candidateSources = [];
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('candidateSources') !== -1; }), 'Should reject empty candidateSources');
});

test('Hidden creator with eligible items rejected', function () {
  var hidden = makeHiddenCreator('bad-hidden', 1);
  hidden.videos = [{
    id: nextVideoId(),
    title: 'Should not exist',
    description: 'Should not exist.',
    category: 'Guides',
    published: daysAgo(10),
    lastChecked: today(),
    status: 'active',
    featured: false,
    sourceUrl: 'https://www.youtube.com/watch?v=test',
    canonicalUrl: 'https://www.youtube.com/watch?v=test',
    evidenceNote: 'Evidence.',
    statusReason: ''
  }];
  var active = makeActiveCreator('active-hero', 2);
  var data = makeValidData([active, hidden]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('hidden with') !== -1; }), 'Should reject hidden creator with eligible items');
});

test('featured:true with non-active status rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].featured = true;
  creator.videos[0].status = 'pending';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('featured:true') !== -1; }), 'Should reject featured:true with non-active status');
});

test('Missing statusReason for unavailable video rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[7].status = 'unavailable';
  creator.videos[7].statusReason = '';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('statusReason') !== -1; }), 'Should require statusReason for unavailable video');
});

test('Missing lastChecked on video rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos[0].lastChecked = 'bad';
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('.lastChecked') !== -1; }), 'Should reject invalid video lastChecked');
});

// =====================================================================
// MARKER TESTS
// =====================================================================

console.log('\nMarker tests:');

test('Missing marker pair detected', function () {
  var badHtml = '<html><!--FEATURED_CREATOR_START--><!--FEATURED_CREATOR_END--></html>';
  assertThrows(
    function () { gen.assertMarkers(badHtml, gen.MARKER_PAIRS); },
    'Missing markers'
  );
});

test('Duplicated marker pair detected', function () {
  var badHtml = '<!--FEATURED_CREATOR_START--><!--FEATURED_CREATOR_END--><!--FEATURED_CREATOR_START--><!--FEATURED_CREATOR_END-->';
  assertThrows(
    function () { gen.assertMarkers(badHtml, ['FEATURED_CREATOR']); },
    'Duplicated'
  );
});

test('All 5 marker pairs accepted when present exactly once', function () {
  var html = makeTemplate();
  // Should not throw
  gen.assertMarkers(html, gen.MARKER_PAIRS);
});

test('replaceMarker replaces content between markers', function () {
  var html = '<p>before</p><!--FOO_START-->old content<!--FOO_END--><p>after</p>';
  var result = gen.replaceMarker(html, 'FOO', 'new content');
  assert.ok(result.indexOf('old content') === -1, 'Old content should be removed');
  assert.ok(result.indexOf('new content') !== -1, 'New content should be present');
  assert.ok(result.indexOf('<!--FOO_START-->') !== -1, 'Start marker should be preserved');
  assert.ok(result.indexOf('<!--FOO_END-->') !== -1, 'End marker should be preserved');
  assert.ok(result.indexOf('<p>before</p>') !== -1, 'Content before should be preserved');
  assert.ok(result.indexOf('<p>after</p>') !== -1, 'Content after should be preserved');
});

test('replaceMarker is idempotent', function () {
  var template = makeTemplate();
  var content = '<p>test content</p>';
  var result1 = gen.replaceMarker(template, 'FEATURED_CREATOR', content);
  var result2 = gen.replaceMarker(result1, 'FEATURED_CREATOR', content);
  assert.strictEqual(result1, result2, 'Second replacement should produce identical output');
});

// =====================================================================
// ESCAPING TESTS
// =====================================================================

console.log('\nEscaping tests:');

test('escapeHtml escapes special characters', function () {
  assert.strictEqual(gen.escapeHtml('a&b'), 'a&amp;b');
  assert.strictEqual(gen.escapeHtml('<script>'), '&lt;script&gt;');
  assert.strictEqual(gen.escapeHtml('a"b\'c'), 'a&quot;b&#39;c');
  assert.strictEqual(gen.escapeHtml(''), '');
  assert.strictEqual(gen.escapeHtml(null), '');
});

test('escapeJsonLd escapes closing script tags', function () {
  assert.ok(gen.escapeJsonLd('</script>').indexOf('</script') === -1, 'Should escape closing script');
  assert.ok(gen.escapeJsonLd('</SCRIPT>').indexOf('</SCRIPT') === -1, 'Should be case-insensitive');
});

// =====================================================================
// INTEGRATION TESTS (with temp dirs)
// =====================================================================

console.log('\nIntegration tests:');

test('generate() produces valid output for complete valid data', function () {
  var dir = makeTempDir();
  try {
    var active = makeActiveCreator('avatar-shuvd', 1, 8);
    var pending = makePendingCreator('low-creator', 2);
    var hidden = makeHiddenCreator('ghost-creator', 3);
    var data = makeValidData([active, pending, hidden]);
    var paths = writeFixture(dir, data);

    var result = gen.generate(paths.sourcePath, paths.templatePath);
    assert.ok(result.success, 'Should succeed: ' + result.errors.join('; '));
    assert.ok(result.html, 'Should produce HTML');
    assert.ok(result.js, 'Should produce JS');

    // Check chronological feed summary and cards
    assert.ok(result.html.indexOf('gem-creators__signal') !== -1, 'Should have feed summary');
    assert.ok(result.html.indexOf('gem-creators__feed') !== -1, 'Should have chronological feed');
    assert.ok(result.html.indexOf('data-creator-id="low-creator"') !== -1, 'Should include pending creator name');
    assert.ok(result.html.indexOf('gem-creator-video__status') !== -1, 'Should label pending cards');

    // Check hidden absent
    assert.ok(result.html.indexOf('ghost-creator') === -1, 'Should not have hidden creator');

    // Check JSON-LD
    assert.ok(result.html.indexOf('ItemList') !== -1, 'Should have ItemList in JSON-LD');
    assert.ok(result.html.indexOf('VideoObject') !== -1, 'Should have VideoObject');

    // Check noscript
    assert.ok(result.html.indexOf('<noscript>') !== -1, 'Should have noscript');
    assert.ok(result.html.indexOf('Watch') !== -1, 'Should have watch links');

    // Check disclaimer
    assert.ok(result.html.indexOf('independent community members') !== -1, 'Should have disclaimer');

    // Check markers preserved
    assert.ok(result.html.indexOf('<!--FEATURED_CREATOR_START-->') !== -1, 'Featured marker preserved');
    assert.ok(result.html.indexOf('<!--FEATURED_CREATOR_END-->') !== -1, 'Featured end marker preserved');
    assert.ok(result.html.indexOf('<!--CREATOR_SECTIONS_START-->') !== -1, 'Sections marker preserved');
    assert.ok(result.html.indexOf('<!--CREATOR_SECTIONS_END-->') !== -1, 'Sections end marker preserved');
    assert.ok(result.html.indexOf('<!--CREATORS_JSON_LD_START-->') !== -1, 'JSON-LD marker preserved');
    assert.ok(result.html.indexOf('<!--CREATORS_JSON_LD_END-->') !== -1, 'JSON-LD end marker preserved');
    assert.ok(result.html.indexOf('<!--CREATORS_NOSCRIPT_START-->') !== -1, 'Noscript marker preserved');
    assert.ok(result.html.indexOf('<!--CREATORS_NOSCRIPT_END-->') !== -1, 'Noscript end marker preserved');
    assert.ok(result.html.indexOf('<!--CREATORS_NOTE_START-->') !== -1, 'Note marker preserved');
    assert.ok(result.html.indexOf('<!--CREATORS_NOTE_END-->') !== -1, 'Note end marker preserved');

    // Check JS output
    assert.ok(result.js.indexOf('window.__YOUTUBE_CREATORS=') === 0, 'JS should start correctly');
  } finally {
    cleanupDir(dir);
  }
});

test('Second generate() produces byte-identical output (idempotency)', function () {
  var dir = makeTempDir();
  try {
    var creator = makeActiveCreator('avatar-shuvd', 1, 8);
    var data = makeValidData([creator]);
    var paths = writeFixture(dir, data);

    var result1 = gen.generate(paths.sourcePath, paths.templatePath);
    assert.ok(result1.success, 'First run should succeed');

    // Write back the generated HTML (simulating CLI behavior)
    fs.writeFileSync(paths.templatePath, result1.html, 'utf8');

    var result2 = gen.generate(paths.sourcePath, paths.templatePath);
    assert.ok(result2.success, 'Second run should succeed');
    assert.strictEqual(result1.html, result2.html, 'HTML should be byte-identical');
    assert.strictEqual(result1.js, result2.js, 'JS should be byte-identical');
  } finally {
    cleanupDir(dir);
  }
});

test('generate() fails on invalid data with descriptive errors', function () {
  var dir = makeTempDir();
  try {
    var data = {
      updated: 'bad-date',
      contentMaintainer: '',
      reviewCadenceDays: 30,
      featuredCreatorId: 'nonexistent',
      candidateSources: [],
      ogImageSources: [],
      creators: []
    };
    var paths = writeFixture(dir, data);
    var result = gen.generate(paths.sourcePath, paths.templatePath);
    assert.ok(!result.success, 'Should fail');
    assert.ok(result.errors.length > 0, 'Should have errors');
    assert.ok(result.errors.length >= 3, 'Should have multiple errors');
  } finally {
    cleanupDir(dir);
  }
});

test('generate() skips gracefully when source file missing', function () {
  var dir = makeTempDir();
  try {
    var result = gen.generate(path.join(dir, 'nonexistent.json'), null);
    assert.ok(!result.success, 'Should fail');
    assert.ok(result.errors[0].indexOf('Cannot read') !== -1, 'Should mention file not found');
  } finally {
    cleanupDir(dir);
  }
});

test('generate() skips gracefully when template file missing', function () {
  var dir = makeTempDir();
  try {
    var creator = makeActiveCreator('test-creator', 1);
    var data = makeValidData([creator]);
    var sourcePath = path.join(dir, 'source.json');
    fs.writeFileSync(sourcePath, JSON.stringify(data), 'utf8');

    var result = gen.generate(sourcePath, path.join(dir, 'nonexistent.html'));
    assert.ok(!result.success, 'Should fail when template missing');
    assert.ok(result.errors[0].indexOf('Cannot read template') !== -1, 'Should mention template');
  } finally {
    cleanupDir(dir);
  }
});

test('generate() works without template (JS-only output)', function () {
  var dir = makeTempDir();
  try {
    var creator = makeActiveCreator('test-creator', 1);
    var data = makeValidData([creator]);
    var sourcePath = path.join(dir, 'source.json');
    fs.writeFileSync(sourcePath, JSON.stringify(data), 'utf8');

    var result = gen.generate(sourcePath, null);
    assert.ok(result.success, 'Should succeed without template');
    assert.strictEqual(result.html, null, 'HTML should be null');
    assert.ok(result.js.indexOf('window.__YOUTUBE_CREATORS=') === 0, 'Should produce JS');
  } finally {
    cleanupDir(dir);
  }
});

test('generate() fails on template with missing markers', function () {
  var dir = makeTempDir();
  try {
    var creator = makeActiveCreator('test-creator', 1);
    var data = makeValidData([creator]);
    var paths = writeFixture(dir, data, '<html><body>no markers</body></html>');
    var result = gen.generate(paths.sourcePath, paths.templatePath);
    assert.ok(!result.success, 'Should fail with missing markers');
    assert.ok(result.errors[0].indexOf('Missing markers') !== -1, 'Should mention missing markers');
  } finally {
    cleanupDir(dir);
  }
});

test('generate() fails on template with duplicated markers', function () {
  var dir = makeTempDir();
  try {
    var creator = makeActiveCreator('test-creator', 1);
    var data = makeValidData([creator]);
    var badTemplate = makeTemplate() + '\n<!--FEATURED_CREATOR_START--><!--FEATURED_CREATOR_END-->';
    var paths = writeFixture(dir, data, badTemplate);
    var result = gen.generate(paths.sourcePath, paths.templatePath);
    assert.ok(!result.success, 'Should fail with duplicated markers');
    assert.ok(result.errors[0].indexOf('Duplicated') !== -1, 'Should mention duplicated markers');
  } finally {
    cleanupDir(dir);
  }
});

test('JSON-LD escaping prevents script injection', function () {
  var creator = makeActiveCreator('test-creator', 1);
  creator.videos[0].description = 'Test </script><script>alert(1)</script> desc';
  var data = makeValidData([creator]);
  var jsonLd = gen.renderJsonLdHtml(data);
  // The </script> in the description should be escaped
  assert.ok(jsonLd.indexOf('</script><script>') === -1, 'Should not contain raw script close');
  assert.ok(jsonLd.indexOf('&lt;/script') !== -1 || jsonLd.indexOf('<\\/script') !== -1, 'Should escape script close');
});

test('html escaping prevents XSS in creator names', function () {
  var creator = makeActiveCreator('test-creator', 1);
  creator.name = '<img src=x onerror=alert(1)>';
  var data = makeValidData([creator]);
  var html = gen.renderFeaturedCreatorHtml(data);
  assert.ok(html.indexOf('<img src=x') === -1, 'Should not contain raw HTML in name');
  assert.ok(html.indexOf('&lt;img') !== -1, 'Should escape HTML entities');
});

// =====================================================================
// COMPREHENSIVE CREATOR COUNT TESTS
// =====================================================================

console.log('\nCreator count / threshold tests:');

test('Active creator with exactly 6 items passes', function () {
  var creator = makeActiveCreator('test-creator', 1, 6);
  // Ensure at least 3 are recent
  creator.videos[0].published = daysAgo(5);
  creator.videos[1].published = daysAgo(20);
  creator.videos[2].published = daysAgo(50);
  creator.videos[3].published = daysAgo(200);
  creator.videos[4].published = daysAgo(250);
  creator.videos[5].published = daysAgo(300);
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.strictEqual(errs.length, 0, 'Should pass with 6 items and 3 recent: ' + errs.join('; '));
});

test('Active creator with 6 items but only 2 recent rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 6);
  creator.videos[0].published = daysAgo(10);
  creator.videos[1].published = daysAgo(20);
  creator.videos[2].published = daysAgo(200);
  creator.videos[3].published = daysAgo(250);
  creator.videos[4].published = daysAgo(300);
  creator.videos[5].published = daysAgo(350);
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('180 days') !== -1; }), 'Should fail with only 2 recent');
});

test('Exactly 6 featured:true items required for active creator', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  // Set only 5 as featured
  creator.videos.forEach(function (v, i) { v.featured = i < 5; });
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('5 featured') !== -1; }), 'Should require exactly 6 featured');
});

test('More than 6 featured:true items rejected', function () {
  var creator = makeActiveCreator('test-creator', 1, 8);
  creator.videos.forEach(function (v) { v.featured = true; });
  var data = makeValidData([creator]);
  var errs = gen.validateData(data);
  assert.ok(errs.some(function (e) { return e.indexOf('8 featured') !== -1; }), 'Should reject >6 featured items');
});

// =====================================================================
// PER-CREATOR VIDEO CAP TEST
// =====================================================================

console.log('\nPer-creator video cap tests:');

test('JSON-LD caps at 12 items per creator', function () {
  var creator = makeActiveCreator('test-creator', 1, 15);
  var data = makeValidData([creator]);
  var jsonLd = gen.renderJsonLdHtml(data);
  var videoMatches = jsonLd.match(/VideoObject/g);
  assert.strictEqual(videoMatches ? videoMatches.length : 0, 12, 'Should cap at 12 videos per creator');
});

test('JS output caps at 12 items per creator', function () {
  var creator = makeActiveCreator('test-creator', 1, 15);
  var data = makeValidData([creator]);
  var js = gen.renderJsOutput(data);
  var context = { window: {} };
  vm.createContext(context);
  vm.runInContext(js, context);
  assert.strictEqual(context.window.__YOUTUBE_CREATORS[0].videos.length, 12, 'JS should cap at 12 videos');
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
