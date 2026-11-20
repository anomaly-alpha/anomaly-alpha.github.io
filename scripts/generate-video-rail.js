// Injects the editorial video rail into the pages that share the site stylesheet.
//
// Placement matches the creators guide: directly after the hero block (the <h1>'s parent
// element) and before the page's real content, so the rail is the first thing below the
// title. The rail auto-scrolls like the creators ticker, which means the card set is
// rendered twice and the track translates by -50% for a seamless loop; the copy is hidden
// from assistive tech and is not tabbable.
//
// `authors/anomaly/` is deliberately absent: that page is a standalone profile with its own
// inline CSS and does not link styles.css, so the rail would render unstyled there.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dataPath = path.join(rootDir, 'data', 'youtube-creators.json');

const MAX_ITEMS = 8;
const START_MARKER = '<!--VIDEO_RAIL_START-->';
const END_MARKER = '<!--VIDEO_RAIL_END-->';

// Only elements that can own the <h1> block; keeps the stack scan from chasing void tags.
const BLOCK_TAGS = ['div', 'header', 'article', 'section', 'main', 'body'];

const PAGES = [
  'index.html',
  'about/index.html',
  'music/index.html',
  'privacy/index.html',
  'terms/index.html',
  'guide/code/index.html',
  'guide/beginners/index.html',
  'guide/event/index.html',
  'guide/faq/index.html',
  'guide/login/index.html',
  'guide/pvp/index.html',
  'guide/redeem/index.html',
  'guide/wish-event/index.html',
  'guide/xp/index.html',
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  const parts = String(iso).slice(0, 10).split('-');
  if (parts.length !== 3) return String(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(parts[1]) - 1];
  if (!month) return String(iso);
  return `${month} ${Number(parts[2])}, ${parts[0]}`;
}

// Newest playable video per creator, then newest overall. No freshness window: an empty rail
// would silently disappear, and these links are useful regardless of the video's age.
function pickVideos(data) {
  const picks = [];
  for (const creator of data.creators) {
    if (creator.status !== 'active') continue;
    const candidates = (creator.videos || [])
      .filter((video) => {
        const meta = video.youtube || {};
        return video.status === 'active' && meta.playable !== false && meta.embeddable !== false;
      })
      .sort((a, b) => new Date(b.published) - new Date(a.published));
    if (!candidates.length) continue;
    picks.push({ creator, video: candidates[0] });
  }
  picks.sort((a, b) => {
    const byDate = new Date(b.video.published) - new Date(a.video.published);
    if (byDate !== 0) return byDate;
    return (a.creator.displayOrder || 0) - (b.creator.displayOrder || 0);
  });
  return picks.slice(0, MAX_ITEMS);
}

function relativePrefix(pagePath) {
  const depth = pagePath.split('/').length - 1;
  return '../'.repeat(depth);
}

function renderCard({ creator, video }, prefix, duplicate) {
  return [
    '                  <li class="gem-video-rail__item">',
    `                    <a class="gem-video-rail__card" href="${prefix}watch/${escapeHtml(video.id)}/"${duplicate ? ' tabindex="-1"' : ''}>`,
    '                      <span class="gem-video-rail__thumb">',
    `                        <img src="https://i.ytimg.com/vi/${escapeHtml(video.id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">`,
    '                        <span class="gem-video-rail__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" focusable="false"><path d="M8 5v14l11-7z"/></svg></span>',
    '                      </span>',
    `                      <span class="gem-video-rail__title">${escapeHtml(video.title)}</span>`,
    `                      <span class="gem-video-rail__meta"><span class="gem-video-rail__creator">${escapeHtml(creator.name)}</span> &middot; <time class="gem-video-rail__date" datetime="${escapeHtml(video.published)}">${escapeHtml(formatDate(video.published))}</time></span>`,
    '                    </a>',
    '                  </li>',
  ].join('\n');
}

function renderGroup(picks, prefix, duplicate) {
  const cards = picks.map((pick) => renderCard(pick, prefix, duplicate)).join('\n');
  const hidden = duplicate ? ' aria-hidden="true"' : '';
  return [`                <ul class="gem-video-rail__group"${hidden}>`, cards, '                </ul>'].join('\n');
}

function renderRail(picks, prefix) {
  return [
    START_MARKER,
    '        <section class="gem-video-rail" aria-labelledby="video-rail-title">',
    '          <h2 class="gem-video-rail__title" id="video-rail-title">Latest creator videos</h2>',
    '          <div class="gem-video-rail__viewport">',
    '            <div class="gem-video-rail__track">',
    renderGroup(picks, prefix, false),
    renderGroup(picks, prefix, true),
    '            </div>',
    '          </div>',
    `          <p class="gem-video-rail__more"><a class="gem-video-rail__more-link" href="${prefix}guide/creators/">See every creator and video &rarr;</a></p>`,
    '        </section>',
    END_MARKER,
  ].join('\n');
}

