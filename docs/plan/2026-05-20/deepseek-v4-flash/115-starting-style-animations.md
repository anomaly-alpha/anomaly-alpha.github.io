# Plan 115: `@starting-style` for Entry Animations

**Gap:** Entry animations (card fade-in) run on page load. Elements dynamically shown later (modals, toasts, revealed codes) animate from their current state, not from a "starting" state. `@starting-style` lets CSS define the initial state for all entry animations.

**Best practice (web.dev):** Use `@starting-style` to define the styles applied when an element first renders, enabling smooth transitions for dynamically-displayed content.

---

## Step 1: Apply to modals

```css
.gem-modal--visible {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.3s, transform 0.3s;

  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

---

## Step 2: Apply to toasts

```css
.gem-toast {
  opacity: 1;
  transition: opacity 0.3s, transform 0.3s;

  @starting-style {
    opacity: 0;
    transform: translateY(20px);
  }
}
```

---

## Step 3: Apply to promo code reveals

```css
.gem-code__value {
  opacity: 1;
  transform: rotateY(0deg);
  transition: opacity 0.5s, transform 0.5s;

  @starting-style {
    opacity: 0;
    transform: rotateY(90deg);
  }
}
```

---

## Step 4: Test dynamic insertion

```js
// Create a toast dynamically — @starting-style handles the entry animation
showToast('Hello!', 'success');
// Toast appears with fade+slide-up animation, no JS needed
```

---

## Files Modified: `styles.css`
