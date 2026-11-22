'use strict';

// Detects bursts of creator uploads and renders them as an event activity timeline on
// /guide/event/. A burst is evidence that something happened; a name is only published
// when a curated entity or a verbatim version string supports it.

const fs = require('fs');
const path = require('path');

// ===== CONSTANTS =====

const BURST_WINDOW_DAYS = 7;
const MIN_BURST_VIDEOS = 5;
const MIN_BURST_CREATORS = 3;
const MAX_LINKED_VIDEOS = 3;

// Systems are always-on, so matching one says nothing about activity. Modes are included
// because a mode launch is an event in practice (Boss Raid).
const ELIGIBLE_ENTITY_TYPES = ['event', 'mode', 'update'];

const START_MARKER = '<!--EVENT_TIMELINE_START-->';
const END_MARKER = '<!--EVENT_TIMELINE_END-->';
const PAGE_RELATIVE = 'guide/event/index.html';
const PAGE_URL = 'https://anomaly-alpha.github.io/guide/event/';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ===== ESCAPING =====

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== DATE HELPERS =====

function dayMs(dateString) {
  return Date.parse(dateString + 'T00:00:00Z');
}

function shiftDays(dateString, delta) {
  var d = new Date(dayMs(dateString) + delta * 86400000);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  var parts = dateString.split('-');
  var month = MONTH_NAMES[parseInt(parts[1], 10) - 1];
  return month + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
}

// ===== DATA =====

