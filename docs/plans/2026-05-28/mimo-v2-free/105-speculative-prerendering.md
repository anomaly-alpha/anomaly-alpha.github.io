# Plan 105: Speculative Prerendering

**Gap identified:** Guide pages load on click with full network round-trip. There's no prerendering of likely-next pages.

**Web best practices (Chrome for Developers):** Use Speculation Rules API (`<script type="speculationrules">`) to prerender or prefetch pages likely to be navigated to next. prerender renders the entire page in a hidden tab (instant load); prefetch downloads the HTML (fast load).

---

## Step 1: Add speculation rules to main page

```html
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "list",
      "urls": [
        "/guide/code/",
        "/guide/pvp/"
      ]
    }
  ],
  "prefetch": [
    {
      "source": "list",
      "urls": [
        "/guide/event/",
        "/guide/login/",
        "/guide/faq/",
        "/guide/beginners/"
      ]
    }
  ]
}
</script>
```

---

## Step 2: Add speculation rules to guide pages

Each guide page prerenders the main page and the most likely next guide:

```html
<script type="speculationrules">
{
  "prefetch": [
    {
      "source": "list",
      "urls": [
        "/",
        "/guide/code/",
        "/guide/pvp/"
      ]
    }
  ]
}
</script>
```

---

## Step 3: Handle prerender lifecycle

Prerendered pages fire `prerenderingchange` event when activated:

```js
if (document.prerendering) {
  document.addEventListener('prerenderingchange', function () {
    console.log('Page activated from prerender');
    initializeApp(); // Ensure app fully initializes
  });
}
```

---

## Step 4: Verify with DevTools

```bash
# Open Chrome DevTools → Application → Speculative loads
# Navigate to main page — verify code and pvp guides are prerendering
# Click code guide — should load instantly (<100ms)
```

---

## Step 5: Monitor analytics impact

Prerendered pages may inflate page view counts. Add check:

```js
if (!document.prerendering) {
  // Only count real page views (not prerenders)
  trackPageView();
}
```

---

## Files Modified: `index.html`, `guide/*/index.html`, `script.js`
