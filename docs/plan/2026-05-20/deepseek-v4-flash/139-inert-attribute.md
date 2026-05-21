# Plan 139: `inert` Attribute for Modal Backdrop

**Gap:** When a modal is open, users can still Tab to elements behind the modal. The focus trap (Plan 04) handles Tab cycling but doesn't prevent screen reader access to background content.

**Best practice (HTML spec):** Use the `inert` attribute on all sibling elements when a modal is open. This makes the entire background non-interactive and invisible to assistive technology.

---

## Step 1: Apply inert to background

```js
function showCardModal(cardId) {
  // Inert all siblings of the modal
  var main = document.querySelector('main');
  var siblings = [];
  var parent = main.parentElement;
  for (var i = 0; i < parent.children.length; i++) {
    var child = parent.children[i];
    if (child !== main && child !== document.querySelector('.gem-modal--visible')) {
      child.inert = true;
      siblings.push(child);
    }
  }

  // Store for cleanup
  modal._inertedElements = siblings;
}

function closeCardModal() {
  // Remove inert from all previously-inerted elements
  if (modal._inertedElements) {
    modal._inertedElements.forEach(function (el) { el.inert = false; });
  }
}
```

---

## Step 2: CSS for inert state

```css
[inert] {
  user-select: none;
  pointer-events: none;
  /* Keep visual appearance but prevent interaction */
}
```

---

## Step 3: Test with screen reader

```bash
# Open modal
# Try to Tab to background — should skip all inert elements
# VoiceOver/TalkBack should only announce modal content
# Close modal — background is interactive again
```

---

## Files Modified: `script.js`, `styles.css`
