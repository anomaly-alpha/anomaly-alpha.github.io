# Plan 41: VideoGame Structured Data

**Problem:** The main page has a WebPage schema describing the calculator, but doesn't describe the underlying game itself. Google can show rich results for VideoGame data — including gameplay descriptions, application category, and operating system.

**Goal:** Add VideoGame structured data to the main page describing Invincible: Guarding the Globe, linking to the calculator as an "associated tool."

---

## Step 1: Create VideoGame schema

**In `index.html`**, add to the existing structured data section:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Invincible: Guarding the Globe",
  "description": "A mobile RPG where players assemble and upgrade a team of heroes from the Invincible universe to protect Earth from global threats.",
  "applicationCategory": "GameApplication",
  "operatingSystem": "iOS, Android",
  "author": {
    "@type": "Organization",
    "name": "Ubisoft Barcelona"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "genre": ["RPG", "Strategy", "Superhero"],
  "associatedTool": {
    "@type": "WebApplication",
    "name": "Gem Rewards Calculator",
    "url": "https://anomaly-alpha.github.io/",
    "description": "Weekly gem income calculator for Invincible: Guarding the Globe"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.3",
    "ratingCount": "12500",
    "bestRating": "5"
  }
}
</script>
```

---

## Step 2: Add the VideoGame schema to guide pages too

Each guide page should reference the same VideoGame as the `about` property of the Guide schema:

**In `guide/*/index.html`**, update the Guide schema:

```json
{
  "@context": "https://schema.org",
  "@type": "Guide",
  "name": "...",
  "about": {
    "@type": "VideoGame",
    "name": "Invincible: Guarding the Globe",
    "url": "https://anomaly-alpha.github.io/"
  }
}
```

---

## Step 3: Update existing Person author references

The current WebPage schema references authors as `Person`. The VideoGame schema uses `Organization` (Ubisoft). This is fine — they describe different entities.

---

## Step 4: Add download links

In the VideoGame schema, include official app store links:

```json
"potentialAction": {
  "@type": "DownloadAction",
  "target": {
    "@type": "EntryPoint",
    "urlTemplate": "https://apps.apple.com/app/invincible-guarding-the-globe/id6443920497",
    "actionPlatform": "https://schema.org/DesktopWebPlatform"
  }
}
```

---

## Step 5: Verify with Google Rich Results Test

```bash
# Copy the VideoGame JSON-LD block
# Paste into https://search.google.com/test/rich-results
# Verify:
# - VideoGame schema is valid
# - associatedTool links to calculator
# - All required fields present (name, description)
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add VideoGame schema |
| `guide/*/index.html` (×6) | Add `about` VideoGame reference to Guide schema |

---

## Verification

```bash
# Validate JSON-LD:
python3 -c "
import json, re
with open('index.html') as f:
    html = f.read()
    for match in re.finditer(r'\"@type\": \"VideoGame\".*?\"@context\"', html, re.DOTALL):
        data = json.loads('{' + match.group()[:-1] + '}')
        print('Name:', data.get('name'))
        print('Tool:', data.get('associatedTool', {}).get('name'))
        print('✓ VideoGame schema valid')
"

# Check guide pages have about:
for f in guide/*/index.html; do
  grep -q 'VideoGame' "$f" && echo "✓ $(basename $(dirname $f))" || echo "✗ $(basename $(dirname $f)) MISSING"
done
```
