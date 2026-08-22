# Plan 138: Campaign Tracking URLs

**Problem:** No way to track which referral sources (Discord, Reddit, YouTube) drive the most traffic. UTM parameters can be captured and logged.

**Goal:** Capture UTM parameters and log them for analysis.

---

## Step 1: Capture UTM parameters

```javascript
// script.js — add to DOMContentLoaded
function captureUTM() {
  var params = new URLSearchParams(window.location.search);
  var utm = {};

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function(key) {
    var value = params.get(key);
    if (value) utm[key] = value;
  });

  if (Object.keys(utm).length > 0) {
    // Log to localStorage for analysis
    var visits = JSON.parse(localStorage.getItem('gem_visits') || '[]');
    visits.push({
      date: new Date().toISOString(),
      utm: utm,
      page: window.location.pathname
    });
    // Keep last 100 visits
    if (visits.length > 100) visits = visits.slice(-100);
    localStorage.setItem('gem_visits', JSON.stringify(visits));
  }
}
```

## Step 2: Add export for analytics

```javascript
// script.js
function exportVisits() {
  var visits = JSON.parse(localStorage.getItem('gem_visits') || '[]');
  var blob = new Blob([JSON.stringify(visits, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'visits.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

## Files Modified
- `script.js` — UTM capture, export

## Verification
```bash
npm run build
# Visit with ?utm_source=discord&utm_campaign=share
# Check localStorage — should show visit logged
```
