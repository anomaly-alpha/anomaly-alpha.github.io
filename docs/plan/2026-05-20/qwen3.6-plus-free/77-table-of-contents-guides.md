# Plan 77: Table of Contents for Guides

**Problem:** Guide pages are long and lack a table of contents. Users must scroll through the entire page to find specific sections.

**Goal:** Add a sticky table of contents to each guide page.

---

## Step 1: Add ToC HTML

```html
<!-- guide/pvp/index.html — after header -->
<nav class="gem-toc" aria-label="Table of contents">
  <h2>Contents</h2>
  <ol>
    <li><a href="#leagues">Leagues & Ranks</a></li>
    <li><a href="#restricted">Restricted Arena</a></li>
    <li><a href="#open">Open Arena</a></li>
    <li><a href="#alliance">Alliance War</a></li>
    <li><a href="#demotion">Demotion Rules</a></li>
    <li><a href="#tips">Tips & Strategies</a></li>
  </ol>
</nav>
```

## Step 2: Add section IDs

```html
<!-- Wrap each section with an id matching the ToC link -->
<section id="leagues">
  <h2>Leagues & Ranks</h2>
  ...
</section>
```

## Step 3: Add sticky ToC CSS

```css
.gem-toc {
  position: sticky;
  top: 1rem;
  padding: 1rem;
  background: var(--gem-bg-mid);
  border: 1px solid var(--gem-border--subtle);
  border-radius: 0.5rem;
  max-width: 250px;
  font-size: 0.85rem;
}
.gem-toc ol {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}
.gem-toc li {
  margin: 0.25rem 0;
}
.gem-toc a {
  color: var(--gem-text--secondary);
  text-decoration: none;
}
.gem-toc a:hover {
  color: var(--gem-cyan);
}
```

## Files Modified
- All 6 guide pages — ToC + section IDs
- `styles.css` — ToC styles

## Verification
```bash
npm run build
# ToC should be visible and sticky
# Click links — should scroll to section
```
