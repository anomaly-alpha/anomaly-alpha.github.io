# Plan 115: Web Share API

**Problem:** Users can't easily share their gem income configuration with friends via native share dialogs on mobile.

**Goal:** Add a share button that uses the Web Share API on supported platforms.

---

## Step 1: Add share button

```html
<!-- index.html -->
<button class="gem-btn" id="share-btn" onclick="shareIncome()" hidden>
  Share
</button>
```

## Step 2: Implement share function

```javascript
// script.js
function showShareButton() {
  if (navigator.share) {
    document.getElementById('share-btn').hidden = false;
  }
}

function shareIncome() {
  var total = calculateGrandTotal();
  var text = 'My weekly gem income in Invincible: ' + total.toLocaleString() + ' gems! Calculate yours at ';

  navigator.share({
    title: 'Gem Rewards Calculator',
    text: text,
    url: window.location.href
  }).catch(function() {});
}
```

## Step 3: Show button on load

```javascript
// script.js — add to DOMContentLoaded
showShareButton();
```

## Files Modified
- `index.html` — share button
- `script.js` — share function

## Verification
```bash
npm run build
# Mobile device — Share button should appear
# Click — should open native share dialog
```
