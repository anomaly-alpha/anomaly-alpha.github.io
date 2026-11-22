const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'playlists.json');
const CREATORS_PATH = path.join(ROOT, 'data', 'youtube-creators.json');
const PAGE_PATH = path.join(ROOT, 'music', 'index.html');
const SITE_ORIGIN = 'https://anomaly-alpha.github.io';
// Colours the banner link may use. Each one clears 4.5:1 on the banner background in both
// colour modes; --gem-purple is excluded because #9b59b6 hits only 4.24:1 on the dark bar.
const COLORS = ['event', 'pvp', 'login', 'code', 'cyan'];
const BANNER_START = '<!--MUSIC_BANNER_START-->';
const BANNER_END = '<!--MUSIC_BANNER_END-->';

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relativize(absPath) {
  // Convert absolute paths (/, /guide/pvp/) to relative (../, ../guide/pvp/) for file:// support
  var rel = '..' + (absPath === '/' ? '' : absPath);
  return rel;
}

function formatDate(dateStr) {
  var d = new Date(dateStr + 'T00:00:00Z');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
}

function isDateOnly(value) {
  return typeof value === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && !isNaN(new Date(value + 'T00:00:00Z').getTime());
}

// JSON-LD datetimes need an offset; a bare YYYY-MM-DD fails Google's datetime validation.
function isoDateTime(dateStr) {
  return dateStr + 'T00:00:00+00:00';
}

// Absolute site path -> repository-relative page file
function pageFile(sitePath) {
  if (sitePath === '/') return 'index.html';
  var rel = sitePath.replace(/^\//, '');
  return /\.html$/.test(rel) ? rel : rel + 'index.html';
}

// Relative prefix from a page file back to the repository root
function rootPrefix(file) {
  var depth = file.split('/').length - 1;
  return depth === 0 ? '' : '../'.repeat(depth);
}

function validatePlaylists(data) {
  var ok = true;
  if (!isDateOnly(data.updated)) {
    console.error('Error: data/playlists.json "updated" must be a valid YYYY-MM-DD date, got: ' + JSON.stringify(data.updated));
    ok = false;
  }
  if (!isDateOnly(data.reviewed)) {
    console.error('Error: data/playlists.json "reviewed" must be a valid YYYY-MM-DD date, got: ' + JSON.stringify(data.reviewed));
    ok = false;
  }
  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    console.error('Error: data/playlists.json needs a non-empty "pages" array');
    return false;
  }
  if (!Array.isArray(data.creators)) {
    console.error('Error: data/playlists.json needs a "creators" array');
    return false;
  }

  var seenIds = {};
  var seenPaths = {};
  data.pages.forEach(function (page, i) {
    if (!page.path || !page.pageName || !page.id || !page.name || !page.color) {
      console.error('Error: page playlist ' + i + ' missing required field (path, pageName, id, name, color)');
      ok = false;
      return;
    }
    if (COLORS.indexOf(page.color) === -1) {
      console.error('Error: page playlist ' + page.path + ' has unknown color "' + page.color + '" (expected one of ' + COLORS.join(', ') + ')');
      ok = false;
    }
    if (page.featured && !page.description) {
      console.error('Error: featured page playlist ' + page.path + ' needs a description for its card');
      ok = false;
    }
    if (seenIds[page.id]) {
      console.error('Error: playlist ' + page.id + ' is assigned to both ' + seenIds[page.id] + ' and ' + page.path + ' — every page needs its own playlist');
      ok = false;
    }
    seenIds[page.id] = page.path;
    if (seenPaths[page.path]) {
      console.error('Error: page path ' + page.path + ' is listed more than once');
      ok = false;
    }
    seenPaths[page.path] = true;
    if (!fs.existsSync(path.join(ROOT, pageFile(page.path)))) {
      console.error('Error: page playlist points at a missing file: ' + pageFile(page.path));
      ok = false;
    }
  });

  var seenCreators = {};
  data.creators.forEach(function (entry, i) {
    if (!entry.creatorId || !entry.id || !entry.name) {
      console.error('Error: creator playlist ' + i + ' missing required field (creatorId, id, name)');
      ok = false;
      return;
    }
    if (seenCreators[entry.creatorId]) {
      console.error('Error: creator playlist listed twice for ' + entry.creatorId);
      ok = false;
    }
    seenCreators[entry.creatorId] = true;
    if (seenIds[entry.id]) {
      console.error('Error: playlist ' + entry.id + ' is used by ' + seenIds[entry.id] + ' and creator ' + entry.creatorId + ' — every banner needs its own playlist');
      ok = false;
    }
    seenIds[entry.id] = 'creator:' + entry.creatorId;
  });

  return ok;
}