function collectVideos(data) {
  var videos = [];
  for (var c = 0; c < data.creators.length; c++) {
    var creator = data.creators[c];
    if (creator.status !== 'active' && creator.status !== 'pending') continue;
    for (var v = 0; v < creator.videos.length; v++) {
      var video = creator.videos[v];
      if (video.status !== 'active') continue;
      var excerpt = video.youtube && video.youtube.descriptionExcerpt ? video.youtube.descriptionExcerpt : '';
      videos.push({
        id: video.id,
        title: video.title,
        category: video.category,
        published: video.published,
        creatorId: creator.id,
        creatorName: creator.name,
        text: (video.title + ' ' + (video.description || '') + ' ' + excerpt).toLowerCase()
      });
    }
  }
  videos.sort(function (a, b) {
    if (a.published !== b.published) return a.published < b.published ? 1 : -1;
    if (a.creatorId !== b.creatorId) return a.creatorId < b.creatorId ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  return videos;
}

// ===== DETECTION =====

function detectBursts(videos) {
  var claimed = {};
  var bursts = [];
  var days = [];
  var seen = {};
  for (var i = 0; i < videos.length; i++) {
    if (seen[videos[i].published]) continue;
    seen[videos[i].published] = true;
    days.push(videos[i].published);
  }
  days.sort().reverse();

  for (var d = 0; d < days.length; d++) {
    var day = days[d];
    if (claimed[day]) continue;
    var windowStart = shiftDays(day, -(BURST_WINDOW_DAYS - 1));

    var inWindow = [];
    var creators = {};
    var creatorCount = 0;
    var earliest = day;
    for (var v = 0; v < videos.length; v++) {
      var video = videos[v];
      if (video.published < windowStart || video.published > day) continue;
      inWindow.push(video);
      if (!creators[video.creatorId]) {
        creators[video.creatorId] = true;
        creatorCount++;
      }
      if (video.published < earliest) earliest = video.published;
    }

    if (inWindow.length < MIN_BURST_VIDEOS || creatorCount < MIN_BURST_CREATORS) continue;

    bursts.push({
      start: earliest,
      end: day,
      videos: inWindow,
      creatorCount: creatorCount
    });
    for (var w = 0; w < inWindow.length; w++) claimed[inWindow[w].published] = true;
  }

  return bursts;
}

// ===== LABELLING =====

function eligibleEntities(entities) {
  return entities.filter(function (entity) {
    return ELIGIBLE_ENTITY_TYPES.indexOf(entity.type) !== -1;
  });
}

// A bare "summon" or "recruit" matches half the corpus, so only multi-word aliases count.
function entityAliases(entity) {
  var aliases = [entity.name.toLowerCase()].concat(entity.aliases || []);
  return aliases.filter(function (alias) {
    return alias.trim().split(/\s+/).length >= 2;
  });
}

function matchesEntity(text, entity) {
  var aliases = entityAliases(entity);
  for (var i = 0; i < aliases.length; i++) {
    if (text.indexOf(aliases[i]) !== -1) return true;
  }
  return false;
}

var VERSION_PATTERN = /(?:update|atualiza\w*|actualiza\w*|patch notes?)\s*v?(\d+(?:\.\d+)+)/i;

// A version string is the most specific thing available and it is quoted verbatim from the
// titles, so it outranks a topical entity match. Measured on the current data it only ever
// competes with "Patch notes", which is documentation of an update rather than an event:
// the two conflicts become "Update 3.7" and "Update 3.5", and every other burst either has
// a specific entity and no version, or a version and no entity.
function labelBurst(burst, entities) {
  var versions = {};
  for (var t = 0; t < burst.videos.length; t++) {
    var match = VERSION_PATTERN.exec(burst.videos[t].title);
    if (!match) continue;
    var version = match[1];
    if (!versions[version]) versions[version] = {};
    versions[version][burst.videos[t].creatorId] = true;
  }
  var versionRanked = Object.keys(versions)
    .map(function (version) { return { version: version, creators: Object.keys(versions[version]).length }; })
    .filter(function (r) { return r.creators >= 2; })
    .sort(function (a, b) {
      if (b.creators !== a.creators) return b.creators - a.creators;
      return a.version < b.version ? 1 : -1;
    });

  if (versionRanked.length > 0) {
    return {
      status: 'derived',
      label: 'Update ' + versionRanked[0].version,
      matchTerms: [versionRanked[0].version],
      guideHref: '',
      source: null
    };
  }

  var hits = {};
  for (var v = 0; v < burst.videos.length; v++) {
    var video = burst.videos[v];
    for (var e = 0; e < entities.length; e++) {
      var entity = entities[e];
      if (!matchesEntity(video.text, entity)) continue;
      var record = hits[entity.id] || { creators: {}, creatorCount: 0, videos: 0, entity: entity };
      if (!record.creators[video.creatorId]) {
        record.creators[video.creatorId] = true;
        record.creatorCount++;
      }
      record.videos++;
      hits[entity.id] = record;
    }
  }

  var ranked = Object.keys(hits).map(function (id) { return hits[id]; })
    .filter(function (r) { return r.videos >= 2 && r.creatorCount >= 2; })
    .sort(function (a, b) {
      if (b.creatorCount !== a.creatorCount) return b.creatorCount - a.creatorCount;
      if (b.videos !== a.videos) return b.videos - a.videos;
      return a.entity.id < b.entity.id ? -1 : 1;
    });

  if (ranked.length > 0) {
    var winner = ranked[0];
    return {
      status: 'confirmed',
      label: winner.entity.name,
      entityId: winner.entity.id,
      matchTerms: entityAliases(winner.entity),
      guideHref: winner.entity.guideHref || '',
      source: winner.entity.source || null
    };
  }

  return { status: 'unlabelled', label: null, matchTerms: [], guideHref: '', source: null };
}

function topCategories(burst) {
  var counts = {};
  for (var i = 0; i < burst.videos.length; i++) {
    counts[burst.videos[i].category] = (counts[burst.videos[i].category] || 0) + 1;
  }
  var ranked = Object.keys(counts).map(function (category) {
    return { category: category, count: counts[category] };
  }).sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.category < b.category ? -1 : 1;
  });
  return ranked;
}

// ===== RENDERING =====

function relativeHref(href) {
  if (!href) return '';
  return href.charAt(0) === '/' ? '../..' + href : href;
}

