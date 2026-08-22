# Plan 120: `overscroll-behavior` Control

**Gap:** When users scroll past the end of a modal or the page body, the browser shows a "bounce" effect (pull-to-refresh on mobile, overscroll glow on desktop). For a themed app, this feels unpolished.

**Best practice (web.dev):** Use `overscroll-behavior: contain` on modals and `overscroll-behavior: none` on the body to prevent pull-to-refresh.

---

## Step 1: Prevent overscroll on body

```css
body {
  overscroll-behavior: none;
}
```

---

## Step 2: Contain overscroll within modals

```css
.gem-modal__body {
  overscroll-behavior: contain;
}
```

---

## Step 3: Allow overscroll on guide pages

Guide pages may want overscroll to feel more natural. Only apply to the main interactive page:

```css
/* Main calculator page only */
.gem-app-container {
  overscroll-behavior: none;
}
```

---

## Step 4: Test on mobile

```bash
# Open on mobile device or mobile emulation
# Try to pull down past the top of the page
# Expected: no pull-to-refresh or bounce effect
# Try to scroll past the end of a modal
# Expected: modal scrolls to end, body behind doesn't move
```

---

## Files Modified: `styles.css`
