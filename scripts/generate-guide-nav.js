// Keeps the guide-cluster nav identical on every guide page.
//
// The nav was hand-copied into ten pages and had drifted into six variants: different link
// orders, "Code"/"Codes"/"Code Guide" labels for the same target, "Wish Event" in the middle
// on one page and at the end on another, and an `aria-current` on the redeem page that no
// stylesheet rendered while every other page used a non-link span instead. The order lives
// in ITEMS now, so it cannot drift again; the page's own entry is rendered as a span with
// `aria-current="page"` in the same slot, which is what makes the current page visible.
//
// Ordering rationale: codes first (the main page), redeem second (the action that follows a
// code), then the reward pages grouped as events + wish event, then PvP, login, and the
// reference pages. "← Gem calculator" stays pinned ahead of the divider as the back affordance.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const START_MARKER = '<!--GUIDE_NAV_START-->';
const END_MARKER = '<!--GUIDE_NAV_END-->';

// Adding a guide page means adding one entry here and putting the two markers around the nav
// in that page. Never edit a single page's links by hand: it is what produced the drift.
const ITEMS = [
  { slug: 'code', label: 'Codes', color: 'code' },
  { slug: 'redeem', label: 'Redeem', color: 'code' },
  { slug: 'event', label: 'Events', color: 'event' },
  { slug: 'wish-event', label: 'Wish Event', color: 'event' },
  { slug: 'pvp', label: 'PvP', color: 'pvp' },
  { slug: 'login', label: 'Login', color: 'login' },
  { slug: 'faq', label: 'FAQ', color: 'cyan' },
  { slug: 'xp', label: 'XP', color: 'cyan' },
  { slug: 'beginners', label: 'Beginner Guide', color: 'cyan' },
];

const PAGES = ITEMS.map((item) => `guide/${item.slug}/index.html`);

// The creators directory is noindex,follow and is no longer an ITEMS entry, but it still
// renders the shared nav so the page is not a dead end. It gets the nine links with no
// aria-current, because its own page is not one of the destinations.
const SHARED_NAV_PAGES = ['guide/creators/index.html'];
const ALL_PAGES = [...PAGES, ...SHARED_NAV_PAGES];

function renderNav(activeSlug) {
  const links = ITEMS.map((item) => {
    if (item.slug === activeSlug) {
      return `            <span class="text-white font-semibold" aria-current="page">${item.label}</span>`;
    }
    return `            <a href="../${item.slug}/" class="hover:text-white transition-colors gem-text--${item.color}">${item.label}</a>`;
  });
  return [
    START_MARKER,
    '        <nav class="flex flex-wrap gap-4 items-center text-sm gem-text--cyan mb-6 p-4 border-b border-white/10" aria-label="Guide navigation">',
    '            <a href="../../#gem-calculator" class="hover:text-white transition-colors">&larr; Gem calculator</a>',
    '            <span class="text-white/30" aria-hidden="true">|</span>',
    ...links,
    '        </nav>',
    END_MARKER,
  ].join('\n');
}

function pageSlug(pagePath) {
  const match = String(pagePath).match(/^guide\/([^/]+)\/index\.html$/);
  if (!match) throw new Error(`${pagePath}: not a guide page path`);
  return match[1];
}

function inject(html, page) {
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const block = renderNav(pageSlug(page)).replace(/\n/g, eol);

  const starts = html.split(START_MARKER).length - 1;
  const ends = html.split(END_MARKER).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error(`${page}: expected one start and one end marker, found ${starts} and ${ends}`);
  }

  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (end < start) throw new Error(`${page}: end marker precedes start marker`);

  const endLineBreak = html.indexOf(eol, end);
  const stop = endLineBreak === -1 ? html.length : endLineBreak + eol.length;
  return html.slice(0, start) + block + eol + html.slice(stop);
}

function main() {
  let written = 0;
  let unchanged = 0;

  for (const page of ALL_PAGES) {
    const pagePath = path.join(rootDir, page);
    if (!fs.existsSync(pagePath)) throw new Error(`missing page: ${page}`);

    const before = fs.readFileSync(pagePath, 'utf8');
    const after = inject(before, page);
    if (after === before) {
      unchanged++;
      continue;
    }
    fs.writeFileSync(pagePath, after, 'utf8');
    written++;
  }

  console.log(`guide nav: ${ITEMS.length} links across ${ALL_PAGES.length} pages (${written} rewritten, ${unchanged} already current)`);
}

module.exports = { ITEMS, PAGES, ALL_PAGES, START_MARKER, END_MARKER, renderNav, pageSlug };

if (require.main === module) main();
