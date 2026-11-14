'use strict';

const fs = require('fs');
const path = require('path');

const gen = require('./generate-youtube-creators');

// ===== CONSTANTS =====

const SITE_ORIGIN = gen.SITE_ORIGIN;
const GAME_NAME = gen.GAME_NAME;
const GAME_NAME_ARTICLE = 'Invincible: Guarding the Globe';
const WATCH_DIR = 'watch';
const WATCH_CSS = 'watch.css';
const MAX_RELATED_FROM_CREATOR = 5;
const MAX_RELATED_SAME_CATEGORY = 6;
const MAX_CONTEXT_ENTITIES = 3;
const META_DESC_LIMIT = 158;
const SITEMAP_START = '<!--WATCH_SITEMAP_START-->';
const SITEMAP_END = '<!--WATCH_SITEMAP_END-->';
const CONTEXT_PATH = path.join(__dirname, '..', 'data', 'game-context.json');
// Events and modes are the specific, searchable thing; systems are background context.
const TYPE_PRIORITY = { event: 0, mode: 1, update: 2, system: 3 };

const CATEGORY_NOUN = {
  'Guides': 'guide',
  'Tier Lists': 'tier list',
  'Updates': 'update breakdown',
  'Events': 'event video',
  'Team Building': 'team building video',
  'Gameplay': 'gameplay video',
  'Livestreams': 'livestream'
};

const CATEGORY_GUIDE = {
  'Guides': { href: '/guide/beginners/', label: 'Beginner progression guide' },
  'Tier Lists': { href: '/guide/pvp/', label: 'PvP leagues and payouts' },
  'Updates': { href: '/guide/code/', label: 'Active promo codes' },
  'Events': { href: '/guide/event/', label: 'Event rewards guide' },
  'Team Building': { href: '/guide/pvp/', label: 'PvP leagues and payouts' },
  'Gameplay': { href: '/guide/xp/', label: 'XP and rank-up reference' },
  'Livestreams': { href: '/guide/creators/', label: 'Full creator directory' }
};

// ===== TEXT HELPERS =====

function plainText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}

function trimToLength(str, max) {
  if (str.length <= max) return str;
  var cut = str.slice(0, max);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return cut.replace(/[\s,;:.-]+$/, '') + '\u2026';
}

function pageTitle(video, creator) {
  return plainText(video.title) + ' \u2014 ' + plainText(creator.name) + ' | Invincible GTG';
}

function metaDescription(video, creator) {
  var noun = CATEGORY_NOUN[video.category] || 'video';
  var base = plainText(video.description);
  var tail = ' From ' + plainText(creator.name) + ' \u2014 an ' + GAME_NAME_ARTICLE + ' ' + noun + '.';
  var out = base ? base + tail : 'Watch ' + plainText(video.title) + ' by ' + plainText(creator.name) + '.' + tail;
  return trimToLength(out, META_DESC_LIMIT);
}

function humanDate(dateStr) {
  return gen.formatFeedDate(dateStr);
}

// ===== REAL YOUTUBE METADATA =====

// Populated by scripts/enrich-youtube-creators.js. Absent for videos that could not be
// read, in which case every helper degrades to the editorial fields.
function youtube(video) {
  return video.youtube || {};
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return m + ':' + String(s).padStart(2, '0');
}

// schema.org duration must be an ISO 8601 duration, e.g. PT41M22S.
function isoduration(seconds) {
  if (!seconds || seconds <= 0) return '';
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (s ? s + 'S' : '');
}

function formatViews(count) {
  if (typeof count !== 'number' || count < 0) return '';
  return count.toLocaleString('en-US');
}

// ===== GAME CONTEXT KNOWLEDGE BASE =====

function loadContext(contextPath) {
  var file = contextPath || CONTEXT_PATH;
  if (!fs.existsSync(file)) return { entities: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function entityHaystack(video) {
  var meta = youtube(video);
  return [
    video.title || '',
    video.description || '',
    meta.descriptionExcerpt || ''
  ].join(' ').toLowerCase();
}

// Alias matching is deliberately literal: an entity is only surfaced when its name
// actually appears in the video's real text. No guessing from category alone.
function matchEntities(video, context) {
  var haystack = entityHaystack(video);
  var matched = [];
  var entities = (context && context.entities) || [];

  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    for (var a = 0; a < entity.aliases.length; a++) {
      var alias = entity.aliases[a];
      var idx = haystack.indexOf(alias);
      if (idx === -1) continue;
      var before = idx === 0 ? ' ' : haystack.charAt(idx - 1);
      var after = haystack.charAt(idx + alias.length) || ' ';
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        matched.push(entity);
        break;
      }
    }
  }

  // Specific named events and modes outrank generic always-on systems, so a page about
  // Hail Mary leads with Boss Raid rather than "Recruitment Department". Longer names
  // break ties inside a tier.
  matched.sort(function (a, b) {
    var pa = TYPE_PRIORITY[a.type] === undefined ? 9 : TYPE_PRIORITY[a.type];
    var pb = TYPE_PRIORITY[b.type] === undefined ? 9 : TYPE_PRIORITY[b.type];
    if (pa !== pb) return pa - pb;
    return b.name.length - a.name.length;
  });
  return matched.slice(0, MAX_CONTEXT_ENTITIES);
}

// Creators post identically-titled videos (livestream VODs especially), so <title> and
// the meta description collide verbatim. Disambiguate with the publish date, then the
// video id, so every page has a unique title tag.
function assignUniqueMeta(items) {
  var seenTitles = {};
  var seenDescriptions = {};
  var meta = {};

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var video = item.video;
    var creator = item.creator;

    var title = pageTitle(video, creator);
    if (seenTitles[title]) {
      var datedTitle = title + ' (' + humanDate(video.published) + ')';
      title = seenTitles[datedTitle] ? title + ' (' + video.id + ')' : datedTitle;
    }
    seenTitles[title] = true;

    var description = metaDescription(video, creator);
    if (seenDescriptions[description]) {
      description = trimToLength(description + ' Published ' + humanDate(video.published) + '.', META_DESC_LIMIT);
    }
    if (seenDescriptions[description]) {
      description = trimToLength(description + ' Video ' + video.id + '.', META_DESC_LIMIT);
    }
    seenDescriptions[description] = true;

    meta[video.id] = { title: title, description: description };
  }

  return meta;
}

