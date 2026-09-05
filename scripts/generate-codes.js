const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const codesPath = path.join(rootDir, 'data', 'codes.json');
const jsOutputPath = path.join(rootDir, 'data', 'generated', 'promo-codes.js');
const codeGuidePath = path.join(rootDir, 'guide', 'code', 'index.html');
const indexPath = path.join(rootDir, 'index.html');

const { codes, updated } = JSON.parse(fs.readFileSync(codesPath, 'utf8'));

const active = codes.filter(c => !c.expired);
const expired = codes.filter(c => c.expired);

active.sort((a, b) => {
  const aDate = a.dateAdded ? new Date(a.dateAdded) : new Date(0);
  const bDate = b.dateAdded ? new Date(b.dateAdded) : new Date(0);
  return bDate - aDate;
});
expired.sort((a, b) => new Date(b.expiredDate) - new Date(a.expiredDate));

const activeCount = active.length;
const expiredCount = expired.length;
const activeCodeItems = active.slice(0, 3).map((c, index) =>
  `            { "@type": "ListItem", "position": ${index + 1}, "item": { "@type": "Code", "name": "${c.code}" } }`
).join(',\n');

// Generate promo-codes.js — only active codes in the bundle
const jsContent = 'window.__PROMO_CODES=' + JSON.stringify(active, null, 2) + ';';
fs.writeFileSync(jsOutputPath, jsContent, 'utf8');
console.log(`Wrote ${activeCount} active codes to data/generated/promo-codes.js`);

// Build code chips
function activeChip(c) {
  const daysOld = Math.floor((new Date() - new Date(c.dateAdded + 'T00:00:00Z')) / (1000 * 60 * 60 * 24));
  const badge = daysOld < 7 ? '<span class="gem-code--badge gem-code--badge--new">NEW</span>' : daysOld < 14 ? '<span class="gem-code--badge gem-code--badge--recent">Recent</span>' : '';
  return `<span class="gem-code__chip gem-text--code text-sm font-bold tracking-widest bg-white/5 px-3 py-1.5 rounded border border-white/10 cursor-pointer" onclick="event.stopPropagation();copyCode('${c.code}',this)">${c.code}${badge}</span>`;
}

function expiredChip(c) {
  return `<span class="text-sm font-bold tracking-widest bg-red-950/40 px-3 py-1.5 rounded border border-red-500/30 text-red-400">${c.code}</span>`;
}

const activeChips = active.map(activeChip).join('');
const expiredChips = expired.map(expiredChip).join('');

// Date formatting from codes.json updated field
const d = new Date(updated + 'T00:00:00Z');
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const month = months[d.getUTCMonth()];
const fullMonth = fullMonths[d.getUTCMonth()];
const day = d.getUTCDate();
const year = d.getUTCFullYear();
const formattedDate = `${month} ${day}, ${year}`;
const monthYear = `${month} ${year}`;
const guideDescription = `${activeCount} active Invincible GTG codes with gem and hero rewards. Redeem codes at the official Ubisoft Barcelona portal. Updated ${monthYear}.`;
const guideOgDescription = `Find ${activeCount} active Invincible GTG codes, rewards, and the official Ubisoft Barcelona redemption portal. Copy and redeem them today.`;
const guideTwitterDescription = `Invincible GTG: ${activeCount} active codes, gem and hero rewards, plus the Ubisoft Barcelona redemption portal. Copy and redeem now.`;

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

  // GUIDE_CODES_EXPIRED
  [/<!--GUIDE_CODES_EXPIRED_START-->[\s\S]*?<!--GUIDE_CODES_EXPIRED_END-->/,
   `<!--GUIDE_CODES_EXPIRED_START-->\n${expiredChips}\n<!--GUIDE_CODES_EXPIRED_END-->`],

  // Title, og:title, twitter:title — replace with new "GTG" format
  // Match an optional existing "New " prefix (consume it, don't block) so the [Month Year] still refreshes
  [/(?:\bNew\s+)?(Invincible Guarding the Globe|Invincible GTG).*?— .*?\[[A-Z][a-z]{2} \d{4}\]/g, `Invincible GTG Codes & Redeem Portal — Active [${monthYear}]`],

  // JSON-LD headline — same pattern as title
  [/("headline": "(?:\bNew\s+)?Invincible).*?— .*?\[[A-Z][a-z]{2} \d{4}("\s*,\n)/g, `"headline": "New Invincible GTG Codes — All Active [${monthYear}]"$2`],

  // JSON-LD dateModified
  [/<!--GUIDE_LD_DATEMODIFIED_START-->[\s\S]*?<!--GUIDE_LD_DATEMODIFIED_END-->/,
    `<!--GUIDE_LD_DATEMODIFIED_START-->\n          "dateModified": "${updated}"\n<!--GUIDE_LD_DATEMODIFIED_END-->`],

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

// Assert freshness markers occurred exactly once
const freshnessMarkers = [
  'GUIDE_DATE_META', 'GUIDE_ARTICLE_MODIFIED', 'GUIDE_LD_DATEMODIFIED'
];
for (const m of freshnessMarkers) {
  const count = (html.match(new RegExp(`<!--${m}_START-->`, 'g')) || []).length;
  if (count !== 1) throw new Error(`${m} marker expected 1 occurrence, found ${count}`);
}

// Normalize line endings back to original style
if (guideEol === '\r\n') html = html.replace(/(?<!\r)\n/g, '\r\n');
fs.writeFileSync(codeGuidePath, html, 'utf8');
console.log(`Updated guide/code/index.html — ${activeCount} active, ${expiredCount} expired, ${monthYear}`);

// Update inline promo codes in index.html
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const indexEol = indexHtml.includes('\r\n') ? '\r\n' : '\n';
const inlineCodes = 'window.__PROMO_CODES=' + JSON.stringify(active) + ';';
indexHtml = indexHtml.replace(
  /<!--PROMO_CODES_INLINE_START-->[\s\S]*?<!--PROMO_CODES_INLINE_END-->/,
  `<!--PROMO_CODES_INLINE_START-->\n    <script>${inlineCodes}</script>\n    <!--PROMO_CODES_INLINE_END-->`
);
indexHtml = indexHtml.replace(
  /^([ \t]*)"description": "\d+ active Invincible Guarding the Globe promo codes",[ \t]*\r?\n[ \t]*"numberOfItems": \d+,/m,
  `          "description": "${activeCount} active Invincible Guarding the Globe promo codes",\n          "numberOfItems": ${activeCount},`
);
indexHtml = indexHtml.replace(
  /            \{ "@type": "ListItem", "position": 1, "item": \{ "@type": "Code", "name": "[^"]+" \} \},?\r?\n            \{ "@type": "ListItem", "position": 2, "item": \{ "@type": "Code", "name": "[^"]+" \} \},?\r?\n            \{ "@type": "ListItem", "position": 3, "item": \{ "@type": "Code", "name": "[^"]+" \} \}/,
  activeCodeItems
);
indexHtml = indexHtml.replace(
  /(<span class="gem-ticker__label">Codes<\/span> )\d+ active/g,
  `$1${activeCount} active`
);
// Normalize line endings back to original style
if (indexEol === '\r\n') indexHtml = indexHtml.replace(/(?<!\r)\n/g, '\r\n');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log(`Updated index.html inline promo codes — ${activeCount} active`);
console.log(`Updated guide/code/index.html — ${activeCount} active, ${expiredCount} expired, ${monthYear}`);
