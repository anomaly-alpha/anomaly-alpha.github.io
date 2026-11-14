const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const codesPath = path.join(rootDir, 'data', 'codes.json');
const jsOutputPath = path.join(rootDir, 'data', 'generated', 'promo-codes.js');
const codeGuidePath = path.join(rootDir, 'guide', 'code', 'index.html');
const faqGuidePath = path.join(rootDir, 'guide', 'faq', 'index.html');
const indexPath = path.join(rootDir, 'index.html');
const sitemapPath = path.join(rootDir, 'sitemap.xml');

const { codes, updated, seoMonth } = JSON.parse(fs.readFileSync(codesPath, 'utf8'));

// JSON-LD datetimes need an offset; a bare YYYY-MM-DD fails Google's datetime validation.
const updatedIso = updated + 'T00:00:00+00:00';

const active = codes.filter(c => !c.expired);
const expired = codes.filter(c => c.expired);

function addedDate(code) {
  return code.dateAdded ? new Date(code.dateAdded) : new Date(0);
}

// Hand-positioned codes lead the list (reactivations, hot drops); everything else follows newest-first.
active.sort((a, b) => {
  const aPos = a.position === undefined ? Infinity : a.position;
  const bPos = b.position === undefined ? Infinity : b.position;
  if (aPos !== bPos) return aPos < bPos ? -1 : 1;
  return addedDate(b) - addedDate(a);
});
// Codes with an unknown expiry date sort last rather than producing NaN comparisons.
expired.sort((a, b) => {
  const aDate = a.expiredDate ? new Date(a.expiredDate).getTime() : -Infinity;
  const bDate = b.expiredDate ? new Date(b.expiredDate).getTime() : -Infinity;
  return bDate - aDate;
});

const pinned = active.filter(c => c.position !== undefined);
const newestPinned = pinned.length ? Math.max(...pinned.map(addedDate)) : null;
const stalePins = newestPinned ? active.filter(c => c.position === undefined && addedDate(c) > newestPinned) : [];
if (stalePins.length) {
  console.warn(`WARN: newer than the pinned codes but unpositioned — they will list after them: ${stalePins.map(c => c.code).join(', ')}`);
}

const activeCount = active.length;
const expiredCount = expired.length;
const activeCodeItems = active.map((c, index) =>
  `            { "@type": "ListItem", "position": ${index + 1}, "item": { "@type": "Code", "name": "${c.code}" } }`
).join(',\n') + '\n';

// Build code chips
const SVG_REACTIVATED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L317 154c-6.9 6.9-8.6 17.2-4.9 26.2s12.5 14.8 22.2 14.8z"/></svg>';

function codeBadge(c) {
  if (c.reactivated) {
    return `<span class="gem-code--badge gem-code--badge--reactivated">${SVG_REACTIVATED}Reactivated</span>`;
  }
  const daysOld = Math.floor((new Date() - new Date(c.dateAdded + 'T00:00:00Z')) / (1000 * 60 * 60 * 24));
  if (daysOld < 7) return '<span class="gem-code--badge gem-code--badge--new">NEW</span>';
  if (daysOld < 14) return '<span class="gem-code--badge gem-code--badge--recent">Recent</span>';
  return '';
}

function activeChip(c) {
  return `<span class="gem-code__chip gem-text--code text-sm font-bold tracking-widest bg-white/5 px-3 py-1.5 rounded border border-white/10 cursor-pointer" onclick="event.stopPropagation();copyCode('${c.code}',this)">${c.code}${codeBadge(c)}</span>`;
}

function expiredChip(c) {
  return `<span class="text-sm font-bold tracking-widest bg-red-950/40 px-3 py-1.5 rounded border border-red-500/30 text-red-400">${c.code}</span>`;
}

const activeChips = active.map(activeChip).join('');
const expiredChips = expired.map(expiredChip).join('');

// ===== Reward display =====

const REWARD_KINDS = {
  hero: r => `${formatQty(r.qty)} x ${r.hero}`,
  dossier: r => `${formatQty(r.qty)} x Hero Dossiers`,
  gold_dossier: r => `${formatQty(r.qty)} x Gold Dossiers`,
  equipment_ticket: r => `${formatQty(r.qty)} x Equipment Tickets`,
  dna_sequencer: r => `${formatQty(r.qty)} x DNA Sequencers`,
  molecular: r => `${formatQty(r.qty)} x Molecular Enhancements`,
  special_molecular: r => `${formatQty(r.qty)} x Special Molecular Enhancements`,
  gear_piece: r => `${formatQty(r.qty)} x ${r.gear} pieces`,
};

