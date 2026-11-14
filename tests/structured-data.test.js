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
  'guide/wish-event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/xp/index.html',
  'guide/redeem/index.html',
  'guide/creators/index.html',
  'authors/anomaly/index.html',
  'music/index.html',
  'about/index.html',
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
  'about/index.html',
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

function nodeTypes(node) {
  return Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
}

// Same traversal as allNodes, but carries the property path so a rule can exempt nested
// payloads such as publisher.logo (a logo is not a page image).
function walkWithPath(value, visit, trail) {
  const here = trail || [];
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, i) => walkWithPath(item, visit, here.concat(i))); return; }
  visit(value, here);
  for (const [key, child] of Object.entries(value)) walkWithPath(child, visit, here.concat(key));
}

const SITE_ROOT = 'https://anomaly-alpha.github.io/';

function normalizeId(id) {
  return typeof id === 'string' && id.startsWith('#') ? SITE_ROOT + id.slice(1) : id;
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
  'guide/wish-event/index.html': 'https://anomaly-alpha.github.io/guide/wish-event/',
  'guide/pvp/index.html': 'https://anomaly-alpha.github.io/guide/pvp/',
  'guide/login/index.html': 'https://anomaly-alpha.github.io/guide/login/',
  'guide/faq/index.html': 'https://anomaly-alpha.github.io/guide/faq/',
  'guide/xp/index.html': 'https://anomaly-alpha.github.io/guide/xp/',
  'guide/redeem/index.html': 'https://anomaly-alpha.github.io/guide/redeem/',
  'guide/creators/index.html': 'https://anomaly-alpha.github.io/guide/creators/',
  'authors/anomaly/index.html': 'https://anomaly-alpha.github.io/authors/anomaly/',
  'music/index.html': 'https://anomaly-alpha.github.io/music/',
  'about/index.html': 'https://anomaly-alpha.github.io/about/',
  'privacy/index.html': 'https://anomaly-alpha.github.io/privacy/',
  'terms/index.html': 'https://anomaly-alpha.github.io/terms/'
};
const requiredTypes = {
  'index.html': ['WebPage'],
  'guide/code/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/beginners/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/event/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/wish-event/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/pvp/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/login/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/faq/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
  'guide/xp/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'DefinedTerm'],
  'guide/redeem/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage'],
  'guide/creators/index.html': ['BreadcrumbList', 'VideoGame', 'CollectionPage', 'ItemList'],
  'authors/anomaly/index.html': ['ProfilePage'],
  'music/index.html': ['CollectionPage', 'BreadcrumbList', 'ItemList'],
  'about/index.html': ['AboutPage', 'Person'],
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
// 16 editorial pages + the /watch/ hub + one watch page per indexed creator video.
const watchPageDirs = fs.existsSync(path.join(ROOT, 'watch'))
  ? fs.readdirSync(path.join(ROOT, 'watch')).filter(name => /^[A-Za-z0-9_-]{11}$/.test(name)).length
  : 0;
const expectedLocCount = 16 + 1 + watchPageDirs;
assert.strictEqual(locCount, expectedLocCount,
  'sitemap must contain exactly ' + expectedLocCount + ' <loc> entries, found ' + locCount);
assert(sitemap.includes('https://anomaly-alpha.github.io/watch/'), 'sitemap missing the watch hub');
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

const promoCodeSource = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'codes.json'), 'utf8'));
const activePromoCodeCount = promoCodeSource.codes.filter(code => !code.expired).length;
const faqHtml = fs.readFileSync(path.join(ROOT, 'guide', 'faq', 'index.html'), 'utf8');
const faqNodes = nodesFor(blocksFor('guide/faq/index.html'));
const faqCodeAnswer = faqNodes
  .filter(node => node['@type'] === 'FAQPage')
  .flatMap(page => page.mainEntity || [])
  .find(question => question.name === 'Are there any new promo codes?');
assert(faqCodeAnswer, 'FAQ: promo-code question must exist in structured data');
assert(faqCodeAnswer.acceptedAnswer.text.includes(activePromoCodeCount + ' active promo codes'), 'FAQ schema count must match data/codes.json');
assert(visibleText(faqHtml).includes(activePromoCodeCount + ' active promo codes'), 'FAQ visible count must match data/codes.json');
for (const url of ['https://anomaly-alpha.github.io/', 'https://anomaly-alpha.github.io/guide/code/', 'https://anomaly-alpha.github.io/guide/faq/']) {
  const entry = sitemap.split(/<url>/).slice(1).map(block => block.split('</url>')[0]).find(block => block.includes('<loc>' + url + '</loc>'));
  assert(entry, 'sitemap missing code-updated page ' + url);
  const lastmod = entry.match(/<lastmod>([^<]+)<\/lastmod>/);
  assert(lastmod, 'sitemap entry missing lastmod for ' + url);
  assert.strictEqual(lastmod[1], promoCodeSource.updated, 'sitemap lastmod must match code data date for ' + url);
}