// A burst is a time window, not a topic filter, so it can contain videos about something
// else entirely. Link the ones that actually match the row's label first, keeping newest
// first within each group.
function linksFor(burst, label) {
  var terms = label.matchTerms || [];
  if (!terms.length) return burst.videos.slice(0, MAX_LINKED_VIDEOS);
  var onTopic = [];
  var rest = [];
  for (var i = 0; i < burst.videos.length; i++) {
    var video = burst.videos[i];
    var matched = false;
    for (var t = 0; t < terms.length; t++) {
      if (video.text.indexOf(terms[t]) !== -1) { matched = true; break; }
    }
    (matched ? onTopic : rest).push(video);
  }
  return onTopic.concat(rest).slice(0, MAX_LINKED_VIDEOS);
}

function renderBurstHtml(burst, label) {
  var top = topCategories(burst);
  var html = '';
  html += '        <li class="gem-event-timeline__item gem-event-timeline__item--' + label.status + '">\n';
  html += '          <div class="gem-event-timeline__head">\n';
  html += '            <span class="gem-event-timeline__range"><time datetime="' + escapeHtml(burst.start) + '">' + escapeHtml(formatDate(burst.start)) + '</time>';
  if (burst.start !== burst.end) {
    html += ' &ndash; <time datetime="' + escapeHtml(burst.end) + '">' + escapeHtml(formatDate(burst.end)) + '</time>';
  }
  html += '</span>\n';

  if (label.status === 'confirmed') {
    html += '            <span class="gem-event-timeline__label gem-event-timeline__label--confirmed">' + escapeHtml(label.label) + '</span>\n';
  } else if (label.status === 'derived') {
    html += '            <span class="gem-event-timeline__label gem-event-timeline__label--derived">' + escapeHtml(label.label) + '</span>\n';
  } else {
    html += '            <span class="gem-event-timeline__label gem-event-timeline__label--unlabelled">Unnamed activity</span>\n';
  }

  html += '            <span class="gem-event-timeline__meta">' + burst.videos.length + ' videos &middot; ' + burst.creatorCount + ' creators &middot; mostly ' + escapeHtml(top[0].category) + '</span>\n';
  html += '          </div>\n';

  var linked = linksFor(burst, label);
  html += '          <p class="gem-event-timeline__links">';
  for (var i = 0; i < linked.length; i++) {
    if (i > 0) html += ' &middot; ';
    html += '<a href="../../watch/' + escapeHtml(linked[i].id) + '/">' + escapeHtml(linked[i].title) + '</a>';
  }
  if (burst.videos.length > linked.length) {
    html += ' <span class="gem-event-timeline__more">and ' + (burst.videos.length - linked.length) + ' more</span>';
  }
  html += '</p>\n';

  if (label.status === 'confirmed') {
    html += '          <p class="gem-event-timeline__attribution">';
    if (label.guideHref) {
      html += '<a href="' + escapeHtml(relativeHref(label.guideHref)) + '">Related guide</a>';
    }
    if (label.source && label.source.url) {
      html += (label.guideHref ? ' &middot; ' : '') + 'Source: <a href="' + escapeHtml(label.source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label.source.publisher || 'publisher') + '</a>';
    }
    html += '</p>\n';
  }

  html += '        </li>\n';
  return html;
}

function renderTimelineHtml(bursts) {
  if (!bursts.length) return '';

  var named = bursts.filter(function (b) { return b.label.status !== 'unlabelled'; });
  var unnamed = bursts.filter(function (b) { return b.label.status === 'unlabelled'; });

  var html = '';
  html += '        <section class="mx-4 mb-8 gem-event-timeline" aria-labelledby="eventTimelineTitle">\n';
  html += '          <h2 id="eventTimelineTitle" class="text-2xl font-bold text-white mb-2">Event activity timeline</h2>\n';
  html += '          <p class="gem-event-timeline__intro">Built from the dates creators published on, so it shows when the community responded to something in game rather than an official schedule. Named rows are tied to a game mode or event; the rest show activity we can date but not name. Event dates and rotations can change, so the in-game event hub stays the authority.</p>\n';
  html += '          <ol class="gem-event-timeline__list">\n';
  for (var n = 0; n < named.length; n++) html += renderBurstHtml(named[n].burst, named[n].label);
  for (var u = 0; u < unnamed.length; u++) html += renderBurstHtml(unnamed[u].burst, unnamed[u].label);
  html += '          </ol>\n';
  html += '        </section>\n';
  return html;
}