function formatQty(n) {
  return Number(n).toLocaleString('en-US');
}

function formatRewardItem(item) {
  if (item.label) return `${formatQty(item.qty)} x ${item.label}`;
  const build = REWARD_KINDS[item.kind];
  if (!build) throw new Error(`unknown reward kind "${item.kind}"`);
  return build(item);
}

function formatReward(c) {
  if (Array.isArray(c.rewards) && c.rewards.length) return c.rewards.map(formatRewardItem).join(', ');
  if (c.reward) return c.reward;
  if (c.gems > 0) return `${formatQty(c.gems)} Gems`;
  if (c.tickets > 0) return `${formatQty(c.tickets)} Tickets`;
  return '';
}

// Every active code must describe its reward and carry a tier. This blocks the
// regression where codes fell back to a blanket gems:300 default.
const undescribed = active.filter(c => !formatReward(c));
if (undescribed.length) {
  throw new Error('active codes missing a reward: ' + undescribed.map(c => c.code).join(', '));
}
const untiered = active.filter(c => c.tier !== 'HIGH' && c.tier !== 'MEDIUM');
if (untiered.length) {
  throw new Error('active codes missing a tier (HIGH|MEDIUM): ' + untiered.map(c => c.code).join(', '));
}

// A gem-only code is legitimate, but an *unreviewed* one is how the old gems:300
// placeholder hid. List them on every build so each is a deliberate choice.
const gemOnly = active.filter(c => c.gems > 0 && !c.reward && !(Array.isArray(c.rewards) && c.rewards.length));
if (gemOnly.length) {
  console.log(`Note: ${gemOnly.length} active codes are gem-only (no item reward) — confirm each is intended: ` +
    gemOnly.map(c => `${c.code}(${c.gems})`).join(', '));
}

function codeTableRow(c) {
  const tierClass = c.tier === 'HIGH' ? ' gem-text--code' : '';
  return `<tr class="border-b border-white/5"><td class="p-2 gem-text--code font-mono font-bold">${c.code}</td><td class="p-2">${formatReward(c)}</td><td class="p-2${tierClass}">${c.tier}</td></tr>`;
}

const codeTableRows = active.map(codeTableRow).join('\n');

// Generate promo-codes.js — only active codes in the bundle.
// The runtime reward modal reads `reward` (singular); derive it for entries modelled
// with `rewards[]` so codes.json stays structured without a second hand-written string.
const activeForBundle = active.map(c => {
  if (c.reward || !Array.isArray(c.rewards) || !c.rewards.length) return c;
  return Object.assign({}, c, { reward: formatReward(c) });
});
const jsContent = 'window.__PROMO_CODES=' + JSON.stringify(activeForBundle, null, 2) + ';';
fs.writeFileSync(jsOutputPath, jsContent, 'utf8');
console.log(`Wrote ${activeCount} active codes to data/generated/promo-codes.js`);

// Date formatting from codes.json updated field
const d = new Date(updated + 'T00:00:00Z');
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const month = months[d.getUTCMonth()];
const day = d.getUTCDate();
const year = d.getUTCFullYear();
const formattedDate = `${month} ${day}, ${year}`;
let seoDate = d;
if (typeof seoMonth === 'string' && /^\d{4}-\d{2}$/.test(seoMonth)) {
  const parsed = new Date(seoMonth + '-01T00:00:00Z');
  if (!isNaN(parsed.getTime())) seoDate = parsed;
}
const monthYear = `${months[seoDate.getUTCMonth()]} ${seoDate.getUTCFullYear()}`;
// The snippet carries the literal portal domain: the growing "code redeem" query
// cluster and the portal-navigational queries both rank this page and convert on
// seeing the exact redeem address, not on the word "portal".
const guideDescription = `${activeCount} active Invincible GTG codes for the mobile game: gem and hero rewards, plus redeem steps for redeem.invincible.ubisoft.barcelona. Updated ${monthYear}.`;
const guideOgDescription = `Find ${activeCount} active Invincible GTG codes, rewards, and redeem steps for the official Ubisoft Barcelona portal. Copy and redeem them today.`;
const guideTwitterDescription = `Invincible GTG: ${activeCount} active codes, gem and hero rewards, plus how to redeem at redeem.invincible.ubisoft.barcelona.`;

