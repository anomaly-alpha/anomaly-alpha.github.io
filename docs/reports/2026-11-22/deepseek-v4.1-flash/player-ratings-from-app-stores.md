# Store-sourced ratings and reviews

Date: 2026-11-22
Follows: `schema-expansion-and-non-critical-closure.md` (same folder)

## What changed in the brief

The earlier report recorded `aggregateRating` as accepted divergence, because the only way to
clear `Missing field "aggregateRating" (optional)` was to invent a rating. The user then
authorised two real sources — the **Apple App Store** and the **Google Play Store** — and asked
for `aggregateRating` plus reviews. Real third-party ratings are not fabrication, so the
policy changed: the property is allowed, but only with values a store actually publishes.

## Sources used (nothing typed by hand)

| Store | Rating | Ratings count | How it was read |
|---|---|---|---|
| App Store (US) | **4.8** (`4.78562`) | 63,051 | Apple's public lookup API — `averageUserRating`, `userRatingCount` |
| Google Play (US) | **4.4** (`4.39508`) | 87,749 | `ratingValue` / `ratingCount` in the store page payload |

Apple's API is a documented JSON contract. Google publishes no Play API, so the rating is read
from the page payload and range-validated. `scripts/pull-game-ratings.js` fails loudly rather
than writing a partial or guessed update.

Reviews come from Apple's public `customerreviews` feed, quoted **verbatim** — including the
reviewer's own spelling and emoji. Three are used, spanning the rating range:

| Rating | Author | Date | Title |
|---|---|---|---|
| 5/5 | Very Smart Trustworthy Guy | 2026-11-18 | Good If Consistently Played |
| 4/5 | Lukey-Bear36 | 2026-11-12 | I have loved this game this launch 💚, please update for duo |
| 3/5 | ShadowApex88 | 2026-11-07 | Love the game |

A negative and a middling review are included deliberately: quoting only 5-star text would be
selective, and the 3/5 one is about multiverse arena matchmaking — the exact subject of the
site's own PvP guide.

## Design decisions

- **One `AggregateRating` per store, on that store's `MobileApplication` node.** The homepage
  already carried two `MobileApplication` nodes keyed to each store by `sameAs`. Apple's 4.79
  and Google's 4.40 are different populations; averaging them would produce 4.56, a number no
  source publishes. They are kept separate.
- **`VideoGame` carries no rating.** It is the game, not an app listing, and any figure there
  would be the blended number rejected above.
- **Reviews attach to the iOS node**, because that is where they were published.
- **The values are rendered on the page.** `scripts/generate-game-ratings.js` writes a "Player
  ratings" block from `data/game-ratings.json`, so the marked-up numbers and review text are
  visible to a human — the condition that makes the markup legitimate at all.

## Guard changes (both suites, kept in step)

`aggregateRating` and `Review` were previously banned outright. A blanket ban would now be
wrong, and simply deleting the ban would let a hand-typed rating ship. Both guards were
changed to **cross-reference `data/game-ratings.json`** instead:

- every `aggregateRating` must match a recorded `ratingValue|ratingCount` exactly, and carry
  `bestRating`/`worstRating`;
- every `Review` must match the recorded author, body, rating and date exactly;
- every `Review.reviewBody` must be visible on the page (reusing the existing visibility check);
- `Product`, `HowTo` and `SearchAction` stay forbidden.

`generate-game-ratings.js` was also added to the generator-idempotency list.

## Bugs found and fixed while building this

- **Lone LFs in a CRLF file.** The generator joined lines with `\n` into a CRLF `index.html`,
  which made `generate-codes.js` look like it was rewriting the page on every run and broke
  `test:structured-data`'s byte-equality check. The generator now detects and matches the
  file's EOL. Symptom to remember: `output changed for index.html` with no visible git diff,
  because git's `autocrlf` hides pure line-ending changes.
- **A wrong contrast measurement.** A first pass reported 1.03:1 in light mode for every
  element, including untouched existing ones. Cause: this site paints backgrounds with
  `background-image` gradients, so `getComputedStyle().backgroundColor` is transparent and the
  compositing maths used the wrong backdrop. The site also retints `text-white/*` utilities to
  `rgba(26,32,44,0.64)` dark ink in light mode. Verified instead by screenshot in both modes.

## Verification

```
npm run test:structured-data   -> passed for 16 pages (incl. sourced-rating + idempotency)
npm run test:watch-pages       -> 42 passed, 0 failed
npm run test:music / test:nav / test:creators / test:ads-* -> pass
npm run verify:schema          -> 20 pages checked, 20 passed, 0 failed
```

Rendered check: block present at 312x703, two labelled store links, three review items, no page
errors, and identical readability in dark and light mode.

`npm run pull-game-ratings` was run live and immediately caught Play's count moving
87,748 → 87,749, which is why the shipped numbers carry 87,749.

## Still open

`/authors/anomaly/` keeps its `Software Apps` non-critical warning. Its `about` node describes
**this site's own calculator**, which no store lists, so there is no rating to source and
inventing one remains off the table. `/` should now clear that warning, since both its
`MobileApplication` items carry sourced ratings — to be confirmed by the Rich Results Test
after deploy.