// ===== SELECTION =====

function sameCreatorVideos(data, video, creator) {
  var out = [];
  for (var i = 0; i < creator.videos.length; i++) {
    var v = creator.videos[i];
    if (v.id === video.id || v.status !== 'active') continue;
    out.push(v);
  }
  out.sort(function (a, b) { return new Date(b.published) - new Date(a.published); });
  return out.slice(0, MAX_RELATED_FROM_CREATOR);
}

function sameCategoryVideos(items, video) {
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.video.id === video.id) continue;
    if (item.video.category !== video.category) continue;
    out.push(item);
  }
  out.sort(function (a, b) { return new Date(b.video.published) - new Date(a.video.published); });
  return out.slice(0, MAX_RELATED_SAME_CATEGORY);
}

// ===== SCHEMA =====

// Built only from facts on the page: matched game entities, the video's real category,
// the creator, and the game itself.
function buildKeywords(video, creator, entities) {
  var terms = [];
  if (entities) {
    for (var i = 0; i < entities.length; i++) terms.push(entities[i].name);
  }
  terms.push(video.category);
  terms.push(GAME_NAME_ARTICLE);
  terms.push(plainText(creator.name));
  return terms.filter(Boolean).join(', ');
}

// Canonical WebSite entity. Every graph that references /#website defines it here.
function websiteNode() {
  return {
    '@id': SITE_ORIGIN + '/#website',
    '@type': 'WebSite',
    'name': 'Invincible GTG',
    'alternateName': 'Invincible Guarding the Globe Guides',
    'url': SITE_ORIGIN + '/',
    'inLanguage': 'en'
  };
}

function buildGraph(video, creator, meta, entities) {
  var watchUrl = gen.watchPageUrl(video);
  var title = meta.title;
  var description = meta.description;
  var isoTimestamp = gen.resolveUploadDate(video);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      websiteNode(),
      {
        '@id': SITE_ORIGIN + '/#game',
        '@type': 'VideoGame',
        'name': GAME_NAME,
        'alternateName': GAME_NAME_ARTICLE,
        'applicationCategory': 'GameApplication',
        'operatingSystem': 'iOS, Android',
        'gamePlatform': 'iOS, Android',
        'author': { '@type': 'Organization', 'name': 'Ubisoft Barcelona' }
      },
      {
        '@type': 'WebPage',
        '@id': watchUrl,
        'url': watchUrl,
        'name': title,
        'description': description,
        'inLanguage': 'en',
        'isPartOf': { '@id': SITE_ORIGIN + '/#website' },
        'about': { '@id': SITE_ORIGIN + '/#game' },
        'mainEntity': { '@id': watchUrl + '#video' },
        'primaryImageOfPage': {
          '@type': 'ImageObject',
          'url': gen.thumbnailUrl(video),
          'width': 480,
          'height': 360
        },
        'breadcrumb': { '@id': watchUrl + '#breadcrumb' },
        'datePublished': isoTimestamp,
        'dateModified': isoTimestamp,
        'keywords': buildKeywords(video, creator, entities)
      },
      gen.buildVideoObject(video, creator),
      {
        '@type': 'BreadcrumbList',
        '@id': watchUrl + '#breadcrumb',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE_ORIGIN + '/' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Creator Videos', 'item': SITE_ORIGIN + '/guide/creators/' },
          { '@type': 'ListItem', 'position': 3, 'name': plainText(video.title), 'item': watchUrl }
        ]
      }
    ]
  };
}

// ===== RENDERING: HEAD =====

function renderHead(video, creator, meta, entities) {
  var title = meta.title;
  var description = meta.description;
  var watchUrl = gen.watchPageUrl(video);
  var thumbnail = gen.thumbnailUrl(video);
  var embedUrl = 'https://www.youtube-nocookie.com/embed/' + video.id;
  var altText = 'Thumbnail for ' + plainText(video.title) + ' by ' + plainText(creator.name);

  var h = [];
  h.push('    <meta charset="UTF-8">');
  h.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  h.push('    <meta name="theme-color" content="#050a14">');
  h.push('    <meta name="color-scheme" content="dark light">');
  h.push('    <meta name="referrer" content="strict-origin-when-cross-origin">');
  h.push('    <meta name="description" content="' + gen.escapeHtml(description) + '">');
  h.push('    <meta name="robots" content="max-snippet:150, max-image-preview:large, max-video-preview:-1">');
  h.push('    <meta name="date" content="' + gen.escapeHtml(video.published) + '">');
  h.push('    <link rel="icon" type="image/svg+xml" href="../../favicon.svg">');
  h.push('    <link rel="icon" href="../../favicon.ico" sizes="any">');
  h.push('    <link rel="author" href="' + SITE_ORIGIN + '/authors/anomaly/">');
  h.push('    <link rel="canonical" href="' + gen.escapeHtml(watchUrl) + '">');
  h.push('    <meta property="og:title" content="' + gen.escapeHtml(title) + '">');
  h.push('    <meta property="og:description" content="' + gen.escapeHtml(description) + '">');
  h.push('    <meta property="og:site_name" content="Invincible GTG">');
  h.push('    <meta property="og:locale" content="en_US">');
  h.push('    <meta property="og:url" content="' + gen.escapeHtml(watchUrl) + '">');
  h.push('    <meta property="og:type" content="video.other">');
  h.push('    <meta property="og:image" content="' + gen.escapeHtml(thumbnail) + '">');
  h.push('    <meta property="og:image:type" content="image/jpeg">');
  h.push('    <meta property="og:image:width" content="480">');
  h.push('    <meta property="og:image:height" content="360">');
  h.push('    <meta property="og:image:alt" content="' + gen.escapeHtml(altText) + '">');
  h.push('    <meta property="og:video:url" content="' + gen.escapeHtml(embedUrl) + '">');
  h.push('    <meta property="og:video:secure_url" content="' + gen.escapeHtml(embedUrl) + '">');
  h.push('    <meta property="og:video:type" content="text/html">');
  h.push('    <meta property="og:video:width" content="1280">');
  h.push('    <meta property="og:video:height" content="720">');
  h.push('    <meta name="twitter:site" content="@InvincibleGtG">');
  h.push('    <meta name="twitter:creator" content="@anomaly_alpha">');
  h.push('    <meta name="twitter:card" content="summary_large_image">');
  h.push('    <meta name="twitter:image" content="' + gen.escapeHtml(thumbnail) + '">');
  h.push('    <meta name="twitter:title" content="' + gen.escapeHtml(title) + '">');
  h.push('    <meta name="twitter:description" content="' + gen.escapeHtml(description) + '">');
  h.push('    <title>' + gen.escapeHtml(title) + '</title>');
  h.push('    <link rel="stylesheet" href="../../tailwind.css">');
  h.push('    <link rel="stylesheet" href="../../styles.css">');
  h.push('    <link rel="stylesheet" href="../' + WATCH_CSS + '">');
  h.push('    <link rel="preload" href="../../fonts/Orbitron-Variable.woff2" as="font" type="font/woff2" crossorigin>');
  h.push('    <link rel="preload" href="../../fonts/Rajdhani-Regular.woff2" as="font" type="font/woff2" crossorigin>');
  h.push('    <script type="application/ld+json">');
  h.push(gen.escapeJsonLd(JSON.stringify(buildGraph(video, creator, meta, entities), null, 2)));
  h.push('    </script>');
  return h.join('\n');
}

