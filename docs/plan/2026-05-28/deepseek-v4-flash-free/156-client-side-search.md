# Plan 156: Client-Side Full-Text Search for Guides

**Gap:** Guide pages are static content. There's no way to search across all guides for a keyword (e.g., "demotion", "Alliance War", "redeem"). Users must manually scan pages.

**Goal:** Add a lightweight client-side search that indexes guide content and returns results instantly.

---

## Step 1: Build search index

```js
// Build on DOMContentLoaded for guide pages (or include in main page)
var searchIndex = [];

function buildSearchIndex() {
  var pages = [
    { url: '/guide/code/', title: 'Promo Codes Guide', keywords: 'codes promo redeem verification' },
    { url: '/guide/event/', title: 'Event Rewards Guide', keywords: 'the long haul earth defenders ranking' },
    { url: '/guide/pvp/', title: 'PvP Guide', keywords: 'league arena alliance war demotion payout' },
    { url: '/guide/login/', title: 'Login Rewards Guide', keywords: 'daily weekly monthly streak' },
    { url: '/guide/faq/', title: 'FAQ', keywords: 'how many gems per week spend beginners' },
    { url: '/guide/beginners/', title: 'Beginners Guide', keywords: 'new player priority spending' },
  ];

  // Also index section headings from current page
  document.querySelectorAll('main h2, main h3, main h4').forEach(function (h) {
    searchIndex.push({
      url: '#' + (h.id || ''),
      title: h.textContent,
      keywords: h.textContent.toLowerCase()
    });
  });

  searchIndex = searchIndex.concat(pages);
}
```

---

## Step 2: Search function

```js
function searchGuides(query) {
  query = query.toLowerCase().trim();
  if (query.length < 2) return [];

  return searchIndex.filter(function (item) {
    return item.title.toLowerCase().includes(query) ||
           item.keywords.toLowerCase().includes(query);
  }).slice(0, 10);
}
```

---

## Step 3: Search UI

```html
<div class="gem-search">
  <input type="search" id="guide-search"
         placeholder="Search guides..."
         class="gem-input--goal"
         oninput="handleSearch(this.value)"
         aria-label="Search guides">
  <div id="search-results" class="gem-search__results" style="display:none"></div>
</div>
```

---

## Step 4: Render results

```js
function handleSearch(query) {
  var results = searchGuides(query);
  var container = document.getElementById('search-results');
  if (!container) return;

  if (query.length < 2) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  if (results.length === 0) {
    container.innerHTML = '<p class="gem-text--muted text-xs p-2">No results found</p>';
    return;
  }

  container.innerHTML = results.map(function (r) {
    return '<a href="' + r.url + '" class="gem-search__result">' +
      '<span class="gem-text--cyan text-xs">' + r.title + '</span></a>';
  }).join('');
}
```

---

## Step 5: Debounce search input

```js
var searchTimeout;
function handleSearch(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(function () {
    renderSearchResults(query);
  }, 200); // Wait 200ms after typing stops
}
```

---

## Step 6: Style search results

```css
.gem-search { position: relative; }
.gem-search__results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--gem-modal-bg);
  border: 1px solid var(--gem-border--accent);
  border-radius: 6px;
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}
.gem-search__result {
  display: block;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  text-decoration: none;
}
.gem-search__result:hover {
  background: rgba(0,229,255,0.1);
}
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
