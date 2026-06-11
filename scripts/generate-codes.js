const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const codesPath = path.join(rootDir, 'data', 'codes.json');
const jsOutputPath = path.join(rootDir, 'data', 'generated', 'promo-codes.js');
const codeGuidePath = path.join(rootDir, 'guide', 'code', 'index.html');

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

// Generate promo-codes.js — only active codes in the bundle
const jsContent = 'window.__PROMO_CODES=' + JSON.stringify(active, null, 2) + ';';
fs.writeFileSync(jsOutputPath, jsContent, 'utf8');
console.log(`Wrote ${activeCount} active codes to data/generated/promo-codes.js`);

// Build code chips
function activeChip(c) {
  return `<span class="gem-code__chip gem-text--code text-sm font-bold tracking-widest bg-white/5 px-3 py-1.5 rounded border border-white/10 cursor-pointer" onclick="event.stopPropagation();copyCode('${c.code}',this)">${c.code}</span>`;
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

// Read guide page
let html = fs.readFileSync(codeGuidePath, 'utf8');

const replacements = [
  // GUIDE_DESC
  [/<!--GUIDE_DESC_START-->[\s\S]*?<!--GUIDE_DESC_END-->/,
    `<!--GUIDE_DESC_START-->\n    <meta name="description" content="See all ${activeCount} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for ${monthYear}.">\n<!--GUIDE_DESC_END-->`],

  // GUIDE_OG_DESC
  [/<!--GUIDE_OG_DESC_START-->[\s\S]*?<!--GUIDE_OG_DESC_END-->/,
    `<!--GUIDE_OG_DESC_START-->\n    <meta property="og:description" content="See all ${activeCount} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for ${monthYear}.">\n<!--GUIDE_OG_DESC_END-->`],

  // GUIDE_OG_IMAGE_ALT
  [/<!--GUIDE_OG_IMAGE_ALT_START-->[\s\S]*?<!--GUIDE_OG_IMAGE_ALT_END-->/,
    `<!--GUIDE_OG_IMAGE_ALT_START-->\n    <meta property="og:image:alt" content="Codes Guide — ${activeCount} ACTIVE PROMO CODES">\n<!--GUIDE_OG_IMAGE_ALT_END-->`],

  // GUIDE_TWITTER_DESC
  [/<!--GUIDE_TWITTER_DESC_START-->[\s\S]*?<!--GUIDE_TWITTER_DESC_END-->/,
    `<!--GUIDE_TWITTER_DESC_START-->\n    <meta name="twitter:description" content="See all ${activeCount} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for ${monthYear}.">\n<!--GUIDE_TWITTER_DESC_END-->`],

  // GUIDE_ARTICLE_MODIFIED
  [/<!--GUIDE_ARTICLE_MODIFIED_START-->[\s\S]*?<!--GUIDE_ARTICLE_MODIFIED_END-->/,
    `<!--GUIDE_ARTICLE_MODIFIED_START-->\n    <meta property="article:modified_time" content="${updated}T00:00:00Z">\n<!--GUIDE_ARTICLE_MODIFIED_END-->`],

  // GUIDE_LD_DESC (JSON-LD)
  [/"description": "__GUIDE_LD_DESC__",/,
    `          "description": "Find active Invincible Guarding the Globe promo codes, codes, and reward codes. ${activeCount} active promo codes with gems, hero shards & tickets.",`],

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

  // Title, og:title, twitter:title: "Promo Codes — 25 Active [Jun 2026]"
  [/(Invincible Guarding the Globe) Codes & Gems — \d+ Codes \[[A-Z][a-z]{2} \d{4}(\])/g, `$1 Promo Codes — ${activeCount} Active [${monthYear}$2`],

  // JSON-LD headline: same format as title
  [/("headline": "Invincible Guarding the Globe) Codes & Gems — \d+ Codes \[[A-Z][a-z]{2} \d{4}("\s*,\n)/g, `$1 Promo Codes — ${activeCount} Active [${monthYear}$2`],

  // JSON-LD dateModified
  [/(dateModified": ")\d{4}-\d{2}-\d{2}(")/, `$1${updated}$2`],

  // Subtitle: "27 Active Promo Codes — Tap, Copy, Redeem"
  [/\d+ Active Promo Codes — Tap, Copy, Redeem/g, `${activeCount} Active Promo Codes — Tap, Copy, Redeem`],
  [/\d+ Active Codes — Tap, Copy, Redeem/g, `${activeCount} Active Promo Codes — Tap, Copy, Redeem`],

  // Card subtitle: "27 active codes + 8 expired"
  [/\d+ active codes \+ \d+ expired/g, `${activeCount} active codes + ${expiredCount} expired`],

  // Body: "All 27 active Invincible Guarding the Globe codes"
  [/All \d+ active Invincible Guarding the Globe codes/g, `All ${activeCount} active Invincible Guarding the Globe codes`],

  // Body: "With 27 active codes available"
  [/With \d+ active codes available/g, `With ${activeCount} active codes available`],

  // Body: "the 27 codes listed above"
  [/the \d+ codes listed above/g, `the ${activeCount} codes listed above`],

  // Body: "27 codes listed above"
  [/\d+ codes listed above/g, `${activeCount} codes listed above`],
];

for (const [pattern, replacement] of replacements) {
  html = html.replace(pattern, replacement);
}

fs.writeFileSync(codeGuidePath, html, 'utf8');
console.log(`Updated guide/code/index.html — ${activeCount} active, ${expiredCount} expired, ${monthYear}`);