// ===== RENDERING: BODY PIECES =====

function renderGuideNav(video) {
  var categoryGuide = CATEGORY_GUIDE[video.category] || CATEGORY_GUIDE['Guides'];
  var h = [];
  h.push('        <nav aria-label="Video sections" class="flex flex-wrap gap-4 items-center text-sm gem-text--cyan mb-6 p-4 border-b border-white/10">');
  h.push('            <a href="../../" class="hover:text-white transition-colors">&larr; Calculate Your Gems</a>');
  h.push('            <span class="text-white/30">|</span>');
  h.push('            <a href="../../guide/creators/" class="hover:text-white transition-colors gem-text--cyan">Creators</a>');
  h.push('            <a href="../../' + categoryGuide.href.replace(/^\//, '') + '" class="hover:text-white transition-colors gem-text--cyan">' + gen.escapeHtml(categoryGuide.label) + '</a>');
  h.push('            <a href="../../guide/code/" class="hover:text-white transition-colors gem-text--code">Code</a>');
  h.push('            <a href="../../guide/pvp/" class="hover:text-white transition-colors gem-text--pvp">PvP</a>');
  h.push('            <a href="../../guide/event/" class="hover:text-white transition-colors gem-text--event">Events</a>');
  h.push('            <a href="../../music/" class="hover:text-white transition-colors gem-text--cyan">Music</a>');
  h.push('        </nav>');
  return h.join('\n');
}

function renderPlayer(video, creator) {
  var embedUrl = 'https://www.youtube-nocookie.com/embed/' + video.id + '?rel=0';
  var label = plainText(video.title) + ' by ' + plainText(creator.name);
  var h = [];
  h.push('        <figure class="gem-watch__player">');
  h.push('            <iframe');
  h.push('                src="' + gen.escapeHtml(embedUrl) + '"');
  h.push('                title="' + gen.escapeHtml(label) + '"');
  h.push('                width="1280"');
  h.push('                height="720"');
  h.push('                loading="eager"');
  h.push('                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"');
  h.push('                referrerpolicy="strict-origin-when-cross-origin"');
  h.push('                allowfullscreen');
  h.push('            ></iframe>');
  h.push('            <figcaption class="gem-watch__caption">');
  h.push('                Playing through YouTube\'s privacy-enhanced embed mode. If the player does not load,');
  h.push('                <a href="https://www.youtube.com/watch?v=' + gen.escapeHtml(video.id) + '" target="_blank" rel="noopener noreferrer">watch this video on YouTube</a>.');
  h.push('            </figcaption>');
  h.push('        </figure>');
  return h.join('\n');
}

function renderAbout(video, creator) {
  var description = plainText(video.description);
  var noun = CATEGORY_NOUN[video.category] || 'video';
  var categoryGuide = CATEGORY_GUIDE[video.category] || CATEGORY_GUIDE['Guides'];
  var h = [];
  h.push('        <section class="mx-4 mb-8" aria-labelledby="aboutTitle">');
  h.push('            <h2 id="aboutTitle" class="text-xl font-bold text-white mb-4 tracking-wider">About this video</h2>');
  h.push('            <div class="gem-card gem-card--code p-5">');
  h.push('                <p class="text-white/80 leading-relaxed">' + gen.escapeHtml(description) + '</p>');
  h.push('                <p class="text-white/70 leading-relaxed mt-4">');
  h.push('                    <strong class="text-white">' + gen.escapeHtml(plainText(creator.name)) + '</strong> published this ' + gen.escapeHtml(noun) +
    ' on <time datetime="' + gen.escapeHtml(video.published) + '">' + gen.escapeHtml(humanDate(video.published)) + '</time>,');
  h.push('                    filed under <span class="gem-text--cyan">' + gen.escapeHtml(video.category) + '</span> coverage for ' + GAME_NAME_ARTICLE + '.');
  h.push('                    For the written reference that pairs with it, see the <a href="../../' + categoryGuide.href.replace(/^\//, '') + '" class="gem-text--cyan underline">' + gen.escapeHtml(categoryGuide.label.toLowerCase()) + '</a>.');
  h.push('                </p>');
  h.push('            </div>');
  h.push('        </section>');
  return h.join('\n');
}

function renderFacts(video, creator) {
  var meta = youtube(video);
  var runtime = formatDuration(meta.durationSeconds);
  var views = formatViews(meta.viewCount);

  var h = [];
  h.push('        <section class="mx-4 mb-8" aria-labelledby="factsTitle">');
  h.push('            <h2 id="factsTitle" class="text-xl font-bold text-white mb-4 tracking-wider">Video details</h2>');
  h.push('            <dl class="gem-watch__facts gem-card p-5">');
  h.push('                <div class="gem-watch__fact"><dt>Title</dt><dd>' + gen.escapeHtml(plainText(video.title)) + '</dd></div>');
  h.push('                <div class="gem-watch__fact"><dt>Creator</dt><dd>' + gen.escapeHtml(plainText(creator.name)) + '</dd></div>');
  if (creator.handle) {
    h.push('                <div class="gem-watch__fact"><dt>Handle</dt><dd>' + gen.escapeHtml(creator.handle) + '</dd></div>');
  }
  h.push('                <div class="gem-watch__fact"><dt>Channel</dt><dd><a href="' + gen.escapeHtml(creator.channelUrl) + '" target="_blank" rel="noopener noreferrer" class="gem-text--cyan underline">' + gen.escapeHtml(plainText(creator.name)) + ' on YouTube</a></dd></div>');
  h.push('                <div class="gem-watch__fact"><dt>Published</dt><dd><time datetime="' + gen.escapeHtml(video.published) + '">' + gen.escapeHtml(humanDate(video.published)) + '</time></dd></div>');
  h.push('                <div class="gem-watch__fact"><dt>Category</dt><dd>' + gen.escapeHtml(video.category) + '</dd></div>');
  if (runtime) {
    h.push('                <div class="gem-watch__fact"><dt>Runtime</dt><dd>' + gen.escapeHtml(runtime) + '</dd></div>');
  }
  if (views) {
    h.push('                <div class="gem-watch__fact"><dt>Views</dt><dd>' + gen.escapeHtml(views) + ' <span class="opacity-60">as of ' + gen.escapeHtml(humanDate(meta.checkedAt)) + '</span></dd></div>');
  }
  if (meta.isLive === true) {
    h.push('                <div class="gem-watch__fact"><dt>Format</dt><dd>Livestream recording</dd></div>');
  }
  h.push('                <div class="gem-watch__fact"><dt>Game</dt><dd><a href="../../" class="gem-text--cyan underline">' + GAME_NAME_ARTICLE + '</a></dd></div>');
  h.push('                <div class="gem-watch__fact"><dt>Last verified</dt><dd><time datetime="' + gen.escapeHtml(video.lastChecked) + '">' + gen.escapeHtml(humanDate(video.lastChecked)) + '</time></dd></div>');
  h.push('            </dl>');
  h.push('        </section>');
  return h.join('\n');
}

function renderCreatorExcerpt(video, creator) {
  var meta = youtube(video);
  var excerpt = plainText(meta.descriptionExcerpt);
  if (excerpt.length < 24) return '';

  var h = [];
  h.push('        <section class="mx-4 mb-8" aria-labelledby="excerptTitle">');
  h.push('            <h2 id="excerptTitle" class="text-xl font-bold text-white mb-4 tracking-wider">From the creator\'s description</h2>');
  h.push('            <blockquote class="gem-card p-5 gem-watch__quote">');
  h.push('                <p class="text-white/80 leading-relaxed">&ldquo;' + gen.escapeHtml(excerpt) + '&rdquo;</p>');
  h.push('                <footer class="text-sm gem-text--muted mt-3">&mdash; ' + gen.escapeHtml(plainText(creator.name)) +
    ', <a href="https://www.youtube.com/watch?v=' + gen.escapeHtml(video.id) + '" target="_blank" rel="noopener noreferrer" class="gem-text--cyan underline">video description on YouTube</a></footer>');
  h.push('            </blockquote>');
  h.push('        </section>');
  return h.join('\n');
}

function renderGameContext(entities) {
  if (!entities || entities.length === 0) return '';

  var h = [];
  h.push('        <section class="mx-4 mb-8" aria-labelledby="contextTitle">');
  h.push('            <h2 id="contextTitle" class="text-xl font-bold text-white mb-4 tracking-wider">Game context</h2>');
  h.push('            <p class="text-sm gem-text--muted mb-4">Background on the game systems named in this video. Written from publisher sources, not from the video itself.</p>');
  h.push('            <div class="gem-watch__context">');
  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    var source = entity.source || {};
    h.push('                <article class="gem-card p-5 gem-watch__context-item">');
    h.push('                    <h3 class="text-lg font-bold gem-text--cyan mb-2">' + gen.escapeHtml(entity.name) + '</h3>');
    h.push('                    <p class="text-white/80 leading-relaxed">' + gen.escapeHtml(entity.summary) + '</p>');
    h.push('                    <p class="text-sm gem-text--muted mt-3">');
    h.push('                        Source: <a href="' + gen.escapeHtml(source.url || '#') + '" target="_blank" rel="noopener noreferrer" class="gem-text--cyan underline">' + gen.escapeHtml(source.publisher || 'publisher') + '</a>');
    if (entity.guideHref) {
      h.push('                        <span class="mx-2 opacity-30">&middot;</span>');
      h.push('                        <a href="../..' + gen.escapeHtml(entity.guideHref) + '" class="gem-text--cyan underline">' + gen.escapeHtml(entity.guideLabel || 'Related guide') + '</a>');
    }
    h.push('                    </p>');
    h.push('                </article>');
  }
  h.push('            </div>');
  h.push('        </section>');
  return h.join('\n');
}

function renderRelatedList(title, id, links) {
  if (links.length === 0) return '';
  var h = [];
  h.push('        <section class="mx-4 mb-8" aria-labelledby="' + id + '">');
  h.push('            <h2 id="' + id + '" class="text-xl font-bold text-white mb-4 tracking-wider">' + gen.escapeHtml(title) + '</h2>');
  h.push('            <ul class="gem-watch__related">');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    h.push('                <li class="gem-watch__related-item">');
    h.push('                    <a href="' + gen.escapeHtml(link.href) + '" class="gem-watch__related-link">');
    h.push('                        <span class="gem-watch__related-title">' + gen.escapeHtml(plainText(link.title)) + '</span>');
    h.push('                        <span class="gem-watch__related-meta">' + gen.escapeHtml(link.meta) + '</span>');
    h.push('                    </a>');
    h.push('                </li>');
  }
  h.push('            </ul>');
  h.push('        </section>');
  return h.join('\n');
}

function renderDisclosure() {
  var h = [];
  h.push('        <aside class="mx-4 mb-8 gem-watch__note" role="note" aria-label="Video notes">');
  h.push('            <p class="gem-watch__note-item"><strong>Hosting note</strong> This page embeds a video hosted on YouTube. Playback, captions, and availability are controlled by YouTube and the creator, not by Anomaly Alpha.</p>');
  h.push('            <p class="gem-watch__note-item"><strong>Independence note</strong> Listing is based on content eligibility thresholds, not sponsorship. Creators are independent community members and are not endorsed by Ubisoft, Skybound, or YouTube.</p>');
  h.push('        </aside>');
  return h.join('\n');
}

function renderGuideCards() {
  var h = [];
  h.push('        <section class="gem-grid--cards mx-4 mb-8">');
  h.push('            <a href="../../guide/creators/" class="gem-card gem-card--code p-5 text-center" aria-label="YouTube Creators">');
  h.push('                <h3 class="text-lg font-bold gem-text--cyan mb-2">Creator Directory</h3>');
  h.push('                <p class="text-white/60 text-sm">Every indexed video from every tracked creator</p>');
  h.push('            </a>');
  h.push('            <a href="../../guide/code/" class="gem-card gem-card--code p-5 text-center" aria-label="Invincible Guarding the Globe Codes">');
  h.push('                <h3 class="text-lg font-bold gem-text--code mb-2">Codes</h3>');
  h.push('                <p class="text-white/60 text-sm">Active promo codes, rewards, and how to redeem</p>');
  h.push('            </a>');
  h.push('            <a href="../../guide/event/" class="gem-card gem-card--event p-5 text-center" aria-label="Event Rewards Guide">');
  h.push('                <h3 class="text-lg font-bold gem-text--event mb-2">Events</h3>');
  h.push('                <p class="text-white/60 text-sm">Reward brackets and ranking strategies</p>');
  h.push('            </a>');
  h.push('            <a href="../../guide/pvp/" class="gem-card gem-card--pvp p-5 text-center" aria-label="PvP Rewards Guide">');
  h.push('                <h3 class="text-lg font-bold gem-text--pvp mb-2">PvP</h3>');
  h.push('                <p class="text-white/60 text-sm">All 14 leagues and payout tables explained</p>');
  h.push('            </a>');
  h.push('            <a href="../../guide/xp/" class="gem-card gem-card--code p-5 text-center" aria-label="XP and Rank-Up Guide">');
  h.push('                <h3 class="text-lg font-bold gem-text--cyan mb-2">XP &amp; Rank-Up</h3>');
  h.push('                <p class="text-white/60 text-sm">Hero, Agent, and Special XP requirements</p>');
  h.push('            </a>');
  h.push('            <a href="../../guide/login/" class="gem-card gem-card--login p-5 text-center" aria-label="Login Rewards Guide">');
  h.push('                <h3 class="text-lg font-bold gem-text--login mb-2">Login Rewards</h3>');
  h.push('                <p class="text-white/60 text-sm">Daily, weekly, and monthly bonuses</p>');
  h.push('            </a>');
  h.push('        </section>');
  return h.join('\n');
}

function renderFooter() {
  var h = [];
  h.push('        <footer class="mx-4 mt-8 mb-4">');
  h.push('            <nav aria-label="Guide links" class="flex flex-wrap gap-4 justify-center text-sm gem-text--cyan border-t border-white/10 pt-4">');
  h.push('                <a href="../../" class="gem-text--cyan hover:text-white transition-colors">&larr; Calculate Your Gems</a>');
  h.push('                <a href="../../guide/creators/" class="hover:text-white transition-colors gem-text--cyan">Creators</a>');
  h.push('                <a href="../../guide/code/" class="hover:text-white transition-colors gem-text--code">Codes</a>');
  h.push('                <a href="../../guide/event/" class="hover:text-white transition-colors gem-text--event">Events</a>');
  h.push('                <a href="../../guide/pvp/" class="hover:text-white transition-colors gem-text--pvp">PvP</a>');
  h.push('                <a href="../../guide/xp/" class="hover:text-white transition-colors gem-text--cyan">XP</a>');
  h.push('            </nav>');
  h.push('        </footer>');
  return h.join('\n');
}

function renderLegalFooter() {
  return [
    '    <footer class="gem-legal-footer">',
    '        <a href="../../terms/" class="gem-legal-footer__link">Terms of Service</a>',
    '        <span class="gem-legal-footer__sep">&middot;</span>',
    '        <a href="../../privacy/" class="gem-legal-footer__link">Privacy Policy</a>',
    '    </footer>'
  ].join('\n');
}

function renderBreadcrumbs(video) {
  var h = [];
  h.push('        <nav aria-label="Breadcrumb" class="gem-breadcrumb mb-3">');
  h.push('            <ol class="gem-breadcrumb__list">');
  h.push('                <li class="gem-breadcrumb__item">');
  h.push('                    <a href="../../" class="gem-breadcrumb__link">Home</a>');
  h.push('                    <span class="gem-breadcrumb__sep" aria-hidden="true">&rsaquo;</span>');
  h.push('                </li>');
  h.push('                <li class="gem-breadcrumb__item">');
  h.push('                    <a href="../../guide/creators/" class="gem-breadcrumb__link">Creator Videos</a>');
  h.push('                    <span class="gem-breadcrumb__sep" aria-hidden="true">&rsaquo;</span>');
  h.push('                </li>');
  h.push('                <li class="gem-breadcrumb__item gem-breadcrumb__item--current" aria-current="page">' + gen.escapeHtml(plainText(video.title)) + '</li>');
  h.push('            </ol>');
  h.push('        </nav>');
  return h.join('\n');
}

// ===== RENDERING: PAGE =====

function renderPage(data, video, creator, meta, entities) {
  var items = gen.getVisibleFeedItems(data);
  if (!meta) {
    meta = { title: pageTitle(video, creator), description: metaDescription(video, creator) };
  }
  var fromCreator = sameCreatorVideos(data, video, creator).map(function (v) {
    return {
      href: '../' + v.id + '/',
      title: v.title,
      meta: humanDate(v.published) + ' \u00b7 ' + v.category
    };
  });
  var sameCategory = sameCategoryVideos(items, video).map(function (item) {
    return {
      href: '../' + item.video.id + '/',
      title: item.video.title,
      meta: humanDate(item.video.published) + ' \u00b7 ' + plainText(item.creator.name)
    };
  });

  var h = [];
  h.push('<!DOCTYPE html>');
  h.push('<html lang="en">');
  h.push('<head>');
  h.push(renderHead(video, creator, meta, entities));
  h.push('</head>');
  h.push('<body class="relative min-h-screen p-5 md:p-10 gem-grid-bg">');
  h.push('    <div class="relative gem-container gem-container__shadow max-w-4xl mx-auto">');
  h.push('        <div class="gem-corner gem-corner--tl"></div>');
  h.push('        <div class="gem-corner gem-corner--tr"></div>');
  h.push('        <div class="gem-corner gem-corner--bl"></div>');
  h.push('        <div class="gem-corner gem-corner--br"></div>');
  h.push('');
  h.push(renderBreadcrumbs(video));
  h.push('');
  h.push(renderGuideNav(video));
  h.push('');
  h.push('        <main>');
  h.push('        <article>');
  h.push('            <div class="text-center mb-6">');
  h.push('                <h1 class="gem-title--hero text-3xl md:text-4xl">' + gen.escapeHtml(plainText(video.title)) + '</h1>');
  h.push('                <p class="gem-subtitle--hero mt-3">');
  h.push('                    <a href="' + gen.escapeHtml(creator.channelUrl) + '" target="_blank" rel="noopener noreferrer" class="gem-text--cyan font-semibold hover:text-white transition-colors">' + gen.escapeHtml(plainText(creator.name)) + '</a>');
  h.push('                    <span class="gem-watch__meta-group"><span class="mx-2 opacity-30">&middot;</span><time datetime="' + gen.escapeHtml(video.published) + '">' + gen.escapeHtml(humanDate(video.published)) + '</time></span>');
  h.push('                    <span class="gem-watch__meta-group"><span class="mx-2 opacity-30">&middot;</span><span class="gem-text--cyan">' + gen.escapeHtml(video.category) + '</span></span>');
  h.push('                </p>');
  h.push('            </div>');
  h.push('');
  h.push(renderPlayer(video, creator));
  h.push('');
  h.push(renderAbout(video, creator));
  h.push('');
  var excerpt = renderCreatorExcerpt(video, creator);
  if (excerpt) {
    h.push(excerpt);
    h.push('');
  }
  h.push(renderGameContext(entities));
  if (entities && entities.length > 0) h.push('');
  h.push(renderFacts(video, creator));
  h.push('');
  if (fromCreator.length > 0) {
    h.push(renderRelatedList('More from ' + plainText(creator.name), 'moreFromCreator', fromCreator));
    h.push('');
  }
  if (sameCategory.length > 0) {
    h.push(renderRelatedList('Related ' + video.category + ' videos', 'relatedCategory', sameCategory));
    h.push('');
  }
  h.push(renderDisclosure());
  h.push('        </article>');
  h.push('        </main>');
  h.push('');
  h.push(renderGuideCards());
  h.push('');
  h.push(renderFooter());
  h.push('');
  h.push('    </div>');
  h.push(renderLegalFooter());
  h.push('</body>');
  h.push('</html>');
  h.push('');
  return h.join('\n');
}

// ===== RENDERING: HUB =====

function renderHub(data) {
  var creators = gen.getVisibleCreators(data);
  var total = 0;

  var groups = [];
  for (var i = 0; i < creators.length; i++) {
    var creator = creators[i];
    var videos = creator.videos
      .filter(function (v) { return v.status === 'active'; })
      .sort(function (a, b) { return new Date(b.published) - new Date(a.published); })
      .slice(0, gen.MAX_VIDEOS_PER_CREATOR);
    if (videos.length === 0) continue;
    total += videos.length;
    groups.push({ creator: creator, videos: videos });
  }

  var h = [];
  h.push('<!DOCTYPE html>');
  h.push('<html lang="en">');
  h.push('<head>');
  h.push('    <meta charset="UTF-8">');
  h.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  h.push('    <meta name="theme-color" content="#050a14">');
  h.push('    <meta name="color-scheme" content="dark light">');
  h.push('    <meta name="referrer" content="strict-origin-when-cross-origin">');
  h.push('    <meta name="description" content="Watch page index for every tracked Invincible: Guarding the Globe creator video, grouped by creator with publish dates and categories.">');
  h.push('    <meta name="robots" content="max-snippet:150, max-image-preview:large">');
  h.push('    <link rel="icon" type="image/svg+xml" href="../favicon.svg">');
  h.push('    <link rel="canonical" href="' + SITE_ORIGIN + '/watch/">');
  h.push('    <meta property="og:title" content="Invincible GTG Video Watch Pages">');
  h.push('    <meta property="og:description" content="Watch page index for every tracked Invincible: Guarding the Globe creator video.">');
  h.push('    <meta property="og:type" content="website">');
  h.push('    <meta property="og:url" content="' + SITE_ORIGIN + '/watch/">');
  h.push('    <meta property="og:image" content="' + SITE_ORIGIN + '/og-images/creators.png">');
  h.push('    <meta property="og:image:width" content="1200">');
  h.push('    <meta property="og:image:height" content="630">');
  h.push('    <meta property="og:site_name" content="Invincible GTG">');
  h.push('    <meta name="twitter:site" content="@InvincibleGtG">');
  h.push('    <meta name="twitter:card" content="summary_large_image">');
  h.push('    <meta name="twitter:image" content="' + SITE_ORIGIN + '/og-images/creators.png">');
  h.push('    <meta name="twitter:title" content="Invincible GTG Video Watch Pages">');
  h.push('    <meta name="twitter:description" content="Watch page index for every tracked Invincible: Guarding the Globe creator video.">');
  h.push('    <title>Invincible GTG Video Watch Pages</title>');
  h.push('    <link rel="stylesheet" href="../tailwind.css">');
  h.push('    <link rel="stylesheet" href="../styles.css">');
  h.push('    <link rel="stylesheet" href="' + WATCH_CSS + '">');
  h.push('    <script type="application/ld+json">');
  h.push(gen.escapeJsonLd(JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': SITE_ORIGIN + '/watch/',
        'url': SITE_ORIGIN + '/watch/',
        'name': 'Invincible GTG Video Watch Pages',
        'description': 'Index of dedicated watch pages for tracked Invincible: Guarding the Globe creator videos.',
        'inLanguage': 'en',
        'isPartOf': { '@id': SITE_ORIGIN + '/#website' },
        'mainEntity': {
          '@type': 'ItemList',
          'numberOfItems': total,
          'itemListElement': groups.reduce(function (acc, group) {
            for (var vi = 0; vi < group.videos.length; vi++) {
              acc.push({
                '@type': 'ListItem',
                'position': acc.length + 1,
                'name': group.videos[vi].title,
                'url': gen.watchPageUrl(group.videos[vi])
              });
            }
            return acc;
          }, [])
        }
      },
      websiteNode()
    ]
  }, null, 2)));
  h.push('    </script>');
  h.push('</head>');
  h.push('<body class="relative min-h-screen p-5 md:p-10 gem-grid-bg">');
  h.push('    <div class="relative gem-container gem-container__shadow max-w-4xl mx-auto">');
  h.push('        <div class="gem-corner gem-corner--tl"></div>');
  h.push('        <div class="gem-corner gem-corner--tr"></div>');
  h.push('        <div class="gem-corner gem-corner--bl"></div>');
  h.push('        <div class="gem-corner gem-corner--br"></div>');
  h.push('        <nav aria-label="Breadcrumb" class="gem-breadcrumb mb-3">');
  h.push('            <ol class="gem-breadcrumb__list">');
  h.push('                <li class="gem-breadcrumb__item"><a href="../" class="gem-breadcrumb__link">Home</a><span class="gem-breadcrumb__sep" aria-hidden="true">&rsaquo;</span></li>');
  h.push('                <li class="gem-breadcrumb__item"><a href="../guide/creators/" class="gem-breadcrumb__link">Creator Videos</a><span class="gem-breadcrumb__sep" aria-hidden="true">&rsaquo;</span></li>');
  h.push('                <li class="gem-breadcrumb__item gem-breadcrumb__item--current" aria-current="page">Watch Pages</li>');
  h.push('            </ol>');
  h.push('        </nav>');
  h.push('        <main>');
  h.push('        <article>');
  h.push('            <div class="text-center mb-8">');
  h.push('                <h1 class="gem-title--hero text-3xl md:text-4xl">Invincible GTG Video Watch Pages</h1>');
  h.push('                <p class="gem-subtitle--hero mt-3">One page per video, grouped by creator</p>');
  h.push('            </div>');
  h.push('            <section class="mx-4 mb-8">');
  h.push('                <div class="gem-card gem-card--code p-5">');
  h.push('                    <p class="text-white/80 leading-relaxed">Every tracked ' + GAME_NAME_ARTICLE + ' creator video has its own watch page so each one can be crawled, indexed, and shared on its own. There are <strong class="text-white">' + total + '</strong> pages across <strong class="text-white">' + groups.length + '</strong> creators, newest first within each creator.</p>');
  h.push('                    <p class="text-sm gem-text--cyan mt-4">Looking for the full directory with playable cards? <a href="../guide/creators/" class="underline font-semibold">Open the creator directory &rarr;</a></p>');
  h.push('                </div>');
  h.push('            </section>');

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    h.push('            <section class="mx-4 mb-8" aria-labelledby="creator-' + gen.escapeHtml(group.creator.id) + '">');
    h.push('                <h2 id="creator-' + gen.escapeHtml(group.creator.id) + '" class="text-xl font-bold text-white mb-4 tracking-wider">' + gen.escapeHtml(plainText(group.creator.name)) + '</h2>');
    h.push('                <ul class="gem-watch__related">');
    for (var vj = 0; vj < group.videos.length; vj++) {
      var video = group.videos[vj];
      h.push('                    <li class="gem-watch__related-item">');
      h.push('                        <a href="' + gen.escapeHtml(video.id) + '/" class="gem-watch__related-link">');
      h.push('                            <span class="gem-watch__related-title">' + gen.escapeHtml(plainText(video.title)) + '</span>');
      h.push('                            <span class="gem-watch__related-meta">' + gen.escapeHtml(humanDate(video.published)) + ' &middot; ' + gen.escapeHtml(video.category) + '</span>');
      h.push('                        </a>');
      h.push('                    </li>');
    }
    h.push('                </ul>');
    h.push('            </section>');
  }

  h.push('        </article>');
  h.push('        </main>');
  h.push('');
  h.push(renderGuideCards());
  h.push('');
  h.push(renderFooter());
  h.push('');
  h.push('    </div>');
  h.push(renderLegalFooter());
  h.push('</body>');
  h.push('</html>');
  h.push('');
  return { html: h.join('\n'), total: total, creators: groups.length };
}

