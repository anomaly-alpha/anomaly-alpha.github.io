'use strict';

// =====================================================================
// tests/creators-feed.test.js
// Unit tests for the feed's browsing logic. creators-feed.js is loaded by
// the browser and required here, so both sides run the same rules.
// =====================================================================

var assert = require('assert');

var feed = require('../creators-feed.js');

// ===== HELPERS =====

// Builds items newest-first. `groups` is a list of [date, category, count].
function makeItems(groups) {
  var items = [];
  for (var g = 0; g < groups.length; g++) {
    for (var n = 0; n < groups[g][2]; n++) {
      items.push({ published: groups[g][0], category: groups[g][1] });
    }
  }
  return items;
}

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

// =====================================================================
// BATCHING
// =====================================================================

section('Batching');

test('a batch stops at the requested size when dates allow', function () {
  var items = makeItems([
    ['2026-11-20', 'Events', 1],
    ['2026-11-19', 'Events', 1],
    ['2026-11-18', 'Events', 1]
  ]);
  assert.strictEqual(feed.nextBatchEnd(items, 0, 2), 2);
});

test('a batch extends past the size rather than split a date group', function () {
  var items = makeItems([
    ['2026-11-20', 'Events', 3],
    ['2026-11-19', 'Events', 3]
  ]);
  // 2 would land mid-group, so the batch runs to the end of 2026-11-20
  assert.strictEqual(feed.nextBatchEnd(items, 0, 2), 3);
});

test('a single date group larger than the batch size is never split', function () {
  var items = makeItems([['2026-11-20', 'Events', 9]]);
  assert.strictEqual(feed.nextBatchEnd(items, 0, 5), 9);
});

test('the final batch ends at the item count', function () {
  var items = makeItems([
    ['2026-11-20', 'Events', 2],
    ['2026-11-19', 'Events', 2]
  ]);
  assert.strictEqual(feed.nextBatchEnd(items, 3, 5), 4);
});

test('no batch boundary ever splits a date group', function () {
  var items = makeItems([
    ['2026-11-20', 'Events', 7],
    ['2026-11-19', 'Guides', 3],
    ['2026-11-18', 'Events', 1],
    ['2026-11-17', 'Updates', 12],
    ['2026-11-16', 'Gameplay', 4],
    ['2026-11-15', 'Events', 2]
  ]);
  var batches = feed.buildBatches(items, 5);
  var boundary = 0;
  for (var b = 0; b < batches.length; b++) {
    assert.strictEqual(batches[b].startIndex, boundary, 'batches must be contiguous');
    boundary = batches[b].endIndex;
    if (boundary < items.length) {
      assert.notStrictEqual(
        items[boundary - 1].published,
        items[boundary].published,
        'batch ' + b + ' splits date ' + items[boundary].published
      );
    }
  }
  assert.strictEqual(boundary, items.length, 'batches must cover every item');
});

test('buildBatches covers every item exactly once', function () {
  var items = makeItems([['2026-11-20', 'Events', 120]]);
  var batches = feed.buildBatches(items, 50);
  var total = batches.reduce(function (sum, batch) { return sum + batch.count; }, 0);
  assert.strictEqual(total, 120);
  assert.strictEqual(feed.FEED_BATCH_ITEMS, 50, 'default batch size is 50');
});

// =====================================================================
// FILTERING
// =====================================================================

section('Filtering');

var MIXED = makeItems([
  ['2026-11-20', 'Events', 3],
  ['2026-11-19', 'Guides', 2],
  ['2026-11-18', 'Events', 1],
  ['2026-11-17', 'Updates', 4]
]);

test('the all category keeps every item', function () {
  assert.strictEqual(feed.filterItems(MIXED, 'all').length, MIXED.length);
  assert.strictEqual(feed.filterItems(MIXED, '').length, MIXED.length);
  assert.strictEqual(feed.filterItems(MIXED, null).length, MIXED.length);
});

test('a category filter keeps only its own items', function () {
  assert.strictEqual(feed.filterItems(MIXED, 'Events').length, 4);
  assert.strictEqual(feed.filterItems(MIXED, 'Updates').length, 4);
  assert.strictEqual(feed.filterItems(MIXED, 'Guides').length, 2);
});

test('filtering does not mutate the source list', function () {
  var copy = MIXED.slice();
  feed.filterItems(MIXED, 'Events');
  assert.strictEqual(MIXED.length, copy.length);
});

test('an unknown category yields an empty set rather than everything', function () {
  assert.strictEqual(feed.filterItems(MIXED, 'Livestreams').length, 0);
});

test('re-batching a filtered set matches batching it from scratch', function () {
  var filtered = feed.filterItems(MIXED, 'Events');
  var viaFilter = feed.buildBatches(filtered, 2);
  var direct = feed.buildBatches(MIXED.filter(function (i) { return i.category === 'Events'; }), 2);
  assert.deepStrictEqual(viaFilter, direct);
});

