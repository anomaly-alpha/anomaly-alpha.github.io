# Plan 17: CSS Logical Properties Migration

**Problem:** CSS uses physical direction properties (`margin-left`, `padding-right`, `border-left`) instead of logical properties (`margin-inline-start`, `padding-inline-end`, `border-inline-start`). This makes future RTL language support harder and is inconsistent with modern CSS best practices.

**Goal:** Migrate directional CSS properties to their logical equivalents across `styles.css`.

---

## Step 1: Replace physical margin/padding properties

```css
/* Before */
.gem-card { margin-left: 1rem; margin-right: 1rem; }
.gem-label { padding-right: 0.5rem; }

/* After */
.gem-card { margin-inline: 1rem; }
.gem-label { padding-inline-end: 0.5rem; }
```

## Step 2: Replace physical border properties

```css
/* Before */
.gem-breadcrumb li + li::before { border-left: 1px solid ...; }

/* After */
.gem-breadcrumb li + li::before { border-inline-start: 1px solid ...; }
```

## Step 3: Replace physical text alignment

```css
/* Before */
.gem-text--center { text-align: center; } /* stays the same */
.gem-text--left { text-align: left; }
.gem-text--right { text-align: right; }

/* After */
.gem-text--start { text-align: start; }
.gem-text--end { text-align: end; }
```

## Step 4: Automated search and replace

```bash
# Find all physical direction properties
grep -n 'margin-left\|margin-right\|padding-left\|padding-right\|border-left\|border-right\|text-align: left\|text-align: right' styles.css
```

## Files Modified
- `styles.css` — logical properties migration

## Verification
```bash
npm run build
# Visual check — layout should be identical
# grep for remaining physical properties
grep -c 'margin-left\|margin-right' styles.css  # Should be 0 or minimal
```
