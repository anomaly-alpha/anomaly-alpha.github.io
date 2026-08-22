# Plan 23: Font Subsetting for Rajdhani

**Problem:** The Rajdhani font files include full Unicode ranges (Latin Extended, Cyrillic, etc.) but the site only uses basic Latin characters. This wastes ~40% of font file size on unused glyphs.

**Goal:** Subset the Rajdhani font files to include only the characters actually used on the site.

---

## Step 1: Identify used characters

```bash
# Extract all text content from HTML files
cat index.html guide/*/index.html 404.html | \
  grep -oP '(?<=>)[^<]+' | \
  fold -w1 | sort -u | tr -d '\n'
```

This produces the character set needed.

## Step 2: Subset fonts using pyftsubset

```bash
# Install fonttools
pip install fonttools brotli

# Subset each Rajdhani file
CHARS="A-Za-z0-9 .,:;!?()[]{}'\"@#$%^&*+-/=<>~_\\|@°×÷"

pyftsubset fonts/Rajdhani-Regular.woff2 \
  --text="$CHARS" \
  --output-file=fonts/Rajdhani-Regular-subset.woff2 \
  --flavor=woff2

pyftsubset fonts/Rajdhani-SemiBold.woff2 \
  --text="$CHARS" \
  --output-file=fonts/Rajdhani-SemiBold-subset.woff2 \
  --flavor=woff2

pyftsubset fonts/Rajdhani-Bold.woff2 \
  --text="$CHARS" \
  --output-file=fonts/Rajdhani-Bold-subset.woff2 \
  --flavor=woff2
```

## Step 3: Update font references

```html
<!-- index.html — update preload and @font-face src -->
<link rel="preload" href="fonts/Rajdhani-Regular-subset.woff2" as="font" ...>
```

```css
/* styles.css — update @font-face */
@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-Regular-subset.woff2') format('woff2');
  /* ... */
}
```

## Files Modified
- `fonts/Rajdhani-*-subset.woff2` — new subset files
- `index.html` — updated preload links
- `styles.css` — updated @font-face src paths
- `guide/*/index.html` — updated preload links (6 files)

## Verification
```bash
# Compare file sizes
ls -la fonts/Rajdhani-*.woff2
# Subset files should be ~40% smaller
# Visual check — all text should render correctly
```
