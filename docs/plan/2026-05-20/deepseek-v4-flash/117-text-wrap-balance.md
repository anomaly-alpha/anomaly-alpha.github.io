# Plan 117: `text-wrap: balance` for Headings

**Gap:** Headings on guide pages may wrap awkwardly with one word on the last line. `text-wrap: balance` evens out line lengths for improved readability.

**Best practice (web.dev):** Use `text-wrap: balance` on headings and `text-wrap: pretty` on body text. Both are baseline 2024.

---

## Step 1: Apply to all headings

```css
h1, h2, h3, h4 {
  text-wrap: balance;
  max-inline-size: 45ch; /* Optimal reading width */
}
```

---

## Step 2: Apply `text-wrap: pretty` to body text

```css
.gem-card__body, .gem-modal__body-text, p {
  text-wrap: pretty;
  max-inline-size: 65ch;
}
```

---

## Step 3: Add `max-inline-size` to card bodies

```css
.gem-card__body {
  max-inline-size: 50ch;
}
```

---

## Step 4: Verify visual improvement

```bash
# Open guide pages with long headings
# Before: headings may have orphan words on last line
# After: lines are balanced
```

---

## Files Modified: `styles.css`
