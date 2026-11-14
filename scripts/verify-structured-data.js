'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('chrome-launcher');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://anomaly-alpha.github.io';
const SITE_ROOT = ORIGIN + '/';

const args = process.argv.slice(2);
const ALL_WATCH = args.includes('--all');
const KEEP_OPEN = args.includes('--keep-open');

// Pages that are expected to carry JSON-LD. Watch pages are sampled unless --all.
const SAMPLE_WATCH = 3;

function listWatchPages() {
  const dir = path.join(ROOT, 'watch');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /^[A-Za-z0-9_-]{11}$/.test(name) && fs.existsSync(path.join(dir, name, 'index.html')))
    .sort()
    .map(name => 'watch/' + name + '/index.html');
}

function pagesToCheck() {
  const pages = [
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
    'terms/index.html',
    'watch/index.html'
  ];
  const watch = listWatchPages();
  pages.push(...(ALL_WATCH ? watch : watch.slice(0, SAMPLE_WATCH)));
  return pages.filter(rel => fs.existsSync(path.join(ROOT, rel)));
}

function canonicalFor(rel) {
  const clean = rel.replace(/\\/g, '/').replace(/index\.html$/, '');
  return ORIGIN + '/' + clean;
}

// ===== CDP plumbing =====

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const waiters = new Map();
    let nextId = 0;
    ws.onerror = () => reject(new Error('CDP socket error'));
    ws.onopen = () => resolve({
      send(method, params) {
        return new Promise((res, rej) => {
          const id = ++nextId;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params: params || {} }));
        });
      },
      once(event) {
        return new Promise(res => waiters.set(event, res));
      },
      close() { ws.close(); }
    });
    ws.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.id && pending.has(data.id)) {
        const entry = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) entry.rej(new Error(data.error.message));
        else entry.res(data.result);
        return;
      }
      if (data.method && waiters.has(data.method)) {
        const res = waiters.get(data.method);
        waiters.delete(data.method);
        res(data.params);
      }
    };
  });
}

async function openTarget(port) {
  const res = await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' });
  if (!res.ok) throw new Error('could not open CDP target: HTTP ' + res.status);
  return res.json();
}

// Runs in the page. Returns the raw text of every JSON-LD block plus the head signals a
// crawler would read, so validation happens against the rendered DOM and not the source file.
const EXTRACT = `(() => {
  const blocks = Array.prototype.map.call(
    document.querySelectorAll('script[type="application/ld+json"]'),
    node => node.textContent
  );
  const canonical = document.querySelector('link[rel="canonical"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  const robots = document.querySelector('meta[name="robots"]');
  return JSON.stringify({
    readyState: document.readyState,
    blocks: blocks,
    canonical: canonical ? canonical.getAttribute('href') : null,
    ogUrl: ogUrl ? ogUrl.getAttribute('content') : null,
    robots: robots ? robots.getAttribute('content') : null,
    title: document.title
  });
})()`;

// ===== Invariants =====

const PAGE_NODE_TYPES = new Set(['WebPage', 'CollectionPage', 'ProfilePage', 'AboutPage', 'Article', 'ItemPage', 'ContactPage']);
const FORBIDDEN_TYPES = new Set(['HowTo', 'Product', 'Review', 'ClaimReview', 'SpecialAnnouncement', 'Course']);
const FORBIDDEN_PROPS = ['aggregateRating'];

function nodeTypes(node) {
  const t = node['@type'];
  return Array.isArray(t) ? t : [t];
}

function nodesOf(blocks) {
  return blocks.flatMap(block => block['@graph'] || [block]);
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(item => walk(item, visit)); return; }
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

// Same traversal, but carries the property path so a rule can exempt nested payloads
// such as publisher.logo (a logo is not a page image).
function walkWithPath(value, visit, trail) {
  const here = trail || [];
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, i) => walkWithPath(item, visit, here.concat(i))); return; }
  visit(value, here);
  for (const [key, child] of Object.entries(value)) walkWithPath(child, visit, here.concat(key));
}