// Read guide page
let html = fs.readFileSync(codeGuidePath, 'utf8');
const guideEol = html.includes('\r\n') ? '\r\n' : '\n';

const replacements = [
  // GUIDE_DESC
  [/<!--GUIDE_DESC_START-->[\s\S]*?<!--GUIDE_DESC_END-->/,
    `<!--GUIDE_DESC_START-->\n    <meta name="description" content="${guideDescription}">\n<!--GUIDE_DESC_END-->`],

  // GUIDE_OG_DESC
  [/<!--GUIDE_OG_DESC_START-->[\s\S]*?<!--GUIDE_OG_DESC_END-->/,
    `<!--GUIDE_OG_DESC_START-->\n    <meta property="og:description" content="${guideOgDescription}">\n<!--GUIDE_OG_DESC_END-->`],

  // GUIDE_OG_IMAGE_ALT
  [/<!--GUIDE_OG_IMAGE_ALT_START-->[\s\S]*?<!--GUIDE_OG_IMAGE_ALT_END-->/,
    `<!--GUIDE_OG_IMAGE_ALT_START-->\n    <meta property="og:image:alt" content="New Invincible GTG Codes — Active Promo Codes">\n<!--GUIDE_OG_IMAGE_ALT_END-->`],

  // GUIDE_TWITTER_DESC
  [/<!--GUIDE_TWITTER_DESC_START-->[\s\S]*?<!--GUIDE_TWITTER_DESC_END-->/,
    `<!--GUIDE_TWITTER_DESC_START-->\n    <meta name="twitter:description" content="${guideTwitterDescription}">\n<!--GUIDE_TWITTER_DESC_END-->`],

  // GUIDE_DATE_META
  [/<!--GUIDE_DATE_META_START-->[\s\S]*?<!--GUIDE_DATE_META_END-->/,
    `<!--GUIDE_DATE_META_START-->\n    <meta name="date" content="${updated}">\n<!--GUIDE_DATE_META_END-->`],

  // GUIDE_ARTICLE_MODIFIED
  [/<!--GUIDE_ARTICLE_MODIFIED_START-->[\s\S]*?<!--GUIDE_ARTICLE_MODIFIED_END-->/,
    `<!--GUIDE_ARTICLE_MODIFIED_START-->\n    <meta property="article:modified_time" content="${updated}T00:00:00Z">\n<!--GUIDE_ARTICLE_MODIFIED_END-->`],

  // GUIDE_LD_DESC (JSON-LD)
  [/^([ \t]*)"description": "(?:Find active Invincible Guarding the Globe promo codes, codes, and reward codes\. \d+ active promo codes with gems, hero shards & tickets\.|New Invincible Guarding the Globe promo codes — \d+ active codes with gems, hero shards & tickets\. Tap to copy and redeem at the Ubisoft portal\.|__GUIDE_LD_DESC__)",$/m,
    `          "description": "New Invincible Guarding the Globe promo codes — ${activeCount} active codes with gems, hero shards & tickets. Tap to copy and redeem at the Ubisoft portal.",`],

  // Share button titles \u2014 count
  [/\d+ active Invincible Guarding the Globe promo codes \\u2014 tap to copy and redeem\./g,
    `${activeCount} active Invincible Guarding the Globe promo codes \\u2014 tap to copy and redeem.`],
  [/Invincible Guarding the Globe Promo Codes \\u2014 \d+ active \[[A-Z][a-z]{2} \d{4}\]/g,
    `Invincible Guarding the Globe Promo Codes \\u2014 ${activeCount} active [${monthYear}]`],

  // Share button dates \u2014 source-driven from monthYear
  [/Updated [A-Z][a-z]{2} \d{4}\./g, `Updated ${monthYear}.`],

  // GUIDE_TAB
  [/<!--GUIDE_TAB_START-->[\s\S]*?<!--GUIDE_TAB_END-->/,
   `<!--GUIDE_TAB_START-->\n            <span class="gem-card__tab gem-card__tab--code">${activeCount} ACTIVE</span>\n<!--GUIDE_TAB_END-->`],

  // GUIDE_UPDATED
  [/<!--GUIDE_UPDATED_START-->[\s\S]*?<!--GUIDE_UPDATED_END-->/,
   `<!--GUIDE_UPDATED_START-->\nLast updated: <time datetime="${updated}">${formattedDate}</time>\n<!--GUIDE_UPDATED_END-->`],

  // GUIDE_CODES_ACTIVE
  [/<!--GUIDE_CODES_ACTIVE_START-->[\s\S]*?<!--GUIDE_CODES_ACTIVE_END-->/,
   `<!--GUIDE_CODES_ACTIVE_START-->\n${activeChips}\n<!--GUIDE_CODES_ACTIVE_END-->`],

  // GUIDE_CODES_TABLE
  [/<!--GUIDE_CODES_TABLE_START-->[\s\S]*?<!--GUIDE_CODES_TABLE_END-->/,
   `<!--GUIDE_CODES_TABLE_START-->\n${codeTableRows}\n<!--GUIDE_CODES_TABLE_END-->`],

  // GUIDE_CODES_EXPIRED
  [/<!--GUIDE_CODES_EXPIRED_START-->[\s\S]*?<!--GUIDE_CODES_EXPIRED_END-->/,
   `<!--GUIDE_CODES_EXPIRED_START-->\n${expiredChips}\n<!--GUIDE_CODES_EXPIRED_END-->`],

  // Expired section heading — kept in sync so adding archive codes cannot leave a stale number
  [/EXPIRED CODES \(\d+\)/g, `EXPIRED CODES (${expired.length})`],

  // Title, og:title, twitter:title — replace with new "GTG" format
  // Match an optional existing "New " prefix (consume it, don't block) so the [Month Year] still refreshes
  [/(?:\bNew\s+)?(Invincible Guarding the Globe|Invincible GTG).*?— .*?\[[A-Z][a-z]{2} \d{4}\]/g, `Invincible GTG Codes & Redeem Portal — Active [${monthYear}]`],

  // JSON-LD headline — same pattern as title
  [/("headline": "(?:\bNew\s+)?Invincible).*?— .*?\[[A-Z][a-z]{2} \d{4}("\s*,\n)/g, `"headline": "New Invincible GTG Codes — All Active [${monthYear}]"$2`],

  // JSON-LD dateModified
  [/<!--GUIDE_LD_DATEMODIFIED_START-->[^]*?<!--GUIDE_LD_DATEMODIFIED_END-->|^([ ]*)"dateModified": "[^"]*"/m,
    (match, indent) => match.startsWith('<!--')
      ? '<!--GUIDE_LD_DATEMODIFIED_START-->' + String.fromCharCode(10) + '          "dateModified": "' + updatedIso + '"' + String.fromCharCode(10) + '<!--GUIDE_LD_DATEMODIFIED_END-->'
      : (indent || '') + '"dateModified": "' + updatedIso + '"'],

  // Subtitle: "N Active Promo Codes — Tap, Copy, Redeem"
  [/\d+ Active Promo Codes — Tap, Copy, Redeem/g, `${activeCount} Active Promo Codes — Tap, Copy, Redeem`],
  [/\d+ Active Codes — Tap, Copy, Redeem/g, `${activeCount} Active Promo Codes — Tap, Copy, Redeem`],

  // Card subtitle: "N active codes + M expired"
  [/\d+ active codes \+ \d+ expired/g, `${activeCount} active codes + ${expiredCount} expired`],

  // Body: "All N active Invincible Guarding the Globe codes"
  [/All \d+ active Invincible Guarding the Globe codes/g, `All ${activeCount} active Invincible Guarding the Globe codes`],

  // Body: "With N active codes available"
  [/With \d+ active codes available/g, `With ${activeCount} active codes available`],

  // Body: "the N codes listed above"
  [/the \d+ codes listed above/g, `the ${activeCount} codes listed above`],

  // Body: "N codes listed above"
  [/\d+ codes listed above/g, `${activeCount} codes listed above`],
];

