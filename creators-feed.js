// Browsing behaviour for the creators activity feed: batching, category filtering and the
// month jump. The functions above the DOM section are pure and are also required by
// scripts/generate-youtube-creators.js and tests/creators-feed.test.js, so nothing here may
// touch the DOM at load time.
//
// Items are reduced to { published, category } by both callers: the generator passes feed
// items, the browser passes card elements. Neither side reshapes the other.

'use strict';

var FEED_BATCH_ITEMS = 50;
var ALL_CATEGORIES = 'all';
var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ===== BATCHING =====

// A batch never splits videos that share a publication date, because the feed uses one date
// marker per day and a split group would orphan cards from their marker.
function nextBatchEnd(items, fromIndex, batchSize) {
  var size = batchSize || FEED_BATCH_ITEMS;
  var end = Math.min(fromIndex + size, items.length);
  while (end < items.length && items[end].published === items[end - 1].published) end++;
  return end;
}

function buildBatches(items, batchSize) {
  var batches = [];
  var index = 0;
  while (index < items.length) {
    var end = nextBatchEnd(items, index, batchSize);
    batches.push({
      startIndex: index,
      endIndex: end,
      count: end - index,
      firstDate: items[index].published,
      lastDate: items[end - 1].published
    });
    index = end;
  }
  return batches;
}

// ===== CATEGORIES =====

function categorySlug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function slugToCategory(slug, categories) {
  if (!slug) return ALL_CATEGORIES;
  for (var i = 0; i < categories.length; i++) {
    if (categorySlug(categories[i]) === slug) return categories[i];
  }
  return ALL_CATEGORIES;
}

function filterItems(items, category) {
  if (!category || category === ALL_CATEGORIES) return items.slice();
  return items.filter(function (item) { return item.category === category; });
}

// Counts always describe the full set, so a chip never changes its own number when a
// different chip is selected.
function countByCategory(items, categories) {
  var counts = { all: items.length };
  for (var i = 0; i < categories.length; i++) counts[categories[i]] = 0;
  for (var j = 0; j < items.length; j++) {
    if (counts[items[j].category] === undefined) continue;
    counts[items[j].category]++;
  }
  return counts;
}

// ===== MONTHS =====

function monthKey(published) {
  return String(published).slice(0, 7);
}

function monthLabel(key) {
  var parts = String(key).split('-');
  var name = MONTH_NAMES[parseInt(parts[1], 10) - 1];
  return name ? name + ' ' + parts[0] : key;
}

function monthOptions(items) {
  var seen = {};
  var keys = [];
  for (var i = 0; i < items.length; i++) {
    var key = monthKey(items[i].published);
    if (seen[key]) continue;
    seen[key] = true;
    keys.push(key);
  }
  keys.sort().reverse();
  return keys.map(function (key) {
    var count = 0;
    for (var j = 0; j < items.length; j++) if (monthKey(items[j].published) === key) count++;
    return { key: key, label: monthLabel(key), count: count };
  });
}

// The month jump reveals everything down to the end of the chosen month and scrolls to its
// first card, so both ends of the range are needed.
function monthRange(items, key) {
  var first = -1;
  var last = -1;
  for (var i = 0; i < items.length; i++) {
    if (monthKey(items[i].published) !== key) continue;
    if (first === -1) first = i;
    last = i;
  }
  if (first === -1) return null;
  return { firstIndex: first, lastIndex: last };
}

// ===== LABELS =====

function loadMoreLabel(remaining) {
  return 'Show ' + Math.min(remaining, FEED_BATCH_ITEMS) + ' more videos (' + remaining + ' remaining)';
}

function mediaCountLabel(shown, total) {
  return 'Showing ' + shown + ' of ' + total + ' videos';
}

// ===== DOM (browser only) =====

