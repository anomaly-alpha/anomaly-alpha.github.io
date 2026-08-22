# Plan 28: Game Version / Last Updated in Footer

**Problem:** The footer shows contributors but no indication of when the data was last verified against the game. Promo codes expire, events change, and PvP payout tables may be adjusted by the game developers. Users have no way to know if the data is current.

**Goal:** Add a "Last verified" date to the footer that indicates when data was last confirmed accurate. Add a "game version" reference if discoverable.

---

## Step 1: Add config for version metadata

**In `index.html`**, add to the existing `game-config` or create a small inline config:

```json
{
  "version": {
    "site": "2.0.0",
    "lastVerified": "2026-05-12",
    "gameVersion": "4.8.0",
    "notes": "PvP payout tables verified, promo codes updated"
  }
}
```

Or simpler, in the footer HTML directly:

```html
<footer class="gem-contributors">
  <p class="gem-text--muted text-xs">
    Data last verified: <span class="gem-text--cyan">May 12, 2026</span>
    &middot; Game version: <span class="gem-text--cyan">4.8.0</span>
  </p>
  <p class="gem-contributors__label">Contributors</p>
  <div class="gem-contributors__list">...</div>
</footer>
```

---

## Step 2: Update all 7 pages + 404.html

Make the footer consistent across all pages. The guide pages may have simplified footers — ensure they all include the verification date.

---

## Step 3: Add a dynamic "data age" indicator (optional, advanced)

Using the last verified date, calculate how old the data is:

```js
function getDataAge() {
  var lastVerified = new Date('2026-05-12');
  var now = new Date();
  var days = Math.floor((now - lastVerified) / (1000 * 60 * 60 * 24));

  if (days > 90) return { label: '⚠️ May be outdated', level: 'danger' };
  if (days > 30) return { label: 'Check for updates', level: 'warning' };
  return { label: 'Current', level: 'success' };
}
```

Apply in the footer:
```html
<p class="gem-text--muted text-xs">
  Data last verified: <span class="gem-text--cyan">May 12, 2026</span>
  <span class="gem-alert__text--danger" id="data-age"></span>
</p>
```

```js
var dataAge = getDataAge();
var el = document.getElementById('data-age');
if (el && dataAge.level !== 'success') {
  el.textContent = ' (' + dataAge.label + ')';
}
```

---

## Step 4: Add link to changelog

In the footer, add a link to the changelog:

```html
<p class="gem-text--muted text-xs mt-1">
  <a href="/CHANGELOG.md" class="gem-text--cyan hover:text-white transition-colors">View changelog</a>
</p>
```

---

## Step 5: Automate the last verified date

Create a script that updates the date on build:

**File: `scripts/update-version.js`**

```js
const fs = require('fs');
const path = require('path');

const today = new Date();
const dateStr = today.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

const PAGES = [
  'index.html',
  'guide/code/index.html',
  'guide/event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/beginners/index.html',
  '404.html'
];

PAGES.forEach((page) => {
  const filePath = path.join(__dirname, '..', page);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(
    /Data last verified: <span class="gem-text--cyan">[^<]+<\/span>/,
    'Data last verified: <span class="gem-text--cyan">' + dateStr + '</span>'
  );
  fs.writeFileSync(filePath, html);
  console.log('✓ Updated ' + page);
});
```

**Add to `package.json`:**
```json
"prebuild": "node scripts/update-version.js"
```

This updates all pages with today's date before every build.

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add last verified date, game version, data age indicator |
| `guide/*/index.html` (×6) | Same footer additions |
| `404.html` | Same footer additions |
| `scripts/update-version.js` | **New** — auto-updates date on build |
| `package.json` | Add `prebuild` script |
| `script.js` | Add `getDataAge()` function |

---

## Verification

```bash
npm run prebuild
# Check that all pages now have today's date

grep "Data last verified" index.html guide/*/index.html 404.html
# All 8 pages should show the same date
```
