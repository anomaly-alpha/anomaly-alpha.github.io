# Plan 18: CSS Custom Property Audit

**Problem:** `styles.css` should use only design tokens (CSS custom properties) for all colors, but some rules may have hardcoded hex values (e.g., `#00e5ff`, `#050a14`) instead of token references. This creates maintenance risk — changing a color requires hunting down every hardcoded instance.

**Goal:** Audit `styles.css` for all hardcoded hex/rgba values, replace each with the corresponding token, and ensure no token exists twice with different values.

---

## Step 1: List all hardcoded colors in styles.css
```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha
grep -n -E '#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)' styles.css | grep -v ':root\|--gem\|var(\|light-mode' | head -60
```

This finds hex/rgba values that are NOT inside a CSS variable definition.

## Step 2: Categorize each match
For each hardcoded value found, determine:
- **Is there a token for this?** → Use `var(--gem-xxx)`
- **Should this be a new token?** → Add to `:root` and use it
- **Is this a one-off that needs its own token?** → Create one

Common patterns:
- Background gradients: use `--gem-bg-dark`, `--gem-bg-mid`
- Text colors: use `--gem-text--primary`, `--gem-text--secondary`
- Category colors: use `--gem-event`, `--gem-pvp`, etc.

## Step 3: Fix violations
Create a refactoring script or manually fix each violation:

```css
/* BEFORE (hardcoded) */
.card { background: #0a1628; color: #ffffff; }

/* AFTER (tokenized) */
.card { background: var(--gem-bg-mid); color: var(--gem-text--primary); }
```

Add any missing tokens to `:root` in `styles.css`:

```css
:root {
  /* Existing tokens... */
  --gem-example-new: #value;
}
```

## Files Modified
- `styles.css` — replace hardcoded colors with token references

## Verification
```bash
grep -n -E '#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)' styles.css | grep -v ':root\|--gem\|var(\|light-mode'
# Should return 0 results (all colors use tokens)
```