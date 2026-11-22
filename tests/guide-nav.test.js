const assert = require('assert');
const fs = require('fs');
const path = require('path');

const nav = require('../scripts/generate-guide-nav');

const ROOT = path.join(__dirname, '..');
const SLUGS = nav.ITEMS.map((item) => item.slug);

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function navBlock(html, file) {
  const start = html.indexOf(nav.START_MARKER);
  const end = html.indexOf(nav.END_MARKER);
  assert.ok(start !== -1 && end !== -1, `${file}: missing guide nav markers`);
  assert.strictEqual(html.indexOf(nav.START_MARKER, start + 1), -1, `${file}: duplicate guide nav start marker`);
  return html.slice(start, end + nav.END_MARKER.length);
}

// Resolves a nav href to the guide slug it points at, so pages at different depths compare.
function slugOf(href) {
  const match = String(href).match(/guide\/([a-z-]+)\/$/) || String(href).match(/^\.\.\/([a-z-]+)\/$/);
  return match ? match[1] : null;
}

// Walks the nav in document order so the current page occupies its slot even though it is
// rendered as a span: the point of the test is that the slot never moves.
function destinations(block, activeSlug) {
  const out = [];
  for (const hit of block.matchAll(/<a[^>]*href="([^"]+)"|<span[^>]*aria-current="page"/g)) {
    if (hit[1] === undefined) {
      out.push(activeSlug);
      continue;
    }
    const slug = slugOf(hit[1]);
    if (slug) out.push(slug);
  }
  return out;
}

const orders = new Map();

for (const item of nav.ITEMS) {
  const file = `guide/${item.slug}/index.html`;
  const html = read(file);
  const block = navBlock(html, file);

  // --- the committed markup is exactly what the generator would write ------
  const expected = nav.renderNav(item.slug).replace(/\r\n/g, '\n');
  assert.strictEqual(block.replace(/\r\n/g, '\n'), expected, `${file}: nav is stale — run npm run generate-nav`);

  // --- exactly one current page, rendered as text rather than a link ------
  const current = [...block.matchAll(/<span[^>]*aria-current="page"[^>]*>([^<]+)</g)];
  assert.strictEqual(current.length, 1, `${file}: expected exactly one aria-current item, found ${current.length}`);
  assert.strictEqual(current[0][1].trim(), item.label, `${file}: aria-current is on "${current[0][1].trim()}", expected "${item.label}"`);

  // The current page must not be a link to itself: that is what made the redeem
  // page's own entry invisible — it was an ordinary link with no rendered state.
  const selfHref = new RegExp(`href="(?:\\.\\./)?guide/${item.slug}/"|href="\\.\\./${item.slug}/"`);
  assert.ok(!selfHref.test(block), `${file}: nav links to the page it is already on`);

  assert.ok(block.includes('aria-label="Guide navigation"'), `${file}: nav needs an accessible name`);

  // --- same order everywhere ----------------------------------------------
  const order = destinations(block, item.slug);
  assert.deepStrictEqual(order, SLUGS, `${file}: nav order differs from the canonical order`);
  orders.set(item.slug, order.join(' '));
}

const distinct = new Set(orders.values());
assert.strictEqual(distinct.size, 1, `guide pages disagree on nav order: ${[...distinct].join(' | ')}`);

// --- the homepage nav advertises the same destinations, in the same order --
const home = read('index.html');
const homeNav = home.match(/<nav[^>]*aria-label="Guide navigation"[^>]*>([\s\S]*?)<\/nav>/);
assert.ok(homeNav, 'index.html: missing the guide nav');
assert.deepStrictEqual(destinations(homeNav[1]), SLUGS, 'index.html: nav order differs from the guide pages');

// --- the "← Gem calculator" backlink resolves to the top of the page ------
// The id sat on the weekly-summary card near the bottom, so the link dumped every guide
// visitor at the end of a long page. It belongs on the page's outermost content element.
assert.ok(!/id="gem-calculator"[^>]*aria-labelledby="weekly-summary-heading"/.test(home), 'the gem-calculator anchor is back on the bottom summary card');
const anchor = home.match(/<div id="gem-calculator"[^>]*>/);
assert.ok(anchor, 'index.html: gem-calculator anchor is missing');
assert.ok(anchor[0].includes('gem-container'), 'index.html: gem-calculator anchor must sit on the top-level container');

console.log(`Guide nav checks passed — ${nav.ITEMS.length} links, identical order on ${nav.PAGES.length} pages plus the homepage`);
