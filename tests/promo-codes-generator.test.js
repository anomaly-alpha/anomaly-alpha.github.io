'use strict';

var assert = require('assert');
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var rootDir = path.resolve(__dirname, '..');

childProcess.execFileSync(process.execPath, ['scripts/generate-codes.js'], {
  cwd: rootDir,
  stdio: 'ignore'
});

var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var match = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

assert.ok(match, 'Homepage should contain JSON-LD');
assert.doesNotThrow(function () {
  JSON.parse(match[1]);
}, 'Generated homepage JSON-LD should be valid JSON');

// Every page that advertises a month in its title has to advertise the same month, sourced from
// codes.json seoMonth. A page holding a stale token is a stale freshness claim in the SERP.
var codesData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'codes.json'), 'utf8'));
var seoDate = new Date(codesData.seoMonth + '-01T00:00:00Z');
var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var expectedToken = '[' + monthNames[seoDate.getUTCMonth()] + ' ' + seoDate.getUTCFullYear() + ']';

var tokenPages = [
  'index.html',
  'guide/beginners/index.html',
  'guide/code/index.html',
  'guide/creators/index.html',
  'guide/event/index.html',
  'guide/faq/index.html',
  'guide/login/index.html',
  'guide/pvp/index.html',
  'guide/redeem/index.html',
  'guide/wish-event/index.html',
  'guide/xp/index.html'
];

for (var p = 0; p < tokenPages.length; p++) {
  var rel = tokenPages[p];
  var pageSource = fs.readFileSync(path.join(rootDir, rel), 'utf8');
  var tokens = pageSource.match(/\[(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\]/g) || [];
  assert.ok(tokens.length > 0, rel + ' should carry a [Mon YYYY] freshness token');
  for (var t = 0; t < tokens.length; t++) {
    assert.strictEqual(tokens[t], expectedToken, rel + ' should advertise ' + expectedToken + ', found ' + tokens[t]);
  }
}

console.log('Promo-code generator tests passed.');
