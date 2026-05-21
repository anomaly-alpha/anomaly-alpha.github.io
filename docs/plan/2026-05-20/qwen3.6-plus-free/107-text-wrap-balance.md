# Plan 107: text-wrap Balance for Headers

**Problem:** Headers with long text can have awkward line breaks (e.g., single word on last line). `text-wrap: balance` distributes words evenly across lines.

**Goal:** Apply `text-wrap: balance` to headers for better typography.

---

## Step 1: Add text-wrap to headers

```css
/* styles.css */
h1, h2, h3 {
  text-wrap: balance;
}

.gem-card__title {
  text-wrap: balance;
}

.gem-modal__title {
  text-wrap: balance;
}
```

## Step 2: Add pretty wrap for body text

```css
.gem-card__desc,
.gem-modal__body-text {
  text-wrap: pretty;
}
```

## Files Modified
- `styles.css` — text-wrap properties

## Verification
```bash
npm run build
# Resize browser — headers should have balanced line breaks
# No single word on last line
# Chrome 114+, Firefox 121+, Safari 17.4+
```
