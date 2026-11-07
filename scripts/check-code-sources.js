// Diffs the publisher's own patch notes against data/codes.json.
//
// The Ubisoft help centre publishes one article per game update and each ends with a
// "Reward Code: XXX" line, so it is the authoritative source for both the code and the
// day it shipped. Nothing else in scripts/ polls it, which is why the site has been
// listing new codes 3-4 days late. Run it before shipping a release; exit code 1 means
// the tracked data disagrees with the publisher.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const codesPath = path.join(rootDir, 'data', 'codes.json');

const SECTION_URL =
  'https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/section/493-patch-notes';
const ARTICLE_BASE =
  'https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/';
const ACTIONABLE_DAYS = 120;
const MAX_RECENT = 6;

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(year, month, day) {
  if (!month || day < 1 || day > 31) return null;
  const yyyy = String(year).length === 2 ? 2000 + year : year;
  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Slugs come in two shapes: "patch-notes-game-update-3-7-20-oct-2026" and
// "patch-notes-version-2-10-07-10-25", so month names are tried before numbers.
function dateFromSlug(slug) {
  let m = slug.match(/(\d{1,2})-([a-z]{3})-(\d{4})$/);
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

async function harvest() {
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

function main() {
  const data = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  const tracked = new Map(data.codes.map((c) => [c.code.toUpperCase(), c]));

  return harvest().then((articles) => {
    const failures = articles.filter((a) => a.error);
    const withCode = articles.filter((a) => a.code).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const undated = withCode.filter((a) => !a.date);

    const dateDrift = [];
    const statusDrift = [];
    const missing = [];
    const matched = [];

    for (const article of withCode) {
      const record = tracked.get(article.code);
      if (!record) {
        missing.push(article);
        continue;
      }
      if (record.expired && article.date && daysSince(article.date) <= ACTIONABLE_DAYS) {
        statusDrift.push(article);
      }
      if (article.date && String(record.dateAdded || '') !== article.date) {
        dateDrift.push({ article, record });
      } else {
        matched.push(article);
      }
    }

    const actionableMissing = missing.filter((a) => a.date && daysSince(a.date) <= ACTIONABLE_DAYS);
    const archivedMissing = missing.filter((a) => !a.date || daysSince(a.date) > ACTIONABLE_DAYS);
    const activeDrift = dateDrift.filter((d) => !d.record.expired);

    console.log(`patch notes scanned: ${articles.length}`);
    console.log(`  carrying a reward code: ${withCode.length}`);
    console.log(`  date matches data/codes.json: ${matched.length}`);
    console.log(`  fetch failures: ${failures.length}`);
    if (failures.length) failures.forEach((f) => console.log(`    ${f.slug}: ${f.error}`));

    if (activeDrift.length) {
      console.log(`\nACTIVE CODES WITH A WRONG dateAdded (${activeDrift.length})`);
      activeDrift.forEach(({ article, record }) =>
        console.log(`  ${article.code.padEnd(8)} publisher ${article.date}  site ${record.dateAdded || '(none)'}  update ${article.version}`));
    }

    const expiredDrift = dateDrift.filter((d) => d.record.expired);
    if (expiredDrift.length) {
      console.log(`\nEXPIRED CODES WITH A WRONG dateAdded (${expiredDrift.length}, archive accuracy only)`);
      expiredDrift.forEach(({ article, record }) =>
        console.log(`  ${article.code.padEnd(8)} publisher ${article.date}  site ${record.dateAdded || '(none)'}  update ${article.version}`));
    }

    if (statusDrift.length) {
      console.log(`\nMARKED EXPIRED BUT PUBLISHED RECENTLY (${statusDrift.length})`);
      statusDrift.forEach((a) => console.log(`  ${a.code} shipped ${a.date} (update ${a.version}) - ${a.url}`));
    }

    if (actionableMissing.length) {
      console.log(`\nMISSING FROM data/codes.json (${actionableMissing.length}, shipped within ${ACTIONABLE_DAYS} days)`);
      actionableMissing.forEach((a) => console.log(`  ${a.code} shipped ${a.date} (update ${a.version}) - ${a.url}`));
    }

    if (archivedMissing.length) {
      console.log(`\nnot tracked, historical: ${archivedMissing.map((a) => a.code).join(', ')}`);
    }

    if (undated.length) {
      console.log(`\nno publisher date parsed: ${undated.map((a) => a.slug).join(', ')}`);
    }

    const newest = withCode.slice(0, MAX_RECENT).map((a) => `${a.code}@${a.date}`);
    console.log(`\nnewest from the publisher: ${newest.join(', ')}`);

    const blocking = activeDrift.length + actionableMissing.length + statusDrift.length + failures.length;
    if (blocking) {
      console.log(`\nFAIL - ${blocking} item(s) disagree with the publisher.`);
      process.exit(1);
    }
    console.log('\nOK - data/codes.json agrees with every patch note that carries a code.');
  });
}

main().catch((error) => {
  console.error(`check-code-sources failed: ${error.message}`);
  process.exit(1);
});
