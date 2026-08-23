const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const eligible = {
  'index.html': 'guide/beginners/',
  'guide/code/index.html': '../redeem/',
  'guide/beginners/index.html': '../code/',
  'guide/event/index.html': '../pvp/',
  'guide/faq/index.html': '../beginners/',
  'guide/login/index.html': '../beginners/',
  'guide/pvp/index.html': '../faq/',
  'guide/redeem/index.html': '../code/',
  'guide/xp/index.html': '../beginners/'
};

const excluded = [
  'guide/creators/index.html',
  'authors/anomaly/index.html',
  'privacy/index.html',
  'terms/index.html',
  'music/index.html',
  'seo/index.html',
  'skarn-bot/index.html',
  '404.html'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [file, fallbackHref] of Object.entries(eligible)) {
  const html = read(file);
  assert.strictEqual(count(html, /id="ads-config"/g), 1, `${file}: one ads-config block required`);
  assert.match(html, /"enabled"\s*:\s*false/, `${file}: ads must be disabled`);
  assert.strictEqual(count(html, /data-ad-slot="lower"/g), 1, `${file}: one lower fallback required`);
  assert.match(html, /class="gem-site-message"/, `${file}: site-message class required`);
  assert.match(html, /data-ads-enabled="false"/, `${file}: fallback must be disabled state`);
  assert.match(html, /aria-label="Site message"/, `${file}: fallback must be named`);
  assert.match(html, new RegExp(`href="${escapeRegExp(fallbackHref)}"`), `${file}: wrong fallback link`);
  assert.doesNotMatch(html, /adsbygoogle|googlesyndication|fundingchoices/i, `${file}: vendor code must not load`);
}

for (const file of excluded) {
  const html = read(file);
  assert.doesNotMatch(html, /id="ads-config"|data-ad-slot="lower"|class="gem-site-message"/, `${file}: excluded page changed`);
}

console.log('Disabled ad fallback checks passed');