function normalizeId(id) {
  if (typeof id !== 'string') return id;
  return id.startsWith('#') ? SITE_ROOT + id.slice(1) : id;
}

// JSON.parse keeps the last of any duplicate keys and reports nothing, so a hand-edited block
// can ship a silently wrong value that every other check here would happily accept.
function duplicateKeys(text) {
  const found = [];
  const stack = [];
  let i = 0;
  let pendingKey = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      stack.push({ isObject: ch === '{', keys: new Set() });
      pendingKey = ch === '{';
      i++;
      continue;
    }
    if (ch === '}' || ch === ']') {
      stack.pop();
      pendingKey = false;
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') { value += text[j]; j++; }
        if (j < text.length) { value += text[j]; j++; }
      }
      i = j + 1;
      const top = stack[stack.length - 1];
      if (pendingKey && top && top.isObject) {
        if (top.keys.has(value)) found.push(value);
        top.keys.add(value);
        pendingKey = false;
      }
      continue;
    }
    if (ch === ',') {
      const top = stack[stack.length - 1];
      pendingKey = !!(top && top.isObject);
      i++;
      continue;
    }
    i++;
  }
  return found;
}

function checkPage(rel, payload) {
  const violations = [];
  const expected = canonicalFor(rel);
  const fail = msg => violations.push(rel + ': ' + msg);

  if (payload.canonical !== expected) fail('canonical is ' + payload.canonical + ', expected ' + expected);
  if (payload.ogUrl && payload.ogUrl !== expected) fail('og:url is ' + payload.ogUrl + ', expected ' + expected);
  if (payload.blocks.length === 0) { fail('no JSON-LD block'); return violations; }

  const blocks = [];
  payload.blocks.forEach((text, i) => {
    duplicateKeys(text).forEach(key => fail('block ' + i + ' has duplicate key "' + key + '"'));
    try {
      blocks.push(JSON.parse(text));
    } catch (err) {
      fail('block ' + i + ' does not parse: ' + err.message);
    }
  });
  if (blocks.length !== payload.blocks.length) return violations;

  blocks.forEach((block, i) => {
    if (block['@context'] !== 'https://schema.org') fail('block ' + i + ' @context is ' + block['@context']);
  });

  const nodes = nodesOf(blocks);
  const types = nodes.flatMap(nodeTypes);

  // I1 - exactly one WebSite, canonical @id
  const websites = nodes.filter(node => nodeTypes(node).includes('WebSite'));
  if (websites.length !== 1) fail('expected exactly one WebSite node, found ' + websites.length);
  websites.forEach(node => {
    if (node['@id'] !== SITE_ROOT + '#website') fail('WebSite @id is ' + node['@id']);
    if (!node.name) fail('WebSite missing name');
    if (!node.inLanguage) fail('WebSite missing inLanguage');
  });

  // I2 - exactly one node describing this page URL. A page node may either carry the page
  // URL directly or be identified by a fragment of it (…/privacy/#article).
  const pageNodes = nodes.filter(node => {
    const t = nodeTypes(node);
    if (!t.some(type => PAGE_NODE_TYPES.has(type))) return false;
    const candidates = [node.url, node['@id']].filter(value => typeof value === 'string').map(normalizeId);
    return candidates.some(value => value === expected || value.indexOf(expected + '#') === 0);
  });
  if (pageNodes.length !== 1) fail('expected exactly one page-level node for ' + expected + ', found ' + pageNodes.length);

  // I3 - every typed @id reference resolves inside this page. A node that carries properties
  // beyond "@id"/"@type" is an inline definition (and defines its own id), not a reference.
  const definedIds = new Set(nodes.filter(node => node['@id']).map(node => normalizeId(node['@id'])));
  walkWithPath(blocks, obj => {
    if (!obj['@id']) return;
    const extra = Object.keys(obj).filter(key => key !== '@id' && key !== '@type');
    if (extra.length > 0) definedIds.add(normalizeId(obj['@id']));
  });
  walkWithPath(blocks, obj => {
    if (!obj['@id'] || !obj['@type']) return;
    const extra = Object.keys(obj).filter(key => key !== '@id' && key !== '@type');
    if (extra.length > 0) return;
    if (!definedIds.has(normalizeId(obj['@id']))) fail('dangling reference ' + obj['@id']);
  });

  // I4 - dates carry an offset
  const DATE_KEYS = ['datePublished', 'dateModified', 'dateCreated', 'uploadDate', 'expires'];
  walk(blocks, obj => {
    for (const key of DATE_KEYS) {
      const value = obj[key];
      if (typeof value !== 'string') continue;
      if (!/T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(value)) {
        fail(key + ' lacks a timezone offset: ' + value);
      }
    }
  });

  // I5 - image metadata for the page's own images. Exempts publisher logos (not page images)
  // and third-party assets such as YouTube thumbnails, which must not carry licence claims.
  walkWithPath(blocks, (obj, trail) => {
    if (!nodeTypes(obj).includes('ImageObject')) return;
    const url = obj.contentUrl || obj.url;
    if (typeof url !== 'string' || url.indexOf(SITE_ROOT) !== 0) return;
    if (trail.indexOf('logo') !== -1) return;
    if (!obj.width || !obj.height) fail('ImageObject missing width/height: ' + url);
    if (!obj.license && !obj.creator && !obj.creditText && !obj.copyrightNotice) {
      fail('ImageObject missing licence/creator/credit: ' + url);
    }
  });

  // I6 - retired or policy-risky markup
  types.forEach(type => {
    if (FORBIDDEN_TYPES.has(type)) fail('forbidden @type ' + type);
  });
  walk(blocks, obj => {
    for (const key of FORBIDDEN_PROPS) {
      if (obj[key] !== undefined) fail('forbidden property ' + key);
    }
    if (obj['@type'] === 'SearchAction') fail('SearchAction is retired');
  });

  // Watch pages: exactly one VideoObject, and only there
  const videoObjects = nodes.filter(node => nodeTypes(node).includes('VideoObject'));
  const isWatchPage = /^watch\/[A-Za-z0-9_-]{11}\/index\.html$/.test(rel);
  if (isWatchPage && videoObjects.length !== 1) fail('watch page must have exactly one VideoObject, found ' + videoObjects.length);
  if (!isWatchPage && videoObjects.length !== 0) fail('VideoObject outside a watch page');

  return violations;
}

// ===== Main =====

async function main() {
  const pages = pagesToCheck();
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions'],
  });
  let cdp = null;
  const results = [];
  try {
    const target = await openTarget(chrome.port);
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const rel of pages) {
      const fileUrl = 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: fileUrl });
      await loaded;
      const evaluated = await cdp.send('Runtime.evaluate', { expression: EXTRACT, returnByValue: true });
      if (evaluated.exceptionDetails) {
        results.push({ rel, violations: [rel + ': page evaluation failed: ' + evaluated.exceptionDetails.text] });
        continue;
      }
      const payload = JSON.parse(evaluated.result.value);
      results.push({ rel, violations: checkPage(rel, payload) });
    }
  } finally {
    if (cdp && !KEEP_OPEN) cdp.close();
    await chrome.kill();
  }

  let failed = 0;
  for (const result of results) {
    if (result.violations.length === 0) {
      console.log('  PASS  ' + result.rel);
      continue;
    }
    failed++;
    console.log('  FAIL  ' + result.rel);
    result.violations.forEach(violation => console.log('        - ' + violation));
  }
  console.log('');
  console.log(results.length + ' pages checked, ' + (results.length - failed) + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Error: ' + err.message);
  process.exit(1);
});
