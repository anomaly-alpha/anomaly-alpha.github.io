# Plan 17: VideoGame Schema Audit

**Problem:** The VideoGame schema in the JSON-LD is minimal — it has name and applicationCategory but lacks critical fields like `gamePlatform`, `operatingSystem`, `offers`, and `aggregateRating` that enrich Google search results.

**Goal:** Complete the VideoGame schema so it qualifies for rich results with game-specific structured data.

---

## Step 1: Find current VideoGame schema
Search in `index.html` for the VideoGame entry in the JSON-LD graph.

Current likely:
```json
{
  "@type": "VideoGame",
  "name": "Invincible Guarding the Globe",
  "applicationCategory": "Game",
  "operatingSystem": "iOS, Android",
  "gamePlatform": "iOS, Android"
}
```

## Step 2: Expand to complete VideoGame schema
Replace with the full schema:

```json
{
  "@type": "VideoGame",
  "name": "Invincible Guarding the Globe",
  "description": "Free-to-play mobile RPG based on the Invincible comic series. Compete in PvP arenas, complete events, and earn gem rewards.",
  "applicationCategory": "GameApplication",
  "operatingSystem": "iOS, Android",
  "gamePlatform": ["iOS", "Android"],
  "genre": ["RPG", "Strategy"],
  "gameServer": "Mmo",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/AvailableForFree"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.2",
    "ratingCount": "1247"
  },
  "author": {
    "@type": "Organization",
    "name": "ubitsof"
  },
  "publisher": {
    "@type": "Organization",
    "name": "ubitsof"
  }
}
```

Note: `aggregateRating` should reflect actual app store ratings. Update `4.2` and `1247` to match current store data.

## Step 3: Update on guide pages too
Ensure guide pages that link to the main site also reference the VideoGame schema correctly in their own JSON-LD if present.

## Files Modified
- `index.html` — expand VideoGame schema

## Verification
```bash
# Validate at https://search.google.com/test/rich-results
# Look for "VideoGame" rich result with platform info
```