'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGES = [
  'index.html',
  'guide/code/index.html',
  'guide/beginners/index.html',
  'guide/event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/xp/index.html',
  'guide/redeem/index.html',
  'guide/creators/index.html',
  'authors/anomaly/index.html',
  'music/index.html',
  'privacy/index.html',
  'terms/index.html'
];

function blocksFor(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
}

const INDEXABLE = [
  'authors/anomaly/index.html',
  'music/index.html',
  'privacy/index.html',
  'terms/index.html'
];

function nodesFor(blocks) {
  return blocks.flatMap(block => block['@graph'] || [block]);
}

function typesFor(nodes) {
  return nodes.flatMap(node => Array.isArray(node['@type']) ? node['@type'] : [node['@type']]);
}

for (const file of PAGES) {
  const blocks = blocksFor(file);
  assert(blocks.length > 0, file + ': expected JSON-LD');
  blocks.forEach((block, index) => {
    assert.strictEqual(block['@context'], 'https://schema.org', file + ' block ' + index + ': missing schema.org context');
  });
}

const authorNodes = nodesFor(blocksFor('authors/anomaly/index.html'));
const profile = authorNodes.find(node => node['@type'] === 'ProfilePage');
assert(profile && profile.mainEntity, 'author: ProfilePage.mainEntity is required');
assert.strictEqual(profile.mainEntity['@type'], 'Person', 'author: mainEntity must be Person');
assert.strictEqual(profile.mainEntity['@id'], 'https://anomaly-alpha.github.io/authors/anomaly/#person', 'author: Person ID must be stable');
assert.strictEqual(profile.mainEntity.url, 'https://anomaly-alpha.github.io/authors/anomaly/', 'author: Person URL must be profile URL');

const canonicalUrls = {
  'index.html': 'https://anomaly-alpha.github.io/',
  'guide/code/index.html': 'https://anomaly-alpha.github.io/guide/code/',
  'guide/beginners/index.html': 'https://anomaly-alpha.github.io/guide/beginners/',
  'guide/event/index.html': 'https://anomaly-alpha.github.io/guide/event/',
  'guide/pvp/index.html': 'https://anomaly-alpha.github.io/guide/pvp/',
  'guide/login/index.html': 'https://anomaly-alpha.github.io/guide/login/',
  'guide/faq/index.html': 'https://anomaly-alpha.github.io/guide/faq/',
  'guide/xp/index.html': 'https://anomaly-alpha.github.io/guide/xp/',
  'guide/redeem/index.html': 'https://anomaly-alpha.github.io/guide/redeem/',
  'guide/creators/index.html': 'https://anomaly-alpha.github.io/guide/creators/',
  'authors/anomaly/index.html': 'https://anomaly-alpha.github.io/authors/anomaly/',
  'music/index.html': 'https://anomaly-alpha.github.io/music/',
  'privacy/index.html': 'https://anomaly-alpha.github.io/privacy/',
  'terms/index.html': 'https://anomaly-alpha.github.io/terms/'
};
const requiredTypes = {
  'index.html': ['WebPage'],
  'guide/code/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'HowTo', 'FAQPage', 'DefinedTerm'],
  'guide/beginners/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/event/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/pvp/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/login/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/faq/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/xp/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'DefinedTerm'],
  'guide/redeem/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage'],
  'guide/creators/index.html': ['CollectionPage', 'ItemList'],
  'authors/anomaly/index.html': ['ProfilePage'],
  'music/index.html': ['CollectionPage', 'BreadcrumbList', 'ItemList'],
  'privacy/index.html': ['Article'],
  'terms/index.html': ['Article']
};
for (const file of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  assert(canonical && canonical[1] === canonicalUrls[file], file + ': canonical URL mismatch');
  const types = typesFor(nodesFor(blocksFor(file)));
  for (const required of requiredTypes[file]) {
    assert(types.includes(required), file + ': missing expected ' + required);
  }
  for (const node of nodesFor(blocksFor(file))) {
    if (node['@type'] === 'VideoGame' && node.name === 'Invincible Guarding the Globe') {
      assert.strictEqual(node['@id'], 'https://anomaly-alpha.github.io/#game', file + ': game ID must be stable');
    }
    if (node['@type'] === 'Organization' && node.name === 'Anomaly Alpha') {
      assert.strictEqual(node['@id'], 'https://anomaly-alpha.github.io/#organization', file + ': organization ID must be stable');
    }
  }
}

for (const file of PAGES) {
  for (const node of nodesFor(blocksFor(file)).filter(node => node['@type'] === 'Article')) {
    ['headline', 'author', 'publisher', 'image', 'datePublished', 'dateModified'].forEach(key => {
      assert(node[key], file + ': Article missing ' + key);
    });
  }
}

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
['/music/', '/privacy/', '/terms/', '/authors/anomaly/'].forEach(url => {
  assert(sitemap.includes('https://anomaly-alpha.github.io' + url), 'sitemap missing ' + url);
});
INDEXABLE.forEach(file => {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(!/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html), file + ': indexable page still has noindex');
});

for (const file of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const page of nodesFor(blocksFor(file)).filter(node => node['@type'] === 'FAQPage')) {
    for (const question of page.mainEntity || []) {
      assert(visible.includes(question.name), file + ': FAQ question is not visible');
      assert(visible.includes(question.acceptedAnswer.text), file + ': FAQ answer is not visible');
    }
  }
}

// ===== Schema content parity =====
for (const file of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const node of nodesFor(blocksFor(file))) {
    assert.notStrictEqual(node['@type'], 'Product', file + ': unexpected Product schema (no visible content contract)');
    assert.notStrictEqual(node['@type'], 'Review', file + ': unexpected Review schema (no visible content contract)');
    if (node['@type'] === 'VideoObject') {
      const hasVisibleName = node.name && visible.includes(node.name);
      const hasVisibleDesc = node.description && visible.includes(node.description);
      assert(hasVisibleName || hasVisibleDesc, file + ': VideoObject missing visible name or description');
    }
  }
}

// ===== Local reference resolution =====
const SITE_ROOT = 'https://anomaly-alpha.github.io/';
for (const file of PAGES) {
  const blocks = blocksFor(file);
  const definedIds = new Set();
  (function collect(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(collect); return; }
    if (obj['@id']) {
      var id = obj['@id'];
      definedIds.add(id.startsWith('#') ? SITE_ROOT + id : id);
    }
    for (const v of Object.values(obj)) collect(v);
  })(blocks);
  (function check(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(check); return; }
    if (obj['@id']) {
      var refId = obj['@id'];
      refId = refId.startsWith('#') ? SITE_ROOT + refId : refId;
      if (!definedIds.has(refId)) {
        assert(obj['@type'], file + ': dangling reference @id "' + obj['@id'] + '"');
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k !== '@context') check(v);
    }
  })(blocks);
}

// ===== Generator idempotency =====
const generators = [
  ['scripts/generate-codes.js', ['data/generated/promo-codes.js', 'guide/code/index.html', 'index.html']],
  ['scripts/generate-youtube-creators.js', ['data/generated/youtube-creators.js', 'guide/creators/index.html']]
];
for (const [script, outputs] of generators) {
  const snapshots = outputs.map(f => fs.readFileSync(path.join(ROOT, f)));
  execFileSync(process.execPath, [script], { cwd: ROOT });
  outputs.forEach((f, i) => {
    const current = fs.readFileSync(path.join(ROOT, f));
    assert(Buffer.compare(snapshots[i], current) === 0, script + ': output changed for ' + f);
  });
}

console.log('Structured-data checks passed for ' + PAGES.length + ' pages');
