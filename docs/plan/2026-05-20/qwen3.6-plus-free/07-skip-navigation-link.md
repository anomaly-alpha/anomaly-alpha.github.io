# Plan 07: Skip Navigation Link

**Problem:** No skip navigation link exists. Keyboard users must tab through all mode buttons, card info icons, and chart toggles before reaching the main card content. This violates WCAG 2.4.1 (Bypass Blocks).

**Goal:** Add a "Skip to main content" link that appears on focus and jumps past navigation to the card grid.

---

## Step 1: Add skip link to all HTML pages

Insert as the first element inside `<body>` on all 8 pages:

```html
<body>
  <a href="#main-content" class="gem-skip-link">Skip to main content</a>
  ...
  <main id="main-content" class="gem-main">
```

## Step 2: Add CSS for skip link

```css
/* styles.css */
.gem-skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  z-index: 1000;
  padding: 0.75rem 1.5rem;
  background: var(--gem-cyan);
  color: var(--gem-bg-dark);
  font-weight: 700;
  text-decoration: none;
  border-radius: 0 0 0.5rem 0.5rem;
  transition: top 0.15s;
}
.gem-skip-link:focus {
  top: 0;
  outline: 3px solid var(--gem-star);
  outline-offset: 2px;
}
```

## Step 3: Ensure main landmark has id

Verify `<main>` has `id="main-content"` on all pages. The main page already has `<main class="gem-main">`, add the id:

```html
<main id="main-content" class="gem-main">
```

## Files Modified
- `index.html` — skip link + main id
- `guide/*/index.html` — skip link + main id (6 files)
- `404.html` — skip link + main id
- `styles.css` — skip link styles

## Verification
```bash
npm run build
# Open in browser, press Tab — skip link should appear
# Press Enter — focus should jump to card grid
```
