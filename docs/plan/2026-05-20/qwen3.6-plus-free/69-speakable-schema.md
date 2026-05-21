# Plan 69: Speakable Schema

**Problem:** Content isn't marked for voice assistant readability. Google Assistant and other voice platforms can't identify the most important content to read aloud.

**Goal:** Add SpeakableSpecification to guide pages for voice assistant compatibility.

---

## Step 1: Add speakable schema

```html
<!-- guide/pvp/index.html — add to <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "PvP Guide",
  "speakable": {
    "@type": "SpeakableSpecification",
    "xpath": [
      "/html/body/main/article/h1",
      "/html/body/main/article/p[1]",
      "/html/body/main/article/section/h2",
      "/html/body/main/article/section/p"
    ]
  }
}
</script>
```

## Step 2: Ensure content is wrapped in semantic HTML

```html
<!-- guide pages — wrap content in <article> -->
<main>
  <article>
    <h1>PvP Guide</h1>
    <p>Complete guide to PvP leagues...</p>
    <section>
      <h2>Leagues</h2>
      <p>There are 14 leagues...</p>
    </section>
  </article>
</main>
```

## Files Modified
- All 6 guide pages — speakable schema + article wrapping

## Verification
```bash
# Google Rich Results Test
# Should show speakable annotations
```