// Every creator with a watch page needs a playlist, and every playlist needs a real creator.
function validateCreators(data) {
  if (!fs.existsSync(CREATORS_PATH)) {
    console.error('Error: data/youtube-creators.json not found');
    return false;
  }
  var creators = JSON.parse(fs.readFileSync(CREATORS_PATH, 'utf8')).creators || [];
  var known = {};
  creators.forEach(function (creator) {
    known[creator.id] = (creator.videos || []).filter(function (video) { return video.status !== 'unavailable'; }).length;
  });
  var assigned = {};
  var ok = true;
  data.creators.forEach(function (entry) {
    if (!(entry.creatorId in known)) {
      console.error('Error: playlist assigned to unknown creator id "' + entry.creatorId + '"');
      ok = false;
    }
    assigned[entry.creatorId] = true;
  });
  Object.keys(known).forEach(function (id) {
    if (!assigned[id] && known[id] > 0) {
      console.error('Error: creator "' + id + '" has ' + known[id] + ' indexed videos but no music playlist');
      ok = false;
    }
  });
  return ok;
}

function buildBanner(page, file) {
  var url = 'https://open.spotify.com/playlist/' + encodeURIComponent(page.id);
  var label = escHtml(page.name);
  var cssColor = 'gem-text--' + (page.color || 'cyan');
  return [
    '    <aside id="musicBanner" class="gem-music-banner gem-music-banner--expanded" aria-label="Music playlist">',
    '        <div class="gem-music-banner__content">',
    '            <span class="gem-music-banner__icon" aria-hidden="true">&#x1F3B5;</span>',
    '            <span class="gem-music-banner__label" id="musicBannerLabel">Listen: <a href="' + url + '" class="' + cssColor + '" target="_blank" rel="noopener noreferrer" aria-label="' + label + ' on Spotify (opens in a new tab)">' + label + ' <span aria-hidden="true">&#x2197;</span></a></span>',
    '        </div>',
    '        <div class="gem-music-banner__actions">',
    '            <button id="musicBannerToggle" class="gem-music-banner__btn" aria-label="Minimize music banner" aria-expanded="true">&minus;</button>',
    '        </div>',
    '    </aside>',
    '    <button id="musicBannerTrigger" class="gem-music-banner__trigger" aria-label="Show music banner" hidden>&#x1F3B5;</button>',
    '    <script src="' + rootPrefix(file) + 'music-banner.js" defer></script>'
  ].join('\n');
}

// The banner is static markup so the link works without JavaScript and is crawlable.
// Line endings follow the target file — writing LF into a CRLF page makes generate-codes
// rewrite the whole file on its next run, which the idempotency tests flag.
function writeBanner(page, stats) {
  var file = pageFile(page.path);
  var full = path.join(ROOT, file);
  var html = fs.readFileSync(full, 'utf8');
  var start = html.indexOf(BANNER_START);
  var end = html.indexOf(BANNER_END);
  if (start === -1 || end === -1 || end < start) {
    console.error('Error: ' + file + ' is missing the ' + BANNER_START + ' / ' + BANNER_END + ' markers');
    stats.failed = true;
    return;
  }
  var eol = html.indexOf('\r\n') === -1 ? '\n' : '\r\n';
  var block = BANNER_START + eol + buildBanner(page, file).split('\n').join(eol) + eol + '    ' + BANNER_END;
  var updated = html.slice(0, start) + block + html.slice(end + BANNER_END.length);
  if (updated !== html) {
    fs.writeFileSync(full, updated, 'utf8');
    stats.banners++;
  }
}

function buildPlaylistGrid(playlists) {
  return playlists.map(p => {
    const card = [
      '<div class="gem-music-card">',
      '  <span class="gem-music-card__badge gem-music-card__badge--' + escHtml(p.color) + '">' + escHtml(p.pageName) + '</span>',
      '  <h2 class="gem-music-card__title">' + escHtml(p.name) + '</h2>',
      // title: WCAG 4.1.2 requires an accessible name for frames. allowfullscreen is dropped because
      // the allow attribute already delegates "fullscreen" and Chrome warns the two conflict.
      '  <iframe style="border-radius:12px" title="Spotify playlist: ' + escHtml(p.name) + '" src="https://open.spotify.com/embed/playlist/' + encodeURIComponent(p.id) + '?utm_source=generator" width="100%" height="352" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>',
      '  <p class="gem-music-card__desc">' + escHtml(p.description) + '</p>',
      '  <a href="' + escHtml(relativize(p.path)) + '" class="gem-music-card__link">Go to ' + escHtml(p.pageName) + ' &rarr;</a>',
      '</div>'
    ];
    return card.join('\n');
  }).join('\n');
}

