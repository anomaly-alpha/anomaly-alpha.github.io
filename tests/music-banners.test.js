const assert = require('assert');
const fs = require('fs');
const path = require('path');

const music = require('../scripts/generate-music');

const ROOT = path.join(__dirname, '..');
const data = music.loadPlaylists();
const SPOTIFY = /https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// --- every banner has its own playlist -------------------------------------
const byId = new Map();
for (const page of data.pages) {
  assert.ok(!byId.has(page.id), `playlist ${page.id} is shared by ${byId.get(page.id)} and ${page.path}`);
  byId.set(page.id, page.path);
}
for (const creator of data.creators) {
  assert.ok(!byId.has(creator.id), `playlist ${creator.id} is shared by ${byId.get(creator.id)} and creator ${creator.creatorId}`);
  byId.set(creator.id, 'creator:' + creator.creatorId);
}
assert.ok(data.pages.length >= 19, 'every editorial page needs a playlist');
assert.ok(data.creators.length >= 20, 'every tracked creator needs a playlist');

// --- the home page leads with the GTA 6 soundtrack ------------------------
const home = data.pages.find((page) => page.path === '/');
assert.strictEqual(home.id, '7268bAOK23jvpBGy2Kw9Jd', 'home page banner must point at the GTA 6 SOUNDTRACK playlist');
assert.strictEqual(home.name, 'GTA 6 SOUNDTRACK');

// --- static banner markup on every editorial page -------------------------
for (const page of data.pages) {
  if (page.path === '/watch/') continue;
  const file = music.pageFile(page.path);
  const html = read(file);
  assert.ok(html.includes('<!--MUSIC_BANNER_START-->'), `${file}: missing music banner markers`);
  const start = html.indexOf('<!--MUSIC_BANNER_START-->');
  const end = html.indexOf('<!--MUSIC_BANNER_END-->');
  const block = html.slice(start, end);
  const found = block.match(SPOTIFY);
  assert.ok(found, `${file}: banner has no Spotify playlist link`);
  assert.strictEqual(found[1], page.id, `${file}: banner links ${found[1]}, expected ${page.id}`);
  assert.ok(block.includes('id="musicBannerLabel"'), `${file}: banner label is not rendered server-side`);
  assert.ok(!block.includes('Loading...'), `${file}: banner label must not depend on JavaScript`);
  assert.ok(block.includes('music-banner.js'), `${file}: banner must load music-banner.js for the collapse toggle`);
  assert.ok(block.includes('target="_blank"') && block.includes('rel="noopener noreferrer"'), `${file}: Spotify links must open safely in a new tab`);
  assert.strictEqual(html.match(/id="musicBanner"/g).length, 1, `${file}: duplicate music banner`);
  assert.ok(!html.includes('music-config'), `${file}: legacy music-config block still present`);
}

// --- one playlist per creator, applied to every watch page ---------------
const creators = JSON.parse(read('data/youtube-creators.json')).creators;
const videoOwner = new Map();
for (const creator of creators) {
  for (const video of creator.videos || []) videoOwner.set(video.id, creator.id);
}

const playlistByCreator = new Map(data.creators.map((entry) => [entry.creatorId, entry]));
const watchDirs = fs.readdirSync(path.join(ROOT, 'watch'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
assert.ok(watchDirs.length > 150, 'expected the generated watch page set');

for (const dir of watchDirs) {
  const file = `watch/${dir}/index.html`;
  const html = read(file);
  const found = html.match(SPOTIFY);
  assert.ok(found, `${file}: watch page has no music banner`);
  const owner = videoOwner.get(dir);
  assert.ok(owner, `${file}: no creator owns video ${dir}`);
  const entry = playlistByCreator.get(owner);
  assert.ok(entry, `${file}: creator ${owner} has no playlist`);
  assert.strictEqual(found[1], entry.id, `${file}: banner links ${found[1]}, expected the ${owner} playlist ${entry.id}`);
  assert.ok(html.includes('../../music-banner.js'), `${file}: watch page must load music-banner.js`);
}

const hub = read('watch/index.html');
const hubPlaylist = data.pages.find((page) => page.path === '/watch/');
assert.ok(hub.includes(hubPlaylist.id), 'watch hub banner must use the /watch/ playlist');
assert.ok(hub.includes('../music-banner.js'), 'watch hub must load music-banner.js');

// --- the curated grid on /music/ -----------------------------------------
const musicPage = read('music/index.html');
const featured = data.pages.filter((page) => page.featured);
for (const page of featured) {
  assert.ok(musicPage.includes(`/embed/playlist/${page.id}`), `music/index.html is missing the ${page.name} card`);
  assert.ok(musicPage.includes(music.escHtml(page.description)), `music/index.html is missing the ${page.name} description`);
}
assert.strictEqual((musicPage.match(/gem-music-card__title/g) || []).length, featured.length, 'music/index.html card count is stale');
assert.strictEqual((musicPage.match(/<iframe /g) || []).length, featured.length, 'music/index.html iframe count is stale');

console.log('Music banner checks passed — ' + data.pages.length + ' pages, ' + data.creators.length + ' creators, ' + featured.length + ' cards');
