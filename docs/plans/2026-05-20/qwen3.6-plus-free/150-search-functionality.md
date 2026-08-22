# Plan 150: Search Functionality

**Problem:** With 9 cards, 6 guides, and lots of content, users may want to search for specific information (e.g., "demotion", "Cecil", "battle pass").

**Goal:** Add client-side search that filters cards and highlights matching guide links.

---

## Step 1: Add search input

```html
<!-- index.html -->
<search class="gem-search" role="search">
  <input type="search" id="search-input" placeholder="Search cards..."
         oninput="searchCards(this.value)" aria-label="Search cards">
</search>
```

## Step 2: Add search logic

```javascript
// script.js
function searchCards(query) {
  query = query.toLowerCase().trim();

  document.querySelectorAll('.gem-card').forEach(function(card) {
    if (!query) {
      card.style.display = '';
      card.style.opacity = '';
      return;
    }

    var text = card.textContent.toLowerCase();
    var title = (card.querySelector('.gem-card__title') || {}).textContent || '';

    if (text.includes(query)) {
      card.style.display = '';
      card.style.opacity = title.toLowerCase().includes(query) ? '1' : '0.6';
    } else {
      card.style.display = 'none';
    }
  });
}
```

## Step 3: Add keyboard shortcut

```javascript
// script.js — in keydown handler
case '/':
  e.preventDefault();
  document.getElementById('search-input').focus();
  break;
```

## Files Modified
- `index.html` — search input
- `script.js` — search logic, keyboard shortcut
- `styles.css` — search styles

## Verification
```bash
npm run build
# Type "pvp" — should show PvP cards, dim others
# Type "login" — should show login cards
# Press / — should focus search input
```
