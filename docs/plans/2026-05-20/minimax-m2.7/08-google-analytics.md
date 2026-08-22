# Plan 08: Google Analytics 4 Integration

**Problem:** No analytics exist. We have no data on which modes users toggle, which charts they view, or which cards they interact with most. Understanding user behavior is impossible.

**Goal:** Integrate GA4 to track mode toggles, chart views, and card interactions as custom events. All tracking respects user privacy (no personal data).

---

## Step 1: Create measurement script
Add GA4 tracking to the head of `index.html` and all guide pages. Since we can't use fetch for GA script loading, use a self-hosted minimal GA4 script or load via a synchronous script tag.

```html
<script>
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-XXXXXXXXXX', {
  'send_page_view': true,
  'cookie_flags': 'SameSite=Lax;Secure'
});
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
```

Replace `G-XXXXXXXXXX` with the actual GA4 measurement ID.

## Step 2: Track custom events in script.js
Add event tracking for key interactions. Place after existing functions like `filterCards`, `updateAllPageTotals`, etc.

```javascript
// In filterCards(), after selectedModes is updated:
if (typeof gtag !== 'undefined') {
  gtag('event', 'mode_toggle', {
    'event_category': 'engagement',
    'selected_modes': selectedModes.join(','),
    'send_to': 'G-XXXXXXXXXX'
  });
}

// In initCharts(), when charts become visible:
if (typeof gtag !== 'undefined') {
  gtag('event', 'chart_view', {
    'event_category': 'engagement',
    'chart_type': chartType,
    'send_to': 'G-XXXXXXXXXX'
  });
}

// In showCardModal(), track card opens:
if (typeof gtag !== 'undefined') {
  gtag('event', 'card_open', {
    'event_category': 'engagement',
    'card_id': cardId,
    'send_to': 'G-XXXXXXXXXX'
  });
}
```

## Step 3: Track promo code copies
In the code reveal/copy function:

```javascript
if (typeof gtag !== 'undefined') {
  gtag('event', 'code_copied', {
    'event_category': 'engagement',
    'code': codeValue,
    'send_to': 'G-XXXXXXXXXX'
  });
}
```

## Files Modified
- `index.html` — add GA4 script tags
- `guide/*/index.html` — add GA4 script tags (pageview only)
- `script.js` — add gtag() calls for custom events

## Verification
```bash
# Open site, toggle modes, open charts, click cards
# Check GA4 Real-Time dashboard — events appear within seconds
```