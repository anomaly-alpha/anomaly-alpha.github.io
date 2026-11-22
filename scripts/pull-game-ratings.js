#!/usr/bin/env node
// Refreshes the store ratings in data/game-ratings.json from the two authorised sources.
//
//   npm run pull-game-ratings
//
// Apple exposes a public lookup API (averageUserRating / userRatingCount), so that side is a
// documented JSON contract. Google publishes no API for Play, so the rating is read out of the
// store page payload. Reviews are left untouched: they are quoted verbatim and vetted by hand,
// and silently swapping them would change published copy. Values are never invented - if either
// store cannot be read, the script fails instead of writing a partial or guessed update.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'game-ratings.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

function round1(value) {
  return Math.round(value * 10) / 10;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchAppStore(appId, country) {
  const url = 'https://itunes.apple.com/lookup?id=' + appId + '&country=' + country;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error('App Store lookup HTTP ' + res.status);
  const json = await res.json();
  const app = (json.results || [])[0];
  if (!app) throw new Error('App Store lookup returned no result for id ' + appId);
  if (typeof app.averageUserRating !== 'number' || typeof app.userRatingCount !== 'number') {
    throw new Error('App Store lookup missing rating fields');
  }
  return {
    ratingValue: round1(app.averageUserRating),
    rawRatingValue: app.averageUserRating,
    ratingCount: app.userRatingCount,
    source: url
  };
}

async function fetchPlayStore(packageId) {
  const url = 'https://play.google.com/store/apps/details?id=' + packageId + '&hl=en_US&gl=US';
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error('Play Store HTTP ' + res.status);
  const html = await res.text();

  const ratingMatch = html.match(/"ratingValue":"([0-9.]+)"/);
  const countMatch = html.match(/"ratingCount":"([0-9]+)"/);
  if (!ratingMatch || !countMatch) {
    throw new Error('Play Store page no longer exposes ratingValue/ratingCount');
  }

  const raw = Number(ratingMatch[1]);
  const count = Number(countMatch[1]);
  if (!Number.isFinite(raw) || raw <= 0 || raw > 5) throw new Error('Play rating out of range: ' + ratingMatch[1]);
  if (!Number.isFinite(count) || count <= 0) throw new Error('Play rating count invalid: ' + countMatch[1]);

  return {
    ratingValue: round1(raw),
    rawRatingValue: raw,
    ratingCount: count,
    source: url
  };
}

function applyRating(entry, fresh) {
  const changes = [];
  if (entry.ratingValue !== fresh.ratingValue) {
    changes.push('ratingValue ' + entry.ratingValue + ' -> ' + fresh.ratingValue);
    entry.ratingValue = fresh.ratingValue;
  }
  if (entry.rawRatingValue !== fresh.rawRatingValue) {
    entry.rawRatingValue = fresh.rawRatingValue;
  }
  if (entry.ratingCount !== fresh.ratingCount) {
    changes.push('ratingCount ' + entry.ratingCount + ' -> ' + fresh.ratingCount);
    entry.ratingCount = fresh.ratingCount;
  }
  entry.retrieved = today();
  entry.source = fresh.source;
  return changes;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const stamp = today();
  let touched = 0;

  for (const entry of data.ratings) {
    const fresh =
      entry.platform === 'iOS'
        ? await fetchAppStore(entry.appId, 'us')
        : await fetchPlayStore(entry.packageId);

    if (entry.ratingValue > entry.bestRating || entry.ratingValue < entry.worstRating) {
      throw new Error(entry.store + ': stored rating outside worst/best bounds');
    }

    const changes = applyRating(entry, fresh);
    touched++;
    console.log(
      '  ' + entry.store.padEnd(12) +
      entry.ratingValue.toFixed(1) + '/5 from ' + entry.ratingCount.toLocaleString('en-US') + ' ratings' +
      (changes.length ? '  (' + changes.join(', ') + ')' : '  (unchanged)')
    );
  }

  if (touched !== data.ratings.length) throw new Error('not every rating was refreshed');

  data.updated = stamp;
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('updated data/game-ratings.json (retrieved ' + stamp + ')');
  console.log('next: npm run update-ratings');
}

main().catch((err) => {
  console.error('pull-game-ratings failed: ' + err.message);
  process.exit(1);
});