// Index just past the closing tag of the <h1>'s parent element, i.e. the end of the hero block.
// The scan starts at <body> on purpose: running it over the whole document lets the large inline
// JSON/style blocks in <head> desynchronise the tag stack, which silently put the rail in the
// wrong container. Note the hero is not always inside <main> — index.html puts its hero before
// <main class="gem-grid--cards">, so no assumption is made about <main> at all.
function heroCloseIndex(html, pagePath) {
  const h1 = html.indexOf('<h1');
  if (h1 === -1) throw new Error(`${pagePath}: no <h1 found`);

  const bodyAt = html.indexOf('<body');
  if (bodyAt === -1) throw new Error(`${pagePath}: no <body found`);
  if (bodyAt > h1) throw new Error(`${pagePath}: <h1> appears before <body>`);

  const stack = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  tagRe.lastIndex = bodyAt;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    if (match.index >= h1) break;
    const tag = match[1].toLowerCase();
    if (BLOCK_TAGS.indexOf(tag) === -1) continue;
    const closing = match[0].charAt(1) === '/';
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at !== -1) stack.length = at;
    } else if (match[2] !== '/') {
      stack.push(tag);
    }
  }

  const parent = stack[stack.length - 1];
  if (!parent) throw new Error(`${pagePath}: could not determine the <h1> parent element`);

  // Walk forward from </h1> until the parent's own closing tag balances out.
  const from = html.indexOf('</h1>') + 5;
  const openRe = new RegExp(`<${parent}\\b`, 'g');
  const closeRe = new RegExp(`</${parent}>`, 'g');
  let depth = 1;
  let cursor = from;
  while (cursor < html.length) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (!c) break;
    if (o && o.index < c.index) {
      depth++;
      cursor = o.index + parent.length + 1;
      continue;
    }
    depth--;
    cursor = c.index + parent.length + 3;
    if (depth === 0) return cursor;
  }
  throw new Error(`${pagePath}: could not find the closing </${parent}> for the hero block`);
}

function inject(html, rail, pagePath) {
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const block = rail.replace(/\n/g, eol);

  if (html.includes(START_MARKER) || html.includes(END_MARKER)) {
    const starts = (html.match(new RegExp(START_MARKER, 'g')) || []).length;
    const ends = (html.match(new RegExp(END_MARKER, 'g')) || []).length;
    if (starts !== 1 || ends !== 1) {
      throw new Error(`${pagePath}: expected one start and one end marker, found ${starts} and ${ends}`);
    }
    const start = html.indexOf(START_MARKER);
    const end = html.indexOf(END_MARKER);
    if (end < start) throw new Error(`${pagePath}: end marker precedes start marker`);
    const endLineBreak = html.indexOf(eol, end);
    const stop = endLineBreak === -1 ? html.length : endLineBreak + eol.length;
    return html.slice(0, start) + block + eol + html.slice(stop);
  }

  const at = heroCloseIndex(html, pagePath);
  const lineEnd = html.indexOf(eol, at);
  const insertAt = lineEnd === -1 ? html.length : lineEnd + eol.length;
  return html.slice(0, insertAt) + eol + block + eol + html.slice(insertAt);
}

function main() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const picks = pickVideos(data);
  if (picks.length < 2) {
    console.log(`only ${picks.length} eligible video(s) — rail not written`);
    return;
  }

  let writtenCount = 0;
  let unchanged = 0;
  for (const page of PAGES) {
    const pagePath = path.join(rootDir, page);
    if (!fs.existsSync(pagePath)) throw new Error(`missing page: ${page}`);
    const before = fs.readFileSync(pagePath, 'utf8');
    const after = inject(before, renderRail(picks, relativePrefix(page)), page);
    if (after === before) {
      unchanged++;
      continue;
    }
    fs.writeFileSync(pagePath, after, 'utf8');
    const written = fs.readFileSync(pagePath, 'utf8');
    const starts = (written.match(new RegExp(START_MARKER, 'g')) || []).length;
    const ends = (written.match(new RegExp(END_MARKER, 'g')) || []).length;
    if (starts !== 1 || ends !== 1) {
      throw new Error(`${page}: markers corrupted after write (${starts} start, ${ends} end)`);
    }
    writtenCount++;
  }

  console.log(`video rail: ${picks.length} videos across ${PAGES.length} pages (${writtenCount} rewritten, ${unchanged} already current)`);
}

main();
