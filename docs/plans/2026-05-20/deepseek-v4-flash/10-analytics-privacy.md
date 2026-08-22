# Plan 10: Privacy-First Analytics

**Problem:** The project has zero analytics. The team has no visibility into:
- Which guide pages are most visited (content priority)
- Whether users have JavaScript enabled
- How many users interact with the PvP calculator vs. just reading
- Which promo codes are most popular
- Bounce rate and traffic sources

**Goal:** Add lightweight, privacy-first analytics that respects visitors. No cookies, no personal data, no GDPR banner needed.

---

## Step 1: Choose a privacy-first approach

**Option A: Cloudflare Web Analytics** (recommended)
- Free, no rate limits
- No cookies, no JS tracking required (works at edge)
- HTTP(S) page views, referrers, countries
- 10-second setup
- Already using Cloudflare for caching (`_headers` file)

**Option B: Plausible** (self-hosted)
- Full control, open source
- Lightweight script (~1 KB)
- No cookies, GDPR-compliant by design
- Requires a hosted instance (~€9/mo or self-hosted on VPS)
- Script-based (works with JS disabled)

**Option C: Umami** (self-hosted)
- Similar to Plausible but free
- Node.js backend
- Requires VPS

**Option D: Simple server-side logging** (analog, nginx)
- If using Cloudflare Pages, access logs are available
- Parse Cloudflare access logs for basic metrics

**Recommendation:** Start with **Cloudflare Web Analytics** (zero setup, already using Cloudflare). If more detail needed, add **Plausible** later.

---

## Step 2: Add Cloudflare Web Analytics

Cloudflare Web Analytics requires adding a beacon snippet OR enabling via the Cloudflare dashboard.

**If using Cloudflare Pages:**
1. Go to Cloudflare Dashboard → Web Analytics
2. Add your domain (`anomaly-alpha.github.io`)
3. Cloudflare automatically tracks all pages behind its proxy

No code changes needed. Traffic is measured at the edge.

---

## Step 3: Add Plausible script (if self-hosted)

**In `index.html`** and all 6 guide pages (in `<head>`):

```html
<script defer data-domain="anomaly-alpha.github.io" src="https://plausible.io/js/script.js"></script>
```

For self-hosted:
```html
<script defer data-domain="anomaly-alpha.github.io" src="https://analytics.your-domain.com/js/script.js"></script>
```

---

## Step 4: Custom event tracking (optional, advanced)

Track specific user interactions to understand engagement:

```js
// In script.js, add a small analytics helper:
function trackEvent(name, data) {
  if (typeof plausible !== 'undefined') {
    plausible(name, { props: data || {} });
  }
  // Cloudflare Analytics doesn't support custom events via JS
}
```

**Events to track:**
- `PVP Change` — league/rank selection changes
- `Mode Filter` — which modes are toggled
- `Code Reveal` — promo code revealed
- `Code Copy` — code copied to clipboard
- `Chart Toggle` — show/hide charts
- `Modal Open` — which card modals are explored

**Instrumentation examples:**

```js
// In PvP change handler:
function updatePvpCard(id) {
  // ... existing logic ...
  trackEvent('PVP Change', { card: id });
}

// In code reveal handler:
function revealCode(cardEl) {
  // ... existing logic ...
  trackEvent('Code Reveal');
}

// In copy handler:
function copyToClipboard(code) {
  // ... existing copy logic ...
  trackEvent('Code Copy', { code: code });
}
```

---

## Step 5: Respect Do Not Track

Check for DNT header before loading analytics:

```js
if (navigator.doNotTrack === '1' || window.doNotTrack === '1') {
  // Skip analytics initialization
  console.log('DNT enabled — analytics disabled');
} else {
  // Load analytics script
  loadAnalytics();
}
```

---

## Step 6: Privacy policy (if adding custom events)

**File: `privacy.md`** (or a brief section on the FAQ page)

If tracking custom events, disclose minimally:
- What is tracked (page views, feature interactions)
- What is NOT tracked (no personal data, no cookies, no IP storage)
- How to opt out (enable DNT in browser settings)

---

## Step 7: Verify no data leaks

```bash
# Check that no tracking script sends personal data:
grep -rn "email\|user\|session\|cookie\|localStorage\|fingerprint" script.src.js

# Verify no third-party requests besides analytics:
grep -rn "fetch\|XMLHttpRequest" script.src.js
```

Expected: No personal data is ever sent. Analytics scripts are minimal and privacy-respecting.

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add Plausible script tag (if self-hosted) OR nothing for Cloudflare WA |
| `guide/*/index.html` (×6) | Same script tag |
| `script.js` | Add optional `trackEvent()` + DNT check |

---

## Verification

```bash
# After deployment:
# 1. Visit https://anomaly-alpha.github.io
# 2. Open DevTools → Network tab
# 3. Verify analytics request fires (plausible.io or cloudflare.com)
# 4. Verify no cookies are set
# 5. Verify page view appears in analytics dashboard within 5 minutes
# 6. Change PvP league — verify custom event appears (if instrumented)
```
