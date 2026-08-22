# Plan 119: Custom Scrollbar Styling

**Gap:** The site's sci-fi aesthetic extends to borders, gradients, and particles — but scrollbars remain the OS default. Custom scrollbars complete the visual theme.

**Best practice (web.dev):** Use CSS `scrollbar-color` and `scrollbar-width` (baseline 2024) instead of the legacy `::-webkit-scrollbar` pseudo-elements.

---

## Step 1: Apply consistent scrollbar styling

```css
/* Modern approach (Firefox + Chrome 121+) */
:root {
  scrollbar-color: rgba(0, 229, 255, 0.3) rgba(0, 0, 0, 0.2);
  scrollbar-width: thin;
}

/* WebKit fallback for Safari */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 229, 255, 0.5);
}
```

---

## Step 2: Modal-specific scrollbar

```css
.gem-modal__body {
  scrollbar-color: rgba(0, 229, 255, 0.2) transparent;
  scrollbar-width: thin;
}
```

---

## Step 3: Light mode adjustments

```css
.light-mode {
  scrollbar-color: rgba(0, 229, 255, 0.4) rgba(0, 0, 0, 0.05);
}
```

---

## Files Modified: `styles.css`