// ===== Local reference resolution =====
// A reference is an object carrying @id plus @type and nothing else; an object carrying @id
// plus any other property is an inline definition and defines its own id. Fragment IDs are
// normalized against SITE_ROOT. Every reference must resolve inside its own page's graph.

for (const file of PAGES) {
  const blocks = blocksFor(file);
  const definedIds = new Set(nodesFor(blocks).filter(node => node['@id']).map(node => normalizeId(node['@id'])));
  walkWithPath(blocks, node => {
    if (!node['@id']) return;
    if (Object.keys(node).some(key => key !== '@id' && key !== '@type')) definedIds.add(normalizeId(node['@id']));
  });
  walkWithPath(blocks, node => {
    if (!node['@id'] || !node['@type']) return;
    if (Object.keys(node).some(key => key !== '@id' && key !== '@type')) return;
    assert(definedIds.has(normalizeId(node['@id'])),
      file + ': dangling ' + nodeTypes(node).join('/') + ' reference @id "' + node['@id'] + '"');
  });
}

// ===== Entity graph invariants (I1-I6) =====
// Mirrors scripts/verify-structured-data.js so the static and browser suites cannot drift.

const PAGE_NODE_TYPES = new Set(['WebPage', 'CollectionPage', 'ProfilePage', 'AboutPage', 'Article', 'ItemPage']);
const FORBIDDEN_TYPES = new Set(['HowTo', 'SearchAction', 'Product', 'Review']);
const DATE_PROPERTIES = ['datePublished', 'dateModified', 'dateCreated', 'uploadDate', 'expires'];
const OFFSET_QUALIFIED_DATE = /T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/;

for (const file of PAGES) {
  const blocks = blocksFor(file);
  const nodes = nodesFor(blocks);
  const pageUrl = canonicalUrls[file];

  // I1 - exactly one WebSite node, canonical @id, name and language
  const websites = nodes.filter(node => nodeTypes(node).includes('WebSite'));
  assert.strictEqual(websites.length, 1, file + ': expected exactly one WebSite node, found ' + websites.length);
  assert.strictEqual(websites[0]['@id'], SITE_ROOT + '#website', file + ': WebSite @id must be ' + SITE_ROOT + '#website');
  assert(websites[0].name, file + ': WebSite missing name');
  assert(websites[0].inLanguage, file + ': WebSite missing inLanguage');

  // I2 - exactly one page-level node, describing this page URL directly or by fragment
  const pageNodes = nodes.filter(node => {
    if (!nodeTypes(node).some(type => PAGE_NODE_TYPES.has(type))) return false;
    return [node.url, node['@id']]
      .filter(value => typeof value === 'string')
      .map(normalizeId)
      .some(value => value === pageUrl || value.indexOf(pageUrl + '#') === 0);
  });
  assert.strictEqual(pageNodes.length, 1,
    file + ': expected exactly one page-level node for ' + pageUrl + ', found ' + pageNodes.length);

  // I4 - every datetime carries a timezone offset
  for (const node of allNodes(blocks)) {
    for (const key of DATE_PROPERTIES) {
      const value = node[key];
      if (typeof value !== 'string') continue;
      assert(OFFSET_QUALIFIED_DATE.test(value), file + ': ' + key + ' lacks a timezone offset: ' + value);
    }
  }

  // I5 - owned images carry dimensions and a licence or credit. Publisher logos are not page
  // images and YouTube thumbnails are third-party assets that must not claim a licence.
  walkWithPath(blocks, (node, trail) => {
    if (!nodeTypes(node).includes('ImageObject')) return;
    const imageUrl = node.contentUrl || node.url;
    if (typeof imageUrl !== 'string' || imageUrl.indexOf(SITE_ROOT) !== 0) return;
    if (trail.indexOf('logo') !== -1) return;
    assert(node.width, file + ': ImageObject missing width: ' + imageUrl);
    assert(node.height, file + ': ImageObject missing height: ' + imageUrl);
    assert(node.license || node.creator || node.creditText || node.copyrightNotice,
      file + ': ImageObject missing license/creator/creditText/copyrightNotice: ' + imageUrl);
  });

  // I6 - retired and policy-risky markup
  walkWithPath(blocks, node => {
    nodeTypes(node).forEach(type => {
      assert(!FORBIDDEN_TYPES.has(type), file + ': forbidden @type ' + type);
    });
    assert.strictEqual(node.aggregateRating, undefined, file + ': forbidden property aggregateRating');
  });
}

// ===== Generator idempotency =====

const generators = [
  ['scripts/generate-codes.js', ['data/generated/promo-codes.js', 'guide/code/index.html', 'guide/faq/index.html', 'index.html', 'sitemap.xml']],
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