function initFeedBrowsing(doc, win) {
  var list = doc.getElementById('creatorFeedList');
  if (!list) return;

  var cards = Array.prototype.slice.call(list.children).filter(function (el) {
    return el.classList.contains('gem-creators__item');
  });
  if (!cards.length) return;

  var items = cards.map(function (el) {
    var category = el.getAttribute('data-category') || '';
    var published = el.getAttribute('data-published') || '';
    return { el: el, category: category, published: published };
  });

  var chipGroup = doc.querySelector('[data-feed-categories]');
  var chips = chipGroup ? Array.prototype.slice.call(chipGroup.querySelectorAll('[data-feed-category]')) : [];
  var monthSelect = doc.querySelector('[data-feed-month]');
  var moreButton = doc.querySelector('[data-feed-more]');
  var statusRegion = doc.querySelector('[data-feed-status]');
  var videoStat = doc.getElementById('feedVideoStat');
  var creatorStat = doc.getElementById('feedCreatorStat');

  var categories = chips.map(function (chip) { return chip.getAttribute('data-feed-category'); })
    .filter(function (name) { return name && name !== ALL_CATEGORIES; });
  var activeCategory = ALL_CATEGORIES;
  var visible = items.slice();
  var revealed = 0;

  function announce(message) {
    if (statusRegion) statusRegion.textContent = message;
  }

  function currentUrl(win2, category) {
    var search = win2.location.search.replace(/^\?/, '').split('&').filter(function (pair) {
      return pair && pair.indexOf('category=') !== 0;
    });
    if (category && category !== ALL_CATEGORIES) search.push('category=' + categorySlug(category));
    var query = search.length ? '?' + search.join('&') : '';
    return win2.location.pathname + query + win2.location.hash;
  }

  function render(announcement) {
    var index = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var inSet = activeCategory === ALL_CATEGORIES || item.category === activeCategory;
      item.el.classList.toggle('gem-creators__item--filtered', !inSet);
      if (!inSet) {
        item.el.classList.add('gem-creators__item--deferred');
        continue;
      }
      item.el.classList.toggle('gem-creators__item--deferred', index >= revealed);
      index++;
    }

    list.classList.toggle('gem-creators__feed--filtered', activeCategory !== ALL_CATEGORIES);

    for (var c = 0; c < chips.length; c++) {
      var chipCategory = chips[c].getAttribute('data-feed-category');
      chips[c].setAttribute('aria-pressed', chipCategory === activeCategory ? 'true' : 'false');
    }

    if (monthSelect) {
      var monthKeys = {};
      for (var v = 0; v < visible.length; v++) monthKeys[monthKey(visible[v].published)] = true;
      var options = monthSelect.options;
      for (var o = 0; o < options.length; o++) {
        options[o].disabled = options[o].value !== '' && !monthKeys[options[o].value];
      }
    }

    var remaining = visible.length - Math.min(revealed, visible.length);
    if (moreButton) {
      if (remaining > 0) {
        moreButton.hidden = false;
        moreButton.disabled = false;
        moreButton.textContent = loadMoreLabel(remaining);
      } else {
        moreButton.hidden = true;
      }
    }

    if (videoStat) videoStat.innerHTML = '<strong>' + visible.length + '</strong> videos';
    if (creatorStat) {
      var seen = {};
      var creators = 0;
      for (var s = 0; s < items.length; s++) {
        if (activeCategory !== ALL_CATEGORIES && items[s].category !== activeCategory) continue;
        var key = items[s].el.getAttribute('data-creator-key');
        if (seen[key]) continue;
        seen[key] = true;
        creators++;
      }
      creatorStat.innerHTML = '<strong>' + creators + '</strong> creators';
    }

    announce(announcement || mediaCountLabel(Math.min(revealed, visible.length), visible.length));
  }

  function applyCategory(category, revealFirstBatch) {
    activeCategory = category || ALL_CATEGORIES;
    visible = filterItems(items, activeCategory);
    if (revealFirstBatch) revealed = nextBatchEnd(visible, 0);
    render();
    try {
      win.history.replaceState(null, '', currentUrl(win, activeCategory));
    } catch (err) {
      // replaceState throws on file:// in some browsers; the filter still works without it.
    }
  }

  if (moreButton) {
    moreButton.hidden = false;
    moreButton.addEventListener('click', function () {
      revealed = nextBatchEnd(visible, revealed);
      render();
      if (visible.length - revealed <= 0 && statusRegion) statusRegion.focus();
    });
  }

  for (var ch = 0; ch < chips.length; ch++) {
    chips[ch].addEventListener('click', function (event) {
      var name = event.currentTarget.getAttribute('data-feed-category');
      applyCategory(name, true);
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener('change', function () {
      var key = monthSelect.value;
      if (!key) return;
      var range = monthRange(visible, key);
      if (!range) return;
      revealed = range.lastIndex + 1;
      render('Showing videos through ' + monthLabel(key));
      var target = visible[range.firstIndex];
      if (target && target.el.scrollIntoView) {
        target.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    });
  }

  var params = /[?&]category=([^&#]*)/.exec(win.location.search);
  var initial = params ? slugToCategory(decodeURIComponent(params[1]), categories) : ALL_CATEGORIES;
  applyCategory(initial, true);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FEED_BATCH_ITEMS: FEED_BATCH_ITEMS,
    ALL_CATEGORIES: ALL_CATEGORIES,
    nextBatchEnd: nextBatchEnd,
    buildBatches: buildBatches,
    categorySlug: categorySlug,
    slugToCategory: slugToCategory,
    filterItems: filterItems,
    countByCategory: countByCategory,
    monthKey: monthKey,
    monthLabel: monthLabel,
    monthOptions: monthOptions,
    monthRange: monthRange,
    loadMoreLabel: loadMoreLabel,
    mediaCountLabel: mediaCountLabel
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initFeedBrowsing(document, window); });
  } else {
    initFeedBrowsing(document, window);
  }
}
