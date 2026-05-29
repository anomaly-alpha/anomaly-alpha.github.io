# Plan 75: JSON-LD Author Consolidation

**Problem:** Multiple structured data blocks reference authors inconsistently — some use `Person`, some don't mention author at all. Contributor colors in the footer don't match author references in JSON-LD.

**Goal:** Consolidate all author references into a single shared definition. Use `@id` references to link between schemas.

---

## Step 1: Add shared author definition

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://anomaly-alpha.github.io/#anomaly",
  "name": "Anomaly",
  "url": "https://anomaly-alpha.github.io/"
}
</script>
```

---

## Step 2: Reference author in all schemas

**WebPage:**
```json
{
  "@type": "WebPage",
  "author": { "@id": "https://anomaly-alpha.github.io/#anomaly" },
  ...
}
```

**Guide/Article:**
```json
{
  "@type": "Guide",
  "author": { "@id": "https://anomaly-alpha.github.io/#anomaly" },
  ...
}
```

---

## Step 3: Map all contributor colors

Update the `contributors-config` to use the same `@id` references:

```json
{
  "contributors": [
    {"name": "Anomaly", "color": "#00e5ff", "@id": "https://anomaly-alpha.github.io/#anomaly"},
    {"name": "TheOneTruePanda", "color": "#e91e8a"},
    {"name": "dbp loves allen", "color": "#ff6b35"},
    {"name": "Sy", "color": "#facc15"}
  ]
}
```

---

## Step 4: Add JSON-LD for other contributors

Add additional `Person` schemas for each contributor:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "TheOneTruePanda",
  "contributor": true
}
</script>
```

---

## Step 5: Verify with Google Structured Data Testing Tool

```bash
# Extract all JSON-LD blocks and validate references:
grep -o '"@id": "[^"]*"' index.html | sort -u
# Verify each @id is unique and referenced correctly
```

---

## Files Modified: `index.html`, `guide/*/index.html`
