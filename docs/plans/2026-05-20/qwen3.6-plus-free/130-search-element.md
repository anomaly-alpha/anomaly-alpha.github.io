# Plan 130: <search> Element

**Problem:** If search functionality is added (Plan 150), it should use the semantic `<search>` element for better accessibility.

**Goal:** Use `<search>` element for the search component.

---

## Step 1: Add search with semantic element

```html
<!-- index.html -->
<search class="gem-search" role="search" aria-label="Search cards">
  <label for="search-input" class="gem-search__label">Search</label>
  <input type="search" id="search-input" placeholder="Search cards..." class="gem-search__input">
  <button class="gem-search__clear" onclick="clearSearch()" aria-label="Clear search">&times;</button>
</search>
```

## Step 2: Add search styles

```css
/* styles.css */
.gem-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
}
.gem-search__input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--gem-bg-light);
  border: 1px solid var(--gem-border--subtle);
  border-radius: 0.5rem;
  color: var(--gem-text--primary);
}
```

## Files Modified
- `index.html` — search element
- `styles.css` — search styles

## Verification
```bash
# Screen reader — should announce as search region
# Chrome 123+, Firefox 129+, Safari 17.4+
```
