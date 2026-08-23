const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXPECTED = 'google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0';
const adsTxtPath = path.join(ROOT, 'ads.txt');

assert.ok(fs.existsSync(adsTxtPath), 'ads.txt must exist at the repository root');

const content = fs.readFileSync(adsTxtPath, 'utf8');
const normalizedContent = content.replace(/\r\n/g, '\n');

assert.strictEqual(normalizedContent, `${EXPECTED}\n`, 'ads.txt must contain exactly the account-provided line plus one final newline');
assert.doesNotMatch(content, /\uFEFF/, 'ads.txt must not contain a UTF-8 BOM');
assert.doesNotMatch(normalizedContent, /[ \t]+\n/, 'ads.txt must not contain trailing whitespace');
assert.doesNotMatch(content, /<|>/, 'ads.txt must remain plain text, not HTML');
assert.strictEqual(content.split(/\r?\n/).filter(Boolean).length, 1, 'ads.txt must contain one publisher record');

const htmlFiles = [
  'index.html',
  '404.html',
  'authors/anomaly/index.html',
  'guide/beginners/index.html',
  'guide/code/index.html',
  'guide/creators/index.html',
  'guide/event/index.html',
  'guide/faq/index.html',
  'guide/login/index.html',
  'guide/pvp/index.html',
  'guide/redeem/index.html',
  'guide/xp/index.html',
  'music/index.html',
  'seo/index.html',
  'skarn-bot/index.html',
  'gem_infographic.html',
  'googleeb60e8e5ee55440e.html'
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i, `${file}: verification must not add the AdSense runtime script`);
}

console.log('AdSense ads.txt verification checks passed');