for (const [pattern, replacement] of replacements) {
  html = html.replace(pattern, replacement);
}

const codeBylineDateMatches = html.match(/Updated <time datetime="[^"]*">[^<]*<\/time>/g) || [];
if (codeBylineDateMatches.length !== 1) throw new Error('code guide byline date expected exactly once');
html = html.replace(/Updated <time datetime="[^"]*">[^<]*<\/time>/, `Updated <time datetime="${updated}">${formattedDate}</time>`);
html = html.replace(/<span class="mx-2 opacity-30">·<\/span>\s*<span class="gem-text--code">64,147\+ impressions<\/span>/, '');
html = html.replace(/(Updated <time datetime="[^"]*">[^<]*<\/time>)[ \t]*\r?\n[ \t]*\r?\n([ \t]*<\/p>)/, '$1\n$2');
html = html.replace(/(Updated <time datetime="[^"]*">[^<]*<\/time>)[ \t]*\r?\n[ \t]*\r?\n([ \t]*<\/p>)/, '$1\n$2');

// Assert freshness markers occurred exactly once
const freshnessMarkers = [
  'GUIDE_DATE_META', 'GUIDE_ARTICLE_MODIFIED'
];
for (const m of freshnessMarkers) {
  const count = (html.match(new RegExp(`<!--${m}_START-->`, 'g')) || []).length;
  if (count !== 1) throw new Error(`${m} marker expected 1 occurrence, found ${count}`);
}

const expiredHeading = html.match(/EXPIRED CODES \((\d+)\)/g) || [];
if (expiredHeading.length !== 1 || expiredHeading[0] !== `EXPIRED CODES (${expired.length})`) {
  throw new Error(`expired heading count expected once as ${expired.length}, found ${expiredHeading.join(', ') || 'none'}`);
}

const ldDateMarkerCount = (html.match(/<!--GUIDE_LD_DATEMODIFIED_START-->/g) || []).length;
const ldDateValueCount = (html.match(/^[ ]*"dateModified": "[^"]*"/gm) || []).length;
if (ldDateMarkerCount > 1 || ldDateValueCount !== 1) {
  throw new Error('dateModified expected one JSON-LD value and at most one marker');
}

// Normalize line endings back to original style
if (guideEol === '\r\n') html = html.replace(/(?<!\r)\n/g, '\r\n');
fs.writeFileSync(codeGuidePath, html, 'utf8');
console.log(`Updated guide/code/index.html — ${activeCount} active, ${expiredCount} expired, ${monthYear}`);

// Keep the shared FAQ answer and its structured data aligned with the code source.
let faqHtml = fs.readFileSync(faqGuidePath, 'utf8');
const faqCountMatches = faqHtml.match(/\b\d+ active promo codes\b/g) || [];
if (faqCountMatches.length !== 2) throw new Error(`FAQ active-code count expected twice, found ${faqCountMatches.length}`);
faqHtml = faqHtml.replace(/\b\d+ active promo codes\b/g, `${activeCount} active promo codes`);
faqHtml = faqHtml.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="Quick answers on weekly gems, ${activeCount} active codes, PvP payouts, login rewards, and official redemption steps.">`);
faqHtml = faqHtml.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="Quick answers on weekly gems, ${activeCount} active codes, PvP payouts, login rewards, and official redemption steps.">`);
faqHtml = faqHtml.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="Quick answers on weekly gems, ${activeCount} active codes, PvP payouts, login rewards, and official redemption steps.">`);
faqHtml = faqHtml.replace(/<meta name="date" content="[^"]*">/, `<meta name="date" content="${updated}">`);
faqHtml = faqHtml.replace(/<meta property="article:modified_time" content="[^"]*">/, `<meta property="article:modified_time" content="${updated}T00:00:00Z">`);
const faqLdDateMatches = faqHtml.match(/"dateModified": "[^"]*"/g) || [];
if (faqLdDateMatches.length !== 1) throw new Error(`FAQ JSON-LD dateModified expected once, found ${faqLdDateMatches.length}`);
faqHtml = faqHtml.replace(/"dateModified": "[^"]*"/, `"dateModified": "${updatedIso}"`);
const faqBylineMatches = faqHtml.match(/Updated <time datetime="[^"]*">[^<]*<\/time>/g) || [];
if (faqBylineMatches.length !== 1) throw new Error(`FAQ byline date expected once, found ${faqBylineMatches.length}`);
faqHtml = faqHtml.replace(/Updated <time datetime="[^"]*">[^<]*<\/time>/, `Updated <time datetime="${updated}">${formattedDate}</time>`);
fs.writeFileSync(faqGuidePath, faqHtml, 'utf8');
console.log(`Updated guide/faq/index.html — ${activeCount} active codes, ${formattedDate}`);

// Code updates change the homepage, code guide, and FAQ content.
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
const refreshedUrls = new Set([
  'https://anomaly-alpha.github.io/',
  'https://anomaly-alpha.github.io/guide/code/',
  'https://anomaly-alpha.github.io/guide/faq/',
]);
let refreshedUrlCount = 0;
sitemap = sitemap.replace(/<url>[\s\S]*?<\/url>/g, block => {
  const location = block.match(/<loc>([^<]+)<\/loc>/);
  if (!location || !refreshedUrls.has(location[1])) return block;
  const lastmodMatches = block.match(/<lastmod>[^<]*<\/lastmod>/g) || [];
  if (lastmodMatches.length !== 1) throw new Error('sitemap entry must have exactly one lastmod for ' + location[1]);
  refreshedUrlCount++;
  return block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${updated}</lastmod>`);
});
if (refreshedUrlCount !== refreshedUrls.size) throw new Error('expected to refresh three sitemap URLs; found ' + refreshedUrlCount);
fs.writeFileSync(sitemapPath, sitemap, 'utf8');