// Read playlist data
function loadPlaylists() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function main() {
var playlistData;
try {
  playlistData = loadPlaylists();
} catch (e) {
  console.error('Error reading data/playlists.json:', e.message);
  process.exit(1);
}

if (!validatePlaylists(playlistData) || !validateCreators(playlistData)) {
  process.exit(1);
}

var featured = playlistData.pages.filter(function (page) { return page.featured; });

// Check page exists before reading
if (!fs.existsSync(PAGE_PATH)) {
  console.error('Error: music/index.html not found. Create the page template first.');
  console.error('Run: mkdir -p music (then create music/index.html with MUSIC_GRID markers)');
  process.exit(1);
}

// Read existing music/index.html and replace markers
var pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
var gridMarker = '<!--MUSIC_GRID_START-->' + buildPlaylistGrid(featured) + '<!--MUSIC_GRID_END-->';

var markerRegex = /<!--MUSIC_GRID_START-->[\s\S]*?<!--MUSIC_GRID_END-->/;
if (!markerRegex.test(pageHtml)) {
  console.error('Error: MUSIC_GRID markers not found in music/index.html');
  process.exit(1);
}
pageHtml = pageHtml.replace(markerRegex, gridMarker);

// Replace MUSIC_REVIEWED markers
var reviewedRegex = /<!--MUSIC_REVIEWED_START-->[\s\S]*?<!--MUSIC_REVIEWED_END-->/g;
var reviewedMatches = pageHtml.match(reviewedRegex);
if (!reviewedMatches || reviewedMatches.length === 0) {
  console.error('Error: MUSIC_REVIEWED markers not found in music/index.html');
  process.exit(1);
}
if (reviewedMatches.length > 1) {
  console.error('Error: MUSIC_REVIEWED markers found ' + reviewedMatches.length + ' times, expected 1');
  process.exit(1);
}
var reviewedLabel = '<!--MUSIC_REVIEWED_START-->Reviewed ' + formatDate(playlistData.reviewed) + '<!--MUSIC_REVIEWED_END-->';
pageHtml = pageHtml.replace(reviewedRegex, reviewedLabel);

// Replace MUSIC_SCHEMA markers with generated JSON-LD
var schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://anomaly-alpha.github.io/' },
        { '@type': 'ListItem', 'position': 2, 'name': 'Music & Playlists', 'item': 'https://anomaly-alpha.github.io/music/' }
      ]
    },
    {
      '@id': 'https://anomaly-alpha.github.io/music/#page',
      '@type': 'CollectionPage',
      'name': 'Music & Playlists — Invincible GTG',
      'url': 'https://anomaly-alpha.github.io/music/',
      // Hardcoded original page publication date — must not track reviewed/updated
      'datePublished': isoDateTime('2026-07-17'),
      'dateModified': isoDateTime(playlistData.reviewed),
      'isPartOf': { '@id': SITE_ORIGIN + '/#website' }
    },
    {
      '@type': 'ItemList',
      'name': 'Invincible GTG playlists',
      'itemListElement': featured.map(function (playlist, index) {
        return {
          '@type': 'ListItem',
          'position': index + 1,
          'name': playlist.name,
          'description': playlist.description,
          'url': 'https://open.spotify.com/playlist/' + playlist.id
        };
      })
    },
    {
      '@id': SITE_ORIGIN + '/#website',
      '@type': 'WebSite',
      'name': 'Invincible GTG',
      'alternateName': 'Invincible Guarding the Globe Guides',
      'url': SITE_ORIGIN + '/',
      'inLanguage': 'en'
    }
  ]
};

var schemaHtml = '<script type="application/ld+json">' + JSON.stringify(schema).replace(/<[/]script/gi, '<' + String.fromCharCode(92) + '/script') + '</script>';
var schemaRegex = /<!--MUSIC_SCHEMA_START-->[\s\S]*?<!--MUSIC_SCHEMA_END-->/g;
var schemaMatches = pageHtml.match(schemaRegex);
if (!schemaMatches || schemaMatches.length === 0) {
  console.error('Error: MUSIC_SCHEMA markers not found in music/index.html');
  process.exit(1);
}
if (schemaMatches.length > 1) {
  console.error('Error: MUSIC_SCHEMA markers found ' + schemaMatches.length + ' times, expected 1');
  process.exit(1);
}
pageHtml = pageHtml.replace(schemaRegex, '<!--MUSIC_SCHEMA_START-->' + schemaHtml + '<!--MUSIC_SCHEMA_END-->');

// Update date and count
pageHtml = pageHtml.replace(/(Updated\s+)(\w+\s+\d+,\s+\d{4})/, '$1' + formatDate(playlistData.updated));
pageHtml = pageHtml.replace(/(\d+)\s+playlists?/, featured.length + ' playlists');

fs.writeFileSync(PAGE_PATH, pageHtml, 'utf8');
console.log('Updated music/index.html \u2014 ' + featured.length + ' playlists');

// Rewrite every page's banner. /watch/ is emitted by scripts/generate-watch-pages.js.
var bannerStats = { banners: 0, failed: false };
playlistData.pages.forEach(function (page) {
  if (page.path === '/watch/') return;
  writeBanner(page, bannerStats);
});
if (bannerStats.failed) {
  process.exit(1);
}
console.log('Updated music banners on ' + bannerStats.banners + ' pages');
}

if (require.main === module) {
  main();
}

module.exports = {
  buildBanner: buildBanner,
  pageFile: pageFile,
  rootPrefix: rootPrefix,
  escHtml: escHtml,
  loadPlaylists: loadPlaylists
};