// ===== SITEMAP =====

function renderSitemapEntries(data, lastmod) {
  var items = gen.getVisibleFeedItems(data);
  var lines = [];
  lines.push('  <url>');
  lines.push('    <loc>' + SITE_ORIGIN + '/watch/</loc>');
  lines.push('    <lastmod>' + lastmod + '</lastmod>');
  lines.push('    <changefreq>weekly</changefreq>');
  lines.push('    <priority>0.5</priority>');
  lines.push('  </url>');
  for (var i = 0; i < items.length; i++) {
    var video = items[i].video;
    lines.push('  <url>');
    lines.push('    <loc>' + gen.watchPageUrl(video) + '</loc>');
    lines.push('    <lastmod>' + video.published + '</lastmod>');
    lines.push('    <changefreq>monthly</changefreq>');
    lines.push('    <priority>0.4</priority>');
    lines.push('  </url>');
  }
  return lines.join('\n');
}

function updateSitemap(sitemapPath, data) {
  if (!fs.existsSync(sitemapPath)) {
    throw new Error('sitemap.xml not found at ' + sitemapPath);
  }
  var xml = fs.readFileSync(sitemapPath, 'utf8');
  var startIdx = xml.indexOf(SITEMAP_START);
  var endIdx = xml.indexOf(SITEMAP_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error('sitemap.xml is missing ' + SITEMAP_START + ' / ' + SITEMAP_END + ' markers');
  }
  var lastmod = data.updated;
  var entries = renderSitemapEntries(data, lastmod);
  var updated = xml.slice(0, startIdx) + SITEMAP_START + '\n' + entries + '\n' + SITEMAP_END + xml.slice(endIdx + SITEMAP_END.length);
  fs.writeFileSync(sitemapPath, updated, 'utf8');
  return entries;
}

