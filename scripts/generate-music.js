const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'playlists.json');
const PAGE_PATH = path.join(__dirname, '..', 'music', 'index.html');

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

function validatePlaylists(data) {
  if (!isDateOnly(data.updated)) {
    console.error('Error: data/playlists.json "updated" must be a valid YYYY-MM-DD date, got: ' + JSON.stringify(data.updated));
    return false;
  }
  if (!isDateOnly(data.reviewed)) {
    console.error('Error: data/playlists.json "reviewed" must be a valid YYYY-MM-DD date, got: ' + JSON.stringify(data.reviewed));
    return false;
  }
  var playlists = data.playlists;
  for (var i = 0; i < playlists.length; i++) {
    var playlist = playlists[i];
    if (!playlist.id || !playlist.name || !playlist.color || !playlist.page || !playlist.description) {
      console.error('Error: playlist ' + i + ' missing required field (id, name, color, page, description)');
      return false;
    }
  }
  return true;
}

function buildPlaylistGrid(playlists) {
  return playlists.map(p => {
    const card = [
      '<div class="gem-music-card">',
      '  <span class="gem-music-card__badge gem-music-card__badge--' + escHtml(p.color) + '">' + escHtml(p.pageName) + '</span>',
      '  <h3 class="gem-music-card__title">' + escHtml(p.name) + '</h3>',
      '  <iframe style="border-radius:12px" src="https://open.spotify.com/embed/playlist/' + encodeURIComponent(p.id) + '?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>',
      '  <p class="gem-music-card__desc">' + escHtml(p.description) + '</p>',
      '  <a href="' + escHtml(relativize(p.page)) + '" class="gem-music-card__link">Go to ' + escHtml(p.pageName) + ' &rarr;</a>',
      '</div>'
    ];
    return card.join('\n');
  }).join('\n');
}

// Read playlist data
var playlistData;
try {
  playlistData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  console.error('Error reading data/playlists.json:', e.message);
  process.exit(1);
}

if (!validatePlaylists(playlistData)) {
  process.exit(1);
}

var gridHtml = buildPlaylistGrid(playlistData.playlists);
var gridMarker = '<!--MUSIC_GRID_START-->' + gridHtml + '<!--MUSIC_GRID_END-->';

// Check page exists before reading
if (!fs.existsSync(PAGE_PATH)) {
  console.error('Error: music/index.html not found. Create the page template first.');
  console.error('Run: mkdir -p music (then create music/index.html with MUSIC_GRID markers)');
  process.exit(1);
}

// Read existing music/index.html and replace markers
var pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
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
      'datePublished': '2026-07-17',
      'dateModified': playlistData.reviewed,
      'isPartOf': {
        '@type': 'WebSite',
        '@id': 'https://anomaly-alpha.github.io/#website',
        'name': 'Invincible GTG',
        'url': 'https://anomaly-alpha.github.io/'
      }
    },
    {
      '@type': 'ItemList',
      'name': 'Invincible GTG playlists',
      'itemListElement': playlistData.playlists.map(function (playlist, index) {
        return {
          '@type': 'ListItem',
          'position': index + 1,
          'name': playlist.name,
          'description': playlist.description,
          'url': 'https://open.spotify.com/playlist/' + playlist.id
        };
      })
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
pageHtml = pageHtml.replace(/(\d+)\s+playlists?/, playlistData.playlists.length + ' playlists');

fs.writeFileSync(PAGE_PATH, pageHtml, 'utf8');
console.log('Updated music/index.html \u2014 ' + playlistData.playlists.length + ' playlists');
