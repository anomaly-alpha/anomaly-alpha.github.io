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

function validatePlaylists(playlists) {
  for (var i = 0; i < playlists.length; i++) {
    var p = playlists[i];
    if (!p.id || !p.name || !p.color || !p.page) {
      console.error('Error: playlist ' + i + ' missing required field (id, name, color, page)');
      return false;
    }
  }
  return true;
}

// Read playlist data
var playlistData;
try {
  playlistData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  console.error('Error reading data/playlists.json:', e.message);
  process.exit(1);
}

if (!validatePlaylists(playlistData.playlists)) {
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

// Update date and count
pageHtml = pageHtml.replace(/(Updated\s+)(\w+\s+\d+,\s+\d{4})/, '$1' + formatDate(playlistData.updated));
pageHtml = pageHtml.replace(/(\d+)\s+playlists?/, playlistData.playlists.length + ' playlists');

fs.writeFileSync(PAGE_PATH, pageHtml, 'utf8');
console.log('Updated music/index.html \u2014 ' + playlistData.playlists.length + ' playlists');

function formatDate(dateStr) {
  var d = new Date(dateStr + 'T00:00:00Z');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}
