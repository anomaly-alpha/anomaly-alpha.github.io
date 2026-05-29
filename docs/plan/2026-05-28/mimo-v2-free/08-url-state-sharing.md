# Plan 08: URL State Sharing — Shareable PvP Configurations

**Problem:** Currently, PvP selections (league/rank for each of the 3 arena types) are persisted in `localStorage` and URL params (`?theme=light`, `?mode=<name>`, `?chart=<name>`). But there's no way to share a specific PvP configuration — a user can't send a link like `?pvp=elite2-13&pvp2=junior1-45`.

**Goal:** Full state serialization via URL hash/params that allows sharing exact PvP configurations. Add a "Copy Share Link" button that encodes all selections into a shareable URL.

---

## Step 1: Read current URL state logic

**Current** (`script.js`):
```js
// URL params restored on load: ?theme=light&mode=<name>&chart=<name>
// This is basic — only theme, mode filter, and chart filter
```

**Goal:** Add PvP state to URL params:
```
?pvp1=elite2-13&pvp2=intern-50&pvp3=senior1-86&theme=light
```

---

## Step 2: Add encoding/decoding functions

```js
// ===== URL STATE =====

function encodePvpState() {
  const pvp1League = document.getElementById('pvp1-league').value;
  const pvp1Rank = document.getElementById('pvp1-rank').value;
  const pvp2League = document.getElementById('pvp2-league').value;
  const pvp2Rank = document.getElementById('pvp2-rank').value;
  const pvp3League = document.getElementById('pvp3-league').value;
  const pvp3Rank = document.getElementById('pvp3-rank').value;

  const params = new URLSearchParams();

  if (pvp1League) params.set('pvp1', pvp1League + '-' + pvp1Rank);
  if (pvp2League) params.set('pvp2', pvp2League + '-' + pvp2Rank);
  if (pvp3League) params.set('pvp3', pvp3League + '-' + pvp3Rank);

  return params.toString();
}

function decodePvpState(params) {
  const pvp1 = params.get('pvp1');
  const pvp2 = params.get('pvp2');
  const pvp3 = params.get('pvp3');

  if (pvp1) {
    const [league, rank] = pvp1.split('-');
    setPvpSelector('pvp1', league, rank);
  }
  if (pvp2) {
    const [league, rank] = pvp2.split('-');
    setPvpSelector('pvp2', league, rank);
  }
  if (pvp3) {
    const [league, rank] = pvp3.split('-');
    setPvpSelector('pvp3', league, rank);
  }
}

function setPvpSelector(cardId, leagueValue, rankValue) {
  const leagueEl = document.getElementById(cardId + '-league');
  const rankEl = document.getElementById(cardId + '-rank');
  if (leagueEl) {
    leagueEl.value = leagueValue;
    leagueEl.dispatchEvent(new Event('change'));
  }
  if (rankEl) {
    rankEl.value = rankValue;
    rankEl.dispatchEvent(new Event('change'));
  }
}
```

---

## Step 3: Add the share link button

**In `index.html`** (near the charts toggle or in the header area):

```html
<button class="gem-btn--icon" onclick="copyShareLink()"
        aria-label="Copy share link with current PvP configuration"
        title="Share your current configuration">
  <!-- Inline SVG for link icon -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor" width="16" height="16">
    <path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/>
  </svg>
</button>
```

---

## Step 4: Copy share link function

```js
function copyShareLink() {
  const base = window.location.href.split('?')[0]; // strip existing params
  const pvpState = encodePvpState();
  const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';

  const params = new URLSearchParams();
  if (pvpState) {
    pvpState.split('&').forEach(function (pair) {
      const [k, v] = pair.split('=');
      params.set(k, v);
    });
  }
  params.set('theme', theme);

  const shareUrl = base + '?' + params.toString();

  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(function () {
      showToast('Link copied! Share it with your alliance.', 'success');
    }).catch(function () {
      fallbackCopy(shareUrl);
    });
  } else {
    fallbackCopy(shareUrl);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showToast('Link copied!', 'success');
}

function showToast(message, type) {
  // Simple toast display (or use existing gem-toast component)
  const toast = document.createElement('div');
  toast.className = 'gem-toast gem-toast--' + (type || 'info');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '1rem';
  toast.style.right = '1rem';
  toast.style.zIndex = '9999';
  document.body.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 3000);
}
```

---

## Step 5: Restore state from URL on page load

**In `loadPageState()`** (or a new function called from DOMContentLoaded):

```js
function restoreUrlState() {
  const params = new URLSearchParams(window.location.search);

  // Restore PvP state from URL
  decodePvpState(params);

  // Theme
  if (params.get('theme') === 'light') {
    document.body.classList.add('light-mode');
  }

  // Mode filters
  const mode = params.get('mode');
  if (mode) {
    selectedModes = [mode];
    // This will trigger filterCards via the existing restore logic
  }

  // Chart filter
  const chart = params.get('chart');
  if (chart) {
    currentChartFilter = chart;
  }
}
```

---

## Step 6: Update URL when PvP selections change (optional)

To keep the URL in sync with selections (like a single-page app):

```js
function updateUrlFromState() {
  const params = new URLSearchParams();

  // Add PvP state
  const pvpState = encodePvpState();
  if (pvpState) {
    pvpState.split('&').forEach(function (pair) {
      const [k, v] = pair.split('=');
      params.set(k, v);
    });
  }

  // Add theme
  params.set('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');

  // Update URL without reload
  const newUrl = window.location.pathname + '?' + params.toString();
  window.history.replaceState({}, '', newUrl);
}
```

Call `updateUrlFromState()` inside `updatePvpCard()` and the theme toggle function.

---

## Step 7: Fallback for clipboard API

Some browsers block clipboard access. Ensure the fallback (`document.execCommand('copy')`) works. Test in:
- Chrome Desktop ✅
- Safari Desktop + Mobile (requires user gesture)
- Firefox ✅
- iOS Safari (limited clipboard access)

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add share link button, toast CSS |
| `script.js` | Add `encodePvpState()`, `decodePvpState()`, `copyShareLink()`, `restoreUrlState()`, `updateUrlFromState()`, `showToast()` |
| `styles.css` | Add `.gem-toast` styles if not already present |

---

## Verification

```bash
# 1. Open index.html
# 2. Set PvP1 to Elite II, rank 42
# 3. Set PvP2 to Invincible, rank 7
# 4. Click "Copy Share Link"
# 5. Open the copied URL in a new tab
# 6. Verify PvP selectors restore to Elite II / rank 42 / Invincible / rank 7
# 7. Verify total gem count matches original
```
