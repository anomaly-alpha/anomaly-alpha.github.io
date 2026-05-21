# Plan 33: VideoGame Schema Enhancement

**Problem:** The VideoGame schema on the main page is minimal — only name, applicationCategory, operatingSystem, and gamePlatform. It's missing key properties like genre, numberOfPlayers, gameItem, and offers that would improve search visibility.

**Goal:** Expand the VideoGame schema with comprehensive properties.

---

## Step 1: Enhance VideoGame schema

```html
<!-- index.html — update the @graph WebPage entry -->
{
  "@type": "VideoGame",
  "name": "Invincible Guarding the Globe",
  "applicationCategory": "Mobile Game",
  "operatingSystem": "iOS, Android",
  "gamePlatform": ["iOS", "Android"],
  "genre": ["Strategy", "RPG", "Card Battle"],
  "numberOfPlayers": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 100 },
  "gameItem": [
    {
      "@type": "GameServer",
      "name": "Global Server"
    }
  ],
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "category": "Free-to-Play"
  ],
  "publisher": {
    "@type": "Organization",
    "name": "Ubisoft Barcelona"
  },
  "license": "https://anomaly-alpha.github.io/"
}
```

## Files Modified
- `index.html` — enhanced VideoGame schema

## Verification
```bash
# Google Rich Results Test
https://search.google.com/test/rich-results
# Should show enhanced VideoGame data
```
