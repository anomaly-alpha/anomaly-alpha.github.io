// Diffs the publisher's own patch notes against data/codes.json.
//
// The Ubisoft help centre publishes one article per game update and each ends with a
// "Reward Code: XXX" line, so it is the authoritative source for both the code and the
// day it shipped. Nothing else in scripts/ polls it, which is why the site has been
// listing new codes 3-4 days late. Run it before shipping a release; exit code 1 means
// the tracked data disagrees with the publisher.

const fs = require('fs');
const path = require('path');
const { harvestPatchNotes, daysSince } = require('./lib/patch-notes');

const rootDir = path.resolve(__dirname, '..');
const codesPath = path.join(rootDir, 'data', 'codes.json');

const ACTIONABLE_DAYS = 120;
const MAX_RECENT = 6;

function main() {
  const data = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  const tracked = new Map(data.codes.map((c) => [c.code.toUpperCase(), c]));

  return harvestPatchNotes().then((articles) => {
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