test('counts cover the full set regardless of the active filter', function () {
  var categories = ['Guides', 'Tier Lists', 'Updates', 'Events', 'Team Building', 'Gameplay', 'Livestreams'];
  var counts = feed.countByCategory(MIXED, categories);
  assert.strictEqual(counts.all, 10);
  assert.strictEqual(counts.Events, 4);
  assert.strictEqual(counts.Guides, 2);
  assert.strictEqual(counts.Livestreams, 0);
});

test('slug round-trips through the category list', function () {
  var categories = ['Guides', 'Tier Lists', 'Updates', 'Events'];
  assert.strictEqual(feed.categorySlug('Tier Lists'), 'tier-lists');
  assert.strictEqual(feed.slugToCategory('tier-lists', categories), 'Tier Lists');
  assert.strictEqual(feed.slugToCategory('events', categories), 'Events');
});

test('an unknown slug falls back to all', function () {
  assert.strictEqual(feed.slugToCategory('not-a-category', ['Events']), 'all');
  assert.strictEqual(feed.slugToCategory('', ['Events']), 'all');
  assert.strictEqual(feed.slugToCategory(null, ['Events']), 'all');
});

// =====================================================================
// MONTHS
// =====================================================================

section('Months');

var SPREAD = makeItems([
  ['2026-11-20', 'Events', 2],
  ['2026-11-02', 'Events', 1],
  ['2026-10-31', 'Guides', 1],
  ['2025-12-05', 'Events', 1],
  ['2024-02-27', 'Updates', 1]
]);

test('month key is the published prefix', function () {
  assert.strictEqual(feed.monthKey('2026-11-20'), '2026-11');
});

test('month labels are human readable', function () {
  assert.strictEqual(feed.monthLabel('2026-11'), 'Nov 2026');
  assert.strictEqual(feed.monthLabel('2024-02'), 'Feb 2024');
});

test('month options are newest first with counts', function () {
  var options = feed.monthOptions(SPREAD);
  assert.deepStrictEqual(
    options.map(function (o) { return o.key; }),
    ['2026-11', '2026-10', '2025-12', '2024-02']
  );
  assert.strictEqual(options[0].count, 3);
  assert.strictEqual(options[0].label, 'Nov 2026');
});

test('month options never repeat a month', function () {
  var options = feed.monthOptions(SPREAD);
  var keys = options.map(function (o) { return o.key; });
  assert.strictEqual(keys.length, new Set(keys).size);
});

test('month range spans the first and last card of that month', function () {
  var range = feed.monthRange(SPREAD, '2026-11');
  assert.deepStrictEqual(range, { firstIndex: 0, lastIndex: 2 });
});

test('a month with one card has an equal first and last index', function () {
  assert.deepStrictEqual(feed.monthRange(SPREAD, '2025-12'), { firstIndex: 4, lastIndex: 4 });
});

test('an absent month has no range', function () {
  assert.strictEqual(feed.monthRange(SPREAD, '2023-01'), null);
});

test('the month jump target is inside the filtered set, not the full set', function () {
  // Events holds 2026-11-20 x2, 2026-11-02 and 2025-12-05, so Nov 2026 ends at index 2
  var filtered = feed.filterItems(SPREAD, 'Events');
  var range = feed.monthRange(filtered, '2026-11');
  assert.strictEqual(range.firstIndex, 0);
  assert.strictEqual(range.lastIndex, 2);
  assert.strictEqual(feed.monthKey(filtered[range.lastIndex].published), '2026-11');
  assert.notStrictEqual(feed.monthKey(filtered[range.lastIndex + 1].published), '2026-11');
});

// =====================================================================
// LABELS
// =====================================================================

section('Labels');

test('the load more label names the batch and the remainder', function () {
  assert.strictEqual(feed.loadMoreLabel(50, 340), 'Show 50 more videos (340 remaining)');
});

test('the load more label states the real count when a date group extends the batch', function () {
  // nextBatchEnd can return more than FEED_BATCH_ITEMS to finish a date, so the label must
  // quote what the click reveals rather than the batch constant.
  assert.strictEqual(feed.loadMoreLabel(57, 57), 'Show 57 more videos (57 remaining)');
});

test('the count label reports shown against total', function () {
  assert.strictEqual(feed.mediaCountLabel(50, 390), 'Showing 50 of 390 videos');
});

// =====================================================================
// MODULE SHAPE
// =====================================================================

section('Module shape');

test('the module exports the shared rules and loads without a DOM', function () {
  var required = ['FEED_BATCH_ITEMS', 'nextBatchEnd', 'buildBatches', 'filterItems', 'countByCategory',
    'monthKey', 'monthLabel', 'monthOptions', 'monthRange', 'categorySlug', 'slugToCategory',
    'loadMoreLabel', 'mediaCountLabel'];
  for (var i = 0; i < required.length; i++) {
    assert.ok(feed[required[i]] !== undefined, 'missing export: ' + required[i]);
  }
});

test('loading the module does not define a global feed feed object', function () {
  assert.strictEqual(typeof global.initFeedBrowsing, 'undefined');
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
