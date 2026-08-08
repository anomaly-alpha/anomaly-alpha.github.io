// ===== SKARN DOCS INDEX GENERATOR =====
// Regenerates the docs index inside skarn-bot/index.html between the
// SKARN_INDEX markers. Reads committed files only (git ls-files), so it
// never links uncommitted work. Run from repo root: node scripts/generate-skarn-index.js
var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var PAGE_PATH = path.join(__dirname, '..', 'skarn-bot', 'index.html');
var BLOB_BASE = 'https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/';
var DOCS_PREFIX = 'skarn-bot/docs/';
var TYPES = ['plans', 'specs', 'reports', 'adr', 'prompts'];
var EXCLUDED = ['compose', 'research'];

function labelFromFile(file) {
  return String(path.basename(file, '.md'))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function li(file) {
  return '      <li><a href="' + BLOB_BASE + file + '">' + labelFromFile(file) + '</a></li>';
}

var files = cp.execSync('git ls-files ' + DOCS_PREFIX, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter(function (f) { return f.slice(-3) === '.md'; })
  .filter(function (f) {
    var rest = f.slice(DOCS_PREFIX.length);
    return EXCLUDED.every(function (d) { return rest.indexOf(d + '/') !== 0; });
  });

var html = [];

var topLevel = files.filter(function (f) { return f.indexOf('/', DOCS_PREFIX.length) === -1; }).sort();
if (topLevel.length) {
  html.push('    <section class="docs">\n      <h2>Top Level</h2>\n      <ul>');
  topLevel.forEach(function (f) { html.push(li(f)); });
  html.push('      </ul>\n    </section>');
}

TYPES.forEach(function (type) {
  var ofType = files.filter(function (f) {
    return f.slice(DOCS_PREFIX.length).indexOf(type + '/') === 0;
  });
  if (!ofType.length) return;
  var groups = {};
  ofType.forEach(function (f) {
    var rest = f.slice(DOCS_PREFIX.length + type.length + 1);
    var date = rest.indexOf('/') === -1 ? 'misc' : rest.split('/')[0];
    (groups[date] = groups[date] || []).push(f);
  });
  var dates = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });
  if (dates.indexOf('misc') !== -1) { dates.splice(dates.indexOf('misc'), 1); dates.push('misc'); }
  html.push('    <section class="docs">\n      <h2>' + type.charAt(0).toUpperCase() + type.slice(1) + '</h2>');
  dates.forEach(function (date) {
    groups[date].sort();
    html.push('      <h3>' + date + '</h3>\n      <ul>');
    groups[date].forEach(function (f) { html.push(li(f)); });
    html.push('      </ul>');
  });
  html.push('    </section>');
});

var block = '<!--SKARN_INDEX_START-->\n' + html.join('\n') + '\n  <!--SKARN_INDEX_END-->';

if (!fs.existsSync(PAGE_PATH)) {
  console.error('Error: skarn-bot/index.html not found. Create the page template first.');
  process.exit(1);
}
var page = fs.readFileSync(PAGE_PATH, 'utf8');
var markerRe = /<!--SKARN_INDEX_START-->[\s\S]*?<!--SKARN_INDEX_END-->/;
if (!markerRe.test(page)) {
  console.error('Error: SKARN_INDEX markers not found in skarn-bot/index.html');
  process.exit(1);
}
page = page.replace(markerRe, block);
// refresh the footer "Updated" date (mirrors scripts/generate-music.js)
var today = new Date();
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var dateLabel = MONTHS[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();
page = page.replace(/(Updated\s+<span id="skarn-updated">\s*)(\w+\s+\d+,\s+\d{4})/, '$1' + dateLabel);
fs.writeFileSync(PAGE_PATH, page, 'utf8');
console.log('Updated skarn-bot/index.html with ' + files.length + ' docs links');
