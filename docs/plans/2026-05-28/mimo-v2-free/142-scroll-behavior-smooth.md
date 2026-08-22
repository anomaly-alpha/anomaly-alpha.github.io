# Plan 142: CSS `scroll-behavior` for Smooth Anchor Links

**Gap:** Table of Contents links (Plan 86) jump instantly to sections. Adding smooth scrolling improves the experience. The CSS `scroll-behavior: smooth` property enables this with zero JS.

**Best practice (web.dev):** Set `scroll-behavior: smooth` on the document. Respect `prefers-reduced-motion` to disable when needed.

---

## Step 1: Enable smooth scrolling

```css
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

---

## Step 2: Add scroll-margin for fixed headers

Anchor links scroll to the element, which may be hidden behind fixed headers:

```css
h2, h3, :target {
  scroll-margin-top: 6rem; /* Offset for any fixed headers */
}
```

---

## Step 3: Apply to all anchor links

This works automatically for all `<a href="#section-id">` links. No JS changes needed.

---

## Step 4: Test

```bash
# Click ToC link → smooth scroll to section
# Click back → smooth scroll to top
# Enable prefers-reduced-motion → instant jump (no scroll)
```

---

## Files Modified: `styles.css`
