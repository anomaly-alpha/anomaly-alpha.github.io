#!/usr/bin/env node
// Renders the homepage's "Player Ratings" block from data/game-ratings.json.
//
//   npm run update-ratings
//
// The block exists because marked-up values must be visible on the page: the aggregateRating and
// Review nodes in index.html's JSON-LD are only legitimate while the same numbers and the same
// review text are rendered here. Values are read from the data file and never authored in the
// template, so nobody can type a rating the stores do not publish.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'game-ratings.json');
const PAGE = path.join(ROOT, 'index.html');

const START = '<!--GAME_RATINGS_START-->';
const END = '<!--GAME_RATINGS_END-->';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(n) {
  return n.toLocaleString('en-US');
}

// The stored timestamp already carries the store's own offset, so format the ISO date part
// directly rather than converting to UTC and risking a day shift.
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const day = Number(m[3]);
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return day + ' ' + month + ' ' + m[1];
}

function validate(data) {
  if (!Array.isArray(data.ratings) || data.ratings.length === 0) throw new Error('no ratings');
  if (!Array.isArray(data.reviews)) throw new Error('reviews must be an array');

  const stores = new Set();
  for (const r of data.ratings) {
    if (!r.platform || !r.store || !r.storeUrl) throw new Error('rating missing platform/store/storeUrl');
    if (stores.has(r.store)) throw new Error('duplicate store: ' + r.store);
    stores.add(r.store);
    if (typeof r.ratingValue !== 'number') throw new Error(r.store + ': ratingValue must be a number');
    if (r.ratingValue < r.worstRating || r.ratingValue > r.bestRating) {
      throw new Error(r.store + ': ratingValue outside worstRating/bestRating');
    }
    if (!Number.isInteger(r.ratingCount) || r.ratingCount <= 0) {
      throw new Error(r.store + ': ratingCount must be a positive integer');
    }
    if (!r.retrieved) throw new Error(r.store + ': missing retrieved date');
  }

  for (const rev of data.reviews) {
    for (const key of ['author', 'title', 'body', 'datePublished', 'ratingValue', 'store']) {
      if (!rev[key]) throw new Error('review missing ' + key);
    }
    if (!/T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/.test(rev.datePublished)) {
      throw new Error('review datePublished lacks a timezone offset: ' + rev.datePublished);
    }
  }
}

function renderRatingCard(rating) {
  const label =
    rating.store + ': ' + rating.ratingValue.toFixed(1) + ' out of ' + rating.bestRating +
    ' from ' + formatCount(rating.ratingCount) + ' ratings';
  return [
    '            <a href="' + escapeHtml(rating.storeUrl) + '" rel="noopener" aria-label="' + escapeHtml(label) + '"',
    '               class="block rounded bg-white/5 p-2 text-center transition-colors hover:bg-white/10 focus-visible:bg-white/10">',
    '                <span class="block text-white/60 text-[0.65rem] uppercase tracking-wider">' + escapeHtml(rating.store) + '</span>',
    '                <span class="block text-lg font-bold text-white">' + rating.ratingValue.toFixed(1) +
      '<span aria-hidden="true" class="gem-text--code"> &#9733;</span></span>',
    '                <span class="block text-white/60 text-[0.65rem]">' + formatCount(rating.ratingCount) + ' ratings</span>',
    '            </a>'
  ].join('\n');
}

function renderReview(review) {
  return [
    '            <li class="rounded bg-white/5 p-2">',
    '                <div class="flex items-baseline justify-between gap-2">',
    '                    <p class="text-white/85 text-xs font-semibold">' + escapeHtml(review.title) + '</p>',
    '                    <p class="text-white/60 text-[0.65rem] whitespace-nowrap">' +
      review.ratingValue + '/' + (review.bestRating || 5) + '</p>',
    '                </div>',
    '                <p class="text-white/70 text-[0.7rem] leading-snug mt-1">' + escapeHtml(review.body) + '</p>',
    '                <p class="text-white/60 text-[0.6rem] mt-1">' + escapeHtml(review.author) + ' &middot; ' +
      escapeHtml(review.store) + ' &middot; ' + formatDate(review.datePublished) + '</p>',
    '            </li>'
  ].join('\n');
}

function render(data) {
  const cards = data.ratings.map(renderRatingCard).join('\n');
  const reviews = data.reviews.map(renderReview).join('\n');
  const stamp = formatDate(data.updated);
  return [
    START,
    '        <!-- ===== PLAYER RATINGS: store-published values from data/game-ratings.json ===== -->',
    '        <section class="mx-4 mb-6 p-2 rounded border border-white/10 bg-white/[0.02]" aria-labelledby="player-ratings-heading">',
    '            <h2 id="player-ratings-heading" class="text-xs md:text-lg text-white/80 tracking-wider md:tracking-[0.2em] uppercase text-center mb-2">Player ratings</h2>',
    '            <div class="grid grid-cols-2 gap-2 mb-3">',
    cards,
    '            </div>',
    '            <ul class="space-y-2 list-none p-0 m-0">',
    reviews,
    '            </ul>',
    '            <p class="text-white/60 text-[0.6rem] text-center mt-2">Store ratings and reviews retrieved ' + stamp +
      '. Reviews are quoted verbatim from the App Store and are not edited.</p>',
    '        </section>',
    '        <!-- ===== END PLAYER RATINGS ===== -->',
    END
  ].join('\n');
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  validate(data);

  const html = fs.readFileSync(PAGE, 'utf8');
  // index.html is CRLF; joining with '\n' would inject lone LFs and make generate-codes.js
  // look like it changed the file on every run.
  const eol = html.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const startAt = html.indexOf(START);
  const endAt = html.indexOf(END);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    throw new Error('index.html is missing the ' + START + ' / ' + END + ' markers');
  }

  const next = html.slice(0, startAt) + render(data).replace(/\r?\n/g, eol) + html.slice(endAt + END.length);
  if (next === html) {
    console.log('game ratings unchanged (' + data.ratings.length + ' stores, ' + data.reviews.length + ' reviews)');
    return;
  }
  fs.writeFileSync(PAGE, next, 'utf8');
  console.log('wrote player ratings block (' + data.ratings.length + ' stores, ' + data.reviews.length + ' reviews)');
}

main();
