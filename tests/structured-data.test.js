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

// ===== Shared helpers =====

function blocksFor(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1].replace(/<!--[\s\S]*?-->/g, '')));
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function normalize(text) {
  return decodeEntities(String(text)).replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
}

function visibleText(html) {
  return normalize(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '));
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

function allNodes(value) {
  const result = [];
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v['@type']) result.push(v);
    for (const child of Object.values(v)) walk(child);
  })(value);
  return result;
}

// ===== JSON-LD presence and @context =====

for (const file of PAGES) {
  const blocks = blocksFor(file);
  assert(blocks.length > 0, file + ': expected JSON-LD');
  blocks.forEach((block, index) => {
    assert.strictEqual(block['@context'], 'https://schema.org', file + ' block ' + index + ': missing schema.org context');
  });
}

// ===== Author profile =====

const authorNodes = nodesFor(blocksFor('authors/anomaly/index.html'));
const profile = authorNodes.find(node => node['@type'] === 'ProfilePage');
assert(profile && profile.mainEntity, 'author: ProfilePage.mainEntity is required');
assert.strictEqual(profile.mainEntity['@type'], 'Person', 'author: mainEntity must be Person');
assert.strictEqual(profile.mainEntity['@id'], 'https://anomaly-alpha.github.io/authors/anomaly/#person', 'author: Person ID must be stable');
assert.strictEqual(profile.mainEntity.url, 'https://anomaly-alpha.github.io/authors/anomaly/', 'author: Person URL must be profile URL');

// ===== Canonical URLs and required types =====

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
  'guide/creators/index.html': ['BreadcrumbList', 'VideoGame', 'CollectionPage', 'ItemList'],
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

// ===== Article required fields =====

for (const file of PAGES) {
  for (const node of nodesFor(blocksFor(file)).filter(node => node['@type'] === 'Article')) {
    ['headline', 'author', 'publisher', 'image', 'datePublished', 'dateModified'].forEach(key => {
      assert(node[key], file + ': Article missing ' + key);
    });
  }
}

// ===== Sitemap and indexability =====

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
['/music/', '/privacy/', '/terms/', '/authors/anomaly/'].forEach(url => {
  assert(sitemap.includes('https://anomaly-alpha.github.io' + url), 'sitemap missing ' + url);
});
const locCount = (sitemap.match(/<loc>/g) || []).length;
assert.strictEqual(locCount, 14, 'sitemap must contain exactly 14 <loc> entries, found ' + locCount);
INDEXABLE.forEach(file => {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(!/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html), file + ': indexable page still has noindex');
});

// ===== FAQ visibility + schema content parity (shared visibleText) =====

for (const file of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const vis = visibleText(html);
  const blocks = blocksFor(file);

  for (const page of nodesFor(blocks).filter(node => node['@type'] === 'FAQPage')) {
    for (const question of page.mainEntity || []) {
      assert(vis.includes(normalize(question.name)), file + ': FAQ question is not visible');
      assert(vis.includes(normalize(question.acceptedAnswer.text)), file + ': FAQ answer is not visible');
    }
  }

  for (const node of allNodes(blocks)) {
    assert.notStrictEqual(node['@type'], 'Product', file + ': unexpected Product schema (no visible content contract)');
    assert.notStrictEqual(node['@type'], 'Review', file + ': unexpected Review schema (no visible content contract)');
    if (node['@type'] === 'VideoObject') {
      const hasVisibleName = node.name && vis.includes(normalize(node.name));
      const hasVisibleDesc = node.description && vis.includes(normalize(node.description));
      assert(hasVisibleName || hasVisibleDesc, file + ': VideoObject missing visible name or description');
    }
  }
}

// ===== Local reference resolution =====
// Defined IDs collected only from top-level JSON-LD nodes (standalone blocks or @graph members).
// Nested property values inspected recursively; @context and top-level nodes skipped.
// Fragment IDs normalized against SITE_ROOT. Dangling untyped references fail.

const SITE_ROOT = 'https://anomaly-alpha.github.io/';
for (const file of PAGES) {
  const blocks = blocksFor(file);

  const topLevelNodes = new Set();
  const definedIds = new Set();
  for (const block of blocks) {
    if (block['@graph']) {
      for (const node of block['@graph']) {
        topLevelNodes.add(node);
        if (node['@id']) {
          definedIds.add(node['@id'].startsWith('#') ? SITE_ROOT + node['@id'] : node['@id']);
        }
      }
    } else {
      topLevelNodes.add(block);
      if (block['@id']) {
        definedIds.add(block['@id'].startsWith('#') ? SITE_ROOT + block['@id'] : block['@id']);
      }
    }
  }

  (function checkRefs(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(checkRefs); return; }
    if (obj['@id'] && !topLevelNodes.has(obj)) {
      const refId = obj['@id'].startsWith('#') ? SITE_ROOT + obj['@id'] : obj['@id'];
      if (!definedIds.has(refId)) {
        assert(obj['@type'], file + ': dangling reference @id "' + obj['@id'] + '"');
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === '@context') continue;
      if (typeof v === 'object' && v !== null) checkRefs(v);
    }
  })(blocks);
}

// ===== Generator idempotency =====

const generators = [
  ['scripts/generate-codes.js', ['data/generated/promo-codes.js', 'guide/code/index.html', 'index.html']],
  ['scripts/generate-youtube-creators.js', ['data/generated/youtube-creators.js', 'guide/creators/index.html']],
  ['scripts/generate-music.js', ['music/index.html']]
];
for (const [script, outputs] of generators) {
  const snapshots = outputs.map(f => fs.readFileSync(path.join(ROOT, f)));
  try {
    execFileSync(process.execPath, [script], { cwd: ROOT });
    outputs.forEach((f, i) => {
      const current = fs.readFileSync(path.join(ROOT, f));
      assert(Buffer.compare(snapshots[i], current) === 0, script + ': output changed for ' + f);
    });
  } finally {
    outputs.forEach((f, i) => {
      fs.writeFileSync(path.join(ROOT, f), snapshots[i]);
    });
  }
}

console.log('Structured-data checks passed for ' + PAGES.length + ' pages');