// ===== MAIN =====

function generate(rootDir) {
  var sourcePath = path.join(rootDir, 'data', 'youtube-creators.json');
  var result = gen.buildData(sourcePath);
  if (result.errors.length > 0) {
    return { success: false, errors: result.errors, written: 0 };
  }

  var data = result.data;
  var items = gen.getVisibleFeedItems(data);
  var meta = assignUniqueMeta(items);
  var context = loadContext(path.join(rootDir, 'data', 'game-context.json'));
  var entities = {};
  for (var m = 0; m < items.length; m++) {
    entities[items[m].video.id] = matchEntities(items[m].video, context);
  }
  var watchDir = path.join(rootDir, WATCH_DIR);
  fs.mkdirSync(watchDir, { recursive: true });

  var keep = { 'index.html': true, [WATCH_CSS]: true };
  var written = 0;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var video = item.video;
    var creator = item.creator;
    var dir = path.join(watchDir, video.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPage(data, video, creator, meta[video.id], entities[video.id]), 'utf8');
    keep[video.id] = true;
    written++;
  }

  var hub = renderHub(data);
  fs.writeFileSync(path.join(watchDir, 'index.html'), hub.html, 'utf8');

  // Prune directories for videos that are no longer visible, so the page set mirrors the data.
  var removed = [];
  var entries = fs.readdirSync(watchDir, { withFileTypes: true });
  for (var e = 0; e < entries.length; e++) {
    var entry = entries[e];
    if (!entry.isDirectory()) continue;
    if (keep[entry.name]) continue;
    fs.rmSync(path.join(watchDir, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }

  var sitemapPath = path.join(rootDir, 'sitemap.xml');
  updateSitemap(sitemapPath, data);

  return {
    success: true,
    errors: [],
    written: written,
    removed: removed,
    total: hub.total,
    creators: hub.creators
  };
}

// ===== CLI =====

if (require.main === module) {
  var rootDir = path.resolve(__dirname, '..');
  var sourcePath = path.join(rootDir, 'data', 'youtube-creators.json');

  if (!fs.existsSync(sourcePath)) {
    console.log('Source data not found at ' + sourcePath + '; skipping watch page generation.');
    process.exit(0);
  }

  var out = generate(rootDir);
  if (!out.success) {
    console.error('Watch page generation failed:');
    for (var i = 0; i < out.errors.length; i++) {
      console.error('  - ' + out.errors[i]);
    }
    process.exit(1);
  }

  console.log('Wrote ' + out.written + ' watch pages across ' + out.creators + ' creators (+ hub)');
  if (out.removed.length > 0) {
    console.log('Pruned ' + out.removed.length + ' stale watch director' + (out.removed.length === 1 ? 'y' : 'ies') + ': ' + out.removed.join(', '));
  }
  console.log('Updated sitemap.xml');
}

// ===== EXPORTS =====

module.exports = {
  generate: generate,
  renderPage: renderPage,
  renderHub: renderHub,
  renderHead: renderHead,
  renderSitemapEntries: renderSitemapEntries,
  updateSitemap: updateSitemap,
  buildGraph: buildGraph,
  matchEntities: matchEntities,
  renderGameContext: renderGameContext,
  renderCreatorExcerpt: renderCreatorExcerpt,
  loadContext: loadContext,
  buildKeywords: buildKeywords,
  formatDuration: formatDuration,
  isoduration: isoduration,
  formatViews: formatViews,
  pageTitle: pageTitle,
  metaDescription: metaDescription,
  assignUniqueMeta: assignUniqueMeta,
  plainText: plainText,
  trimToLength: trimToLength,
  sameCreatorVideos: sameCreatorVideos,
  sameCategoryVideos: sameCategoryVideos,
  CATEGORY_GUIDE: CATEGORY_GUIDE,
  SITEMAP_START: SITEMAP_START,
  SITEMAP_END: SITEMAP_END,
  WATCH_CSS: WATCH_CSS
};
