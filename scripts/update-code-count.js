const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const codeGuidePath = path.join(rootDir, 'guide', 'code', 'index.html');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeFile(p, content) {
  fs.writeFileSync(p, content, 'utf8');
}

// Extract promoCodes from index.html
const indexHtml = readFile(indexPath);
const promoCodesMatch = indexHtml.match(/"promoCodes":\s*\[(.*?)\]/s);
if (!promoCodesMatch) {
  console.error('ERROR: Could not find promoCodes array in index.html');
  process.exit(1);
}

const codesJson = '[' + promoCodesMatch[1] + ']';
let codes;
try {
  codes = JSON.parse(codesJson);
} catch (e) {
  console.error('ERROR: Failed to parse promoCodes JSON:', e.message);
  process.exit(1);
}

const activeCodes = codes.filter(c => !c.expired);
const activeCount = activeCodes.length;
const expiredCount = codes.length - activeCount;
console.log(`Found ${activeCount} active codes, ${expiredCount} expired (${codes.length} total)`);

let html = readFile(codeGuidePath);

const replacements = [
  // Tab badge: "26 ACTIVE" → "{N} ACTIVE"
  [/(\d+) ACTIVE/g, `${activeCount} ACTIVE`],

  // Title, og:title, twitter:title: "... — {N} Active Codes" → "... — {N} Active Promo Codes"
  [/Invincible Guarding the Globe Codes — \d+ Active Codes/g,
   `Invincible Guarding the Globe Codes — ${activeCount} Active Promo Codes`],

  // og:image:alt
  [/(Codes Guide — )\d+( ACTIVE CODES)/g, `$1${activeCount}$2`],

  // Subtitle text: "26 active codes + 8 expired"
  [/\d+ active codes \+ \d+ expired/g, `${activeCount} active codes + ${expiredCount} expired`],

  // Body paragraph: "With 26 active codes available"
  [/With \d+ active codes available/g, `With ${activeCount} active codes available`],

  // JSON-LD description: "... 26 active codes with ..."
  [/(Find active Invincible Guarding the Globe codes, promo codes, and reward codes\. )\d+( active codes with gems, hero shards & tickets\.)/g,
   `$1${activeCount}$2`],
];

for (const [pattern, replacement] of replacements) {
  html = html.replace(pattern, replacement);
}

// Full-string replacements for meta descriptions (need exact match to preserve surrounding text)
html = html.replace(
  /<meta name="description" content="Find all current Invincible Guarding the Globe codes, promo codes, and reward codes\. \d+ active codes — gems, tickets & hero shards — redeem via verification code at the official Ubisoft portal\."/,
  `<meta name="description" content="Find all active Invincible Guarding the Globe codes. ${activeCount} active promo codes worth gems, hero shards & tickets — redeem via verification code at the official Ubisoft portal."`
);

html = html.replace(
  /<meta property="og:description" content="Find all current Invincible Guarding the Globe codes and promo codes\. \d+ active codes with gems, hero shards & tickets — redeem via verification code at the official Ubisoft portal\."/,
  `<meta property="og:description" content="Find all active Invincible Guarding the Globe codes. ${activeCount} active promo codes worth gems, hero shards & tickets — redeem via verification code at the official Ubisoft portal."`
);

html = html.replace(
  /<meta name="twitter:description" content="Find all current Invincible Guarding the Globe codes and promo codes\."/,
  `<meta name="twitter:description" content="Find all active Invincible Guarding the Globe codes and promo codes. ${activeCount} active codes worth gems & hero shards."`
);

writeFile(codeGuidePath, html);
console.log(`Updated guide/code/index.html — all "${activeCount} active" references applied`);