// ===== FRESHNESS =====

// The page's six freshness fields were hand-maintained and had no writer. They move only
// when the timeline block itself changes, so a no-op regeneration stays byte-identical.
function syncFreshness(html, dateString) {
  var humanDate = formatDate(dateString);
  var replacements = [
    [/<meta name="date" content="\d{4}-\d{2}-\d{2}">/, '<meta name="date" content="' + dateString + '">'],
    [/<meta property="article:modified_time" content="[^"]*">/, '<meta property="article:modified_time" content="' + dateString + 'T00:00:00Z">'],
    [/"dateModified": "[^"]*"/, '"dateModified": "' + dateString + 'T00:00:00+00:00"'],
    [/Updated <time datetime="\d{4}-\d{2}-\d{2}">[^<]*<\/time>/, 'Updated <time datetime="' + dateString + '">' + humanDate + '</time>'],
    [/Last updated: <time datetime="\d{4}-\d{2}-\d{2}">[^<]*<\/time>/, 'Last updated: <time datetime="' + dateString + '">' + humanDate + '</time>']
  ];

  var updated = html;
  for (var i = 0; i < replacements.length; i++) {
    if (!replacements[i][0].test(updated)) {
      throw new Error('freshness field ' + i + ' not found on the event page');
    }
    updated = updated.replace(replacements[i][0], replacements[i][1]);
  }
  return updated;
}

function renderSitemapLastmod(xml, dateString) {
  var matched = false;
  var next = xml.replace(/<url>[\s\S]*?<\/url>/g, function (block) {
    var loc = block.match(/<loc>([^<]+)<\/loc>/);
    if (!loc || loc[1] !== PAGE_URL) return block;
    if ((block.match(/<lastmod>[^<]*<\/lastmod>/g) || []).length !== 1) {
      throw new Error('event sitemap entry must have exactly one lastmod');
    }
    matched = true;
    return block.replace(/<lastmod>[^<]*<\/lastmod>/, '<lastmod>' + dateString + '</lastmod>');
  });
  if (!matched) throw new Error('sitemap has no entry for ' + PAGE_URL);
  return next;
}

// ===== INTEGRATION =====

function replaceRegion(html, content) {
  var start = html.indexOf(START_MARKER);
  var end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('event timeline markers missing or out of order');
  }
  if (html.indexOf(START_MARKER, start + START_MARKER.length) !== -1 ||
      html.indexOf(END_MARKER, end + END_MARKER.length) !== -1) {
    throw new Error('event timeline markers must appear exactly once');
  }
  return html.slice(0, start + START_MARKER.length) + '\n' + content + html.slice(end);
}

function buildSignals(creatorsData, contextData) {
  var videos = collectVideos(creatorsData);
  var entities = eligibleEntities(contextData.entities || []);
  var bursts = detectBursts(videos);

  return bursts.map(function (burst) {
    var label = labelBurst(burst, entities);
    var top = topCategories(burst);
    return {
      burst: burst,
      label: label,
      signal: {
        start: burst.start,
        end: burst.end,
        videoCount: burst.videos.length,
        creatorCount: burst.creatorCount,
        status: label.status,
        label: label.label,
        entityId: label.entityId || null,
        source: label.source || null,
        guideHref: label.guideHref || null,
        topCategory: top[0].category,
        categories: top.reduce(function (acc, entry) {
          acc[entry.category] = entry.count;
          return acc;
        }, {}),
        videos: burst.videos.map(function (video) { return video.id; })
      }
    };
  });
}