// Update inline promo codes in index.html
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const indexEol = indexHtml.includes('\r\n') ? '\r\n' : '\n';
const inlineCodes = 'window.__PROMO_CODES=' + JSON.stringify(activeForBundle) + ';';
indexHtml = indexHtml.replace(
  /<!--PROMO_CODES_INLINE_START-->[\s\S]*?<!--PROMO_CODES_INLINE_END-->/,
  `<!--PROMO_CODES_INLINE_START-->\n    <script>${inlineCodes}</script>\n    <!--PROMO_CODES_INLINE_END-->`
);
indexHtml = indexHtml.replace(
  /^([ \t]*)"description": "\d+ active Invincible Guarding the Globe promo codes",[ \t]*\r?\n[ \t]*"numberOfItems": \d+,/m,
  `          "description": "${activeCount} active Invincible Guarding the Globe promo codes",\n          "numberOfItems": ${activeCount},`
);
indexHtml = indexHtml.replace(
  /(?:            \{ "@type": "ListItem", "position": \d+, "item": \{ "@type": "Code", "name": "[^"]+" \} \},?\r?\n?)+/,
  activeCodeItems
);
indexHtml = indexHtml.replace(
  /(<span class="gem-ticker__label">Codes<\/span> )\d+ active/g,
  `$1${activeCount} active`
);
// The homepage JSON-LD dateModified tracks the same refresh; without this it can lag the
// code dates the page itself renders.
const indexPathDateMatches = indexHtml.match(/"dateModified": "[^"]*"/g) || [];
if (indexPathDateMatches.length !== 1) throw new Error(`index.html JSON-LD dateModified expected once, found ${indexPathDateMatches.length}`);
indexHtml = indexHtml.replace(/"dateModified": "[^"]*"/, `"dateModified": "${updatedIso}"`);
// Normalize line endings back to original style
if (indexEol === '\r\n') indexHtml = indexHtml.replace(/(?<!\r)\n/g, '\r\n');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log(`Updated index.html inline promo codes — ${activeCount} active`);

// The [Mon YYYY] token in titles, social cards, and JSON-LD headlines is a freshness claim.
// Only the code and FAQ pages used to rewrite it, so every other page kept claiming whatever
// month it was last hand-edited. Sync them all from the same seoMonth source.
const monthTokenPages = [
  indexPath,
  codeGuidePath,
  faqGuidePath,
  path.join(rootDir, 'guide', 'beginners', 'index.html'),
  path.join(rootDir, 'guide', 'creators', 'index.html'),
  path.join(rootDir, 'guide', 'event', 'index.html'),
  path.join(rootDir, 'guide', 'login', 'index.html'),
  path.join(rootDir, 'guide', 'pvp', 'index.html'),
  path.join(rootDir, 'guide', 'redeem', 'index.html'),
  path.join(rootDir, 'guide', 'wish-event', 'index.html'),
  path.join(rootDir, 'guide', 'xp', 'index.html')
];
const monthTokenPattern = /\[(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\]/g;
let monthTokenTotal = 0;
for (const pagePath of monthTokenPages) {
  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const pageTokens = pageSource.match(monthTokenPattern) || [];
  if (pageTokens.length === 0) {
    throw new Error(`month token missing in ${path.relative(rootDir, pagePath)}; add one or drop the page from monthTokenPages`);
  }
  const pageSynced = pageSource.replace(monthTokenPattern, `[${monthYear}]`);
  if (pageSynced !== pageSource) fs.writeFileSync(pagePath, pageSynced, 'utf8');
  monthTokenTotal += pageTokens.length;
}
console.log(`Synced [${monthYear}] across ${monthTokenPages.length} pages (${monthTokenTotal} tokens)`);
console.log(`Updated guide/code/index.html — ${activeCount} active, ${expiredCount} expired, ${monthYear}`);
