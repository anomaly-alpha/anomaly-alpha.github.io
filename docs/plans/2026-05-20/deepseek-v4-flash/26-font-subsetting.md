# Plan 26: Font Subsetting

**Problem:** The self-hosted fonts (Rajdhani 400/600/700 + Orbitron Variable) contain glyphs for many languages. The site only uses Latin characters (English text, with occasional accented characters in guide text). Full font files are larger than necessary.

**Goal:** Subset fonts to only include Latin characters used on the site. This reduces font file sizes and improves load time.

---

## Step 1: Analyze current font sizes

```bash
ls -lh fonts/
# Expected: Rajdhani ~15-20 KB each × 3 weights + Orbitron ~20-30 KB
# Total fonts directory: ~60-80 KB
```

---

## Step 2: Install fontsubsetting tool

```bash
# Option A: glyphhanger (recommended, uses fonttools)
pip install fonttools
npm install -D glyphhanger

# Option B: pyftsubset (standalone fonttools)
pip install fonttools
```

---

## Step 3: Extract used characters from all pages

```bash
# Collect all unique characters used on the site
glyphhanger --whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:'\"-()[]{}@#$%^&*+=/<>~|_ " > /tmp/used_chars.txt

# Or extract from HTML files directly:
cat index.html guide/*/index.html 404.html | \
  sed 's/<[^>]*>//g' | \
  fold -1 | \
  sort -u | \
  grep -v '^$' | \
  tr -d '\n' > /tmp/used_chars.txt

cat /tmp/used_chars.txt
# Expected: ~90-100 unique characters (English + symbols)
```

---

## Step 4: Subset each font file

```bash
# For each woff2 file:
for font in fonts/*.woff2; do
  name=$(basename "$font" .woff2)
  echo "Subsetting $name..."

  # Convert to .ttf first (pyftsubset works with TTF)
  # Then subset:
  pyftsubset "$font" \
    --text-file=/tmp/used_chars.txt \
    --layout-features='*' \
    --flavor=woff2 \
    --output-file="fonts/${name}-subset.woff2"
done

# Compare sizes:
ls -lh fonts/
echo "---"
ls -lh fonts/*subset*
```

---

## Step 5: Update HTML font references

**In all 7 pages + 404.html**, update `<link rel="preload">` and `@font-face` declarations:

```html
<!-- Before: -->
<link rel="preload" as="font" href="fonts/rajdhani-regular.woff2" crossorigin>

<!-- After: -->
<link rel="preload" as="font" href="fonts/rajdhani-regular-subset.woff2" crossorigin>
```

**In `styles.css`, update `@font-face` src:**
```css
@font-face {
  font-family: 'Rajdhani';
  src: url('../fonts/rajdhani-regular-subset.woff2') format('woff2');
  /* ... */
}
```

---

## Step 6: Handle fallback fonts

Keep the original files in the directory. The subset files are loaded by default, and the originals serve as fallbacks. Or commit only subset files once verified.

---

## Step 7: Verify rendering

```bash
# 1. Build and serve
npm run build && npx serve .

# 2. Check each page visually:
# - All text renders correctly
# - No missing glyphs (shown as boxes or question marks)
# - Accented characters in guide text (if any) are preserved

# 3. Verify weight/style matches:
# - Rajdhani Regular (400)
# - Rajdhani SemiBold (600)
# - Rajdhani Bold (700)
# - Orbitron Variable (500-900)
```

---

## Files Modified

| File | Change |
|------|--------|
| `fonts/*-subset.woff2` | **New** (6 files) |
| `index.html` | Update font preload URLs |
| `guide/*/index.html` (×6) | Update font preload URLs |
| `404.html` | Update font preload URLs |
| `styles.css` | Update `@font-face` src URLs |

---

## Verification

```bash
# Check total font savings:
echo "Before:"
du -sh fonts/
echo "After subset:"
ls -lh fonts/*subset*

# Verify no missing characters:
grep -oP '[^\x00-\x7F]' index.html guide/*/index.html 404.html | sort -u
# If any non-ASCII characters appear, add them to the whitelist
```
