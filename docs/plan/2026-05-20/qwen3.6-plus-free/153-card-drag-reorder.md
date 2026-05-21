# Plan 153: Card Drag Reorder

**Problem:** Users may want to reorder cards to prioritize the sources they care about most. Drag-and-drop reordering enables personalization.

**Goal:** Add drag-and-drop card reordering with localStorage persistence.

---

## Step 1: Add drag attributes

```html
<!-- Each card -->
<div class="gem-card" draggable="true"
     ondragstart="onDragStart(event)"
     ondragover="onDragOver(event)"
     ondrop="onDrop(event)">
```

## Step 2: Add drag handlers

```javascript
// script.js
var dragSource = null;

function onDragStart(e) {
  dragSource = e.target.closest('.gem-card');
  e.dataTransfer.effectAllowed = 'move';
  dragSource.style.opacity = '0.5';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDrop(e) {
  e.preventDefault();
  var target = e.target.closest('.gem-card');
  if (!target || target === dragSource) return;

  var grid = document.querySelector('.gem-grid--cards');
  var cards = Array.from(grid.querySelectorAll('.gem-card'));
  var sourceIndex = cards.indexOf(dragSource);
  var targetIndex = cards.indexOf(target);

  if (sourceIndex < targetIndex) {
    grid.insertBefore(dragSource, target.nextSibling);
  } else {
    grid.insertBefore(dragSource, target);
  }

  dragSource.style.opacity = '';
  saveCardOrder();
}
```

## Step 3: Save/load order

```javascript
// script.js
function saveCardOrder() {
  var cards = document.querySelectorAll('.gem-grid--cards .gem-card');
  var order = Array.from(cards).map(function(c) { return c.dataset.card; });
  localStorage.setItem('gem_card_order', JSON.stringify(order));
}

function loadCardOrder() {
  var order = JSON.parse(localStorage.getItem('gem_card_order') || 'null');
  if (!order) return;

  var grid = document.querySelector('.gem-grid--cards');
  order.forEach(function(cardId) {
    var card = grid.querySelector('[data-card="' + cardId + '"]');
    if (card) grid.appendChild(card);
  });
}
```

## Files Modified
- `index.html` — drag attributes on cards
- `script.js` — drag handlers, save/load order

## Verification
```bash
npm run build
# Drag a card to new position — should reorder
# Reload — order should be restored
```