function generate(options) {
  var opts = options || {};
  var rootDir = opts.rootDir || path.resolve(__dirname, '..');
  var pagePath = path.join(rootDir, PAGE_RELATIVE);
  var sitemapPath = path.join(rootDir, 'sitemap.xml');

  var creatorsData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'youtube-creators.json'), 'utf8'));
  var contextData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'game-context.json'), 'utf8'));

  var labelled = buildSignals(creatorsData, contextData);

  var signals = {
    updated: creatorsData.updated,
    window: { days: BURST_WINDOW_DAYS, minVideos: MIN_BURST_VIDEOS, minCreators: MIN_BURST_CREATORS },
    bursts: labelled.map(function (entry) { return entry.signal; })
  };
  var signalsJson = JSON.stringify(signals, null, 2) + '\n';

  var pageHtml = fs.readFileSync(pagePath, 'utf8');
  var eol = pageHtml.indexOf('\r\n') === -1 ? '\n' : '\r\n';
  var block = renderTimelineHtml(labelled);

  var previous = pageHtml.slice(
    pageHtml.indexOf(START_MARKER) + START_MARKER.length,
    pageHtml.indexOf(END_MARKER)
  );
  // The rendered block is built with LF while the page is CRLF, so compare normalised or
  // every run looks like a change and the freshness fields move on every build.
  var changed = previous.replace(/\r\n/g, '\n').trim() !== block.replace(/\r\n/g, '\n').trim();

  var nextHtml = replaceRegion(pageHtml, block);
  if (eol === '\r\n') nextHtml = nextHtml.replace(/(?<!\r)\n/g, '\r\n');
  else nextHtml = nextHtml.replace(/\r\n/g, '\n');

  if (changed) nextHtml = syncFreshness(nextHtml, creatorsData.updated);

  var sitemapXml = null;
  if (changed && fs.existsSync(sitemapPath)) {
    sitemapXml = renderSitemapLastmod(fs.readFileSync(sitemapPath, 'utf8'), creatorsData.updated);
  }

  return {
    signalsJson: signalsJson,
    pageHtml: nextHtml,
    sitemapXml: sitemapXml,
    changed: changed,
    burstCount: signals.bursts.length,
    confirmedCount: signals.bursts.filter(function (b) { return b.status === 'confirmed'; }).length,
    derivedCount: signals.bursts.filter(function (b) { return b.status === 'derived'; }).length,
    unlabelledCount: signals.bursts.filter(function (b) { return b.status === 'unlabelled'; }).length
  };
}

// ===== EXPORTS =====

module.exports = {
  BURST_WINDOW_DAYS: BURST_WINDOW_DAYS,
  MIN_BURST_VIDEOS: MIN_BURST_VIDEOS,
  MIN_BURST_CREATORS: MIN_BURST_CREATORS,
  ELIGIBLE_ENTITY_TYPES: ELIGIBLE_ENTITY_TYPES,
  collectVideos: collectVideos,
  detectBursts: detectBursts,
  eligibleEntities: eligibleEntities,
  entityAliases: entityAliases,
  labelBurst: labelBurst,
  topCategories: topCategories,
  renderTimelineHtml: renderTimelineHtml,
  syncFreshness: syncFreshness,
  renderSitemapLastmod: renderSitemapLastmod,
  replaceRegion: replaceRegion,
  formatDate: formatDate,
  shiftDays: shiftDays,
  generate: generate
};

// ===== CLI =====

if (require.main === module) {
  var root = path.resolve(__dirname, '..');
  var result = generate({ rootDir: root });

  var signalsPath = path.join(root, 'data', 'event-signals.json');
  fs.writeFileSync(signalsPath, result.signalsJson, 'utf8');
  console.log('Wrote ' + signalsPath + ' (' + result.burstCount + ' bursts: ' +
    result.confirmedCount + ' confirmed, ' + result.derivedCount + ' derived, ' +
    result.unlabelledCount + ' unlabelled)');

  var pageFile = path.join(root, PAGE_RELATIVE);
  fs.writeFileSync(pageFile, result.pageHtml, 'utf8');
  console.log('Updated ' + pageFile + (result.changed ? ' (timeline changed; freshness synced)' : ' (timeline unchanged)'));

  if (result.sitemapXml) {
    fs.writeFileSync(path.join(root, 'sitemap.xml'), result.sitemapXml, 'utf8');
    console.log('Updated sitemap lastmod for ' + PAGE_URL);
  }

  var again = generate({ rootDir: root });
  if (again.signalsJson !== result.signalsJson) {
    console.error('Idempotency check failed: event signals changed on a second run.');
    process.exit(1);
  }
  console.log('Idempotency check passed.');
}
