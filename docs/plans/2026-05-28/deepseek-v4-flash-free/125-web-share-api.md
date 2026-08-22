# Plan 125: Web Share API Integration

**Gap:** Users can copy a share link (Plan 08) but can't use the native OS share sheet. Mobile users in particular expect a share button that opens the system share dialog.

**Best practice (web.dev):** Use `navigator.share()` to trigger the native OS share sheet with URL and text. Falls back to clipboard copy when not supported.

---

## Step 1: Add share function

```js
async function shareApp() {
  var url = buildShareUrl();
  var total = getCurrentTotal();

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Gem Rewards Calculator',
        text: 'I earn ' + total.toLocaleString() + ' gems/week in Invincible: Guarding the Globe!',
        url: url
      });
      console.log('Shared successfully');
    } catch (err) {
      if (err.name !== 'AbortError') {
        // User cancelled — not an error
        fallbackCopy(url);
      }
    }
  } else {
    fallbackCopy(url);
  }
}
```

---

## Step 2: Build share URL

```js
function buildShareUrl() {
  var params = new URLSearchParams();
  params.set('pvp1', getSelectValue('pvp1-league') + '-' + getSelectValue('pvp1-rank'));
  params.set('pvp2', getSelectValue('pvp2-league') + '-' + getSelectValue('pvp2-rank'));
  params.set('pvp3', getSelectValue('pvp3-league') + '-' + getSelectValue('pvp3-rank'));
  return window.location.origin + '/?' + params.toString();
}
```

---

## Step 3: Add share button

```html
<button class="gem-btn--icon" onclick="shareApp()" aria-label="Share">
  <svg ...share icon...></svg>
</button>
```

---

## Step 4: Test on mobile

```bash
# Open on iOS Safari or Android Chrome
# Tap share button
# Expected: native OS share sheet appears
# Expected: includes title, text, and URL
```

---

## Files Modified: `index.html`, `script.js`
