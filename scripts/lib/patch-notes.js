// Shared harvest of the publisher's patch notes.
//
// The Ubisoft help centre publishes one article per game update and each ends with a
// "Reward Code: XXX" line. The slug carries the release date, which is the only date
// the site is allowed to publish: aggregator "added" columns lag by days and have
// caused fresh codes to be listed as historical.

const SECTION_URL =
  'https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/section/493-patch-notes';
const ARTICLE_BASE =
  'https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/';

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(year, month, day) {
  if (!month || day < 1 || day > 31) return null;
  const yyyy = String(year).length === 2 ? 2000 + year : year;
  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Slugs come in two shapes: "patch-notes-game-update-3-8-18-nov-26" and
// "patch-notes-version-2-10-07-10-25", so month names are tried before numbers.
// The year is two or four digits — "18-nov-26" is a real publisher slug, and a
// four-digit-only pattern silently turned fresh codes into "historical" ones.
function dateFromSlug(slug) {
  let m = slug.match(/(\d{1,2})-([a-z]{3})-(\d{2,4})$/);
  if (m && MONTHS[m[2]]) return isoDate(Number(m[3]), MONTHS[m[2]], Number(m[1]));
  m = slug.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function versionFromSlug(slug) {
  const m = slug.match(/update-(\d+-\d+)/) || slug.match(/version-(\d+-\d+)/) || slug.match(/(\d+)-\d+-hotfix/);
  if (!m) return slug.replace(/^patch-notes-?/, '') || 'unversioned';
  return m[1].replace('-', '.');
}

async function getText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'anomaly-alpha code-check (+https://anomaly-alpha.github.io/)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function harvestPatchNotes() {
  const index = await getText(SECTION_URL);
  const seen = new Set();
  const targets = [];
  for (const m of index.matchAll(/faq\/(\d+)-(patch-notes-[a-z0-9-]+)/g)) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ id: m[1], slug: m[2], url: `${ARTICLE_BASE}${m[1]}-${m[2]}/` });
  }

  const found = [];
  const queue = [...targets];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const target = queue.shift();
      let html;
      try {
        html = await getText(target.url);
      } catch (error) {
        found.push({ ...target, error: error.message });
        continue;
      }
      const codeMatch = html.match(/Reward\s*Code:\s*([A-Za-z0-9]+)/i);
      found.push({
        ...target,
        code: codeMatch ? codeMatch[1].toUpperCase() : null,
        date: dateFromSlug(target.slug),
        version: versionFromSlug(target.slug),
      });
    }
  });
  await Promise.all(workers);
  return found;
}

function daysSince(iso) {
  return Math.floor((Date.now() - new Date(`${iso}T00:00:00Z`).getTime()) / 86400000);
}

module.exports = {
  SECTION_URL,
  ARTICLE_BASE,
  dateFromSlug,
  versionFromSlug,
  getText,
  harvestPatchNotes,
  daysSince,
};
