# Plan 69: Render-Blocking Resource Audit

**Problem:** The current CSS loading strategy uses `preload` with `onload="this.rel='stylesheet'"` to avoid blocking render. But the inline critical CSS block may be incomplete, and any `<script>` tags may block parsing.

**Goal:** Audit all resources that block rendering. Eliminate any remaining render-blocking resources beyond the critical CSS.

---

## Step 1: Run Chrome DevTools audit

```bash
npx lighthouse http://localhost:3000 --view --preset=desktop
# Check "Eliminate render-blocking resources"
```

---

## Step 2: Audit script loading

Check all `<script>` tags in the HTML:

```bash
grep -n '<script' index.html guide/*/index.html 404.html
```

For each script:
- Is it inline or external?
- Does it have `defer` or `async`?
- Is it execution-blocking?

---

## Step 3: Fix blocking scripts

**Inline scripts** (like config loaders) should be small and fast. Move non-critical inline scripts after the main content.

**External scripts** should use `defer`:
```html
<script src="script.js" defer></script>
```

---

## Step 4: Audit CSS loading chain

Verify the CSS loading sequence:

1. `<style>` block with critical CSS (synchronous, blocks render intentionally)
2. `<link rel="preload" as="style" ... onload="this.rel='stylesheet'">` (non-blocking)

The critical CSS should contain enough rules to render the above-fold content without the full stylesheet.

---

## Step 5: Test with CSS disabled

Temporarily disable the async CSS to verify critical CSS is sufficient:

```html
<!-- Temporarily remove this: -->
<link rel="preload" as="style" href="styles.min.css" onload="this.rel='stylesheet'">
```

The page should render with only critical CSS — all above-fold content should be styled correctly.

---

## Step 6: Document the resource loading strategy

In `AGENTS.md` or `CONTRIBUTING.md`:

```
## Resource Loading Order
1. Critical CSS (inline <style>) — blocks render intentionally
2. Font preloads (as="font") — non-blocking, high priority
3. Async full CSS (preload → stylesheet) — non-blocking
4. Deferred JS (defer) — executes after HTML parsed
5. Lazy-loaded Chart.js (dynamic <script>) — on user interaction
```

---

## Files Modified: `index.html`, `guide/*/index.html` (adjust script loading attributes)
