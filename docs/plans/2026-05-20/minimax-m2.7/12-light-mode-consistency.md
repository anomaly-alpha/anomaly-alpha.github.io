# Plan 12: Light Mode Consistency Check

**Problem:** Light mode is defined via `:root.light-mode` token overrides, but no systematic review has been done. Components like modals, alerts, charts, and the countdown timer may have hardcoded dark-mode values that break in light mode.

**Goal:** Systematically test every component in light mode and fix token violations. Verified by toggling light mode and seeing no dark-only colors.

---

## Step 1: Audit all hardcoded colors in styles.css
Search for hex colors and rgba values that should be using design tokens:

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha
grep -n '#ff6b35\|#e91e8a\|#f39c12\|#2ecc71\|#00e5ff\|#050a14\|#0a1628\|#0d1f3c' styles.css | head -50
```

Every match that is NOT a token reference (e.g., `--gem-event`) needs review.

## Step 2: Check critical components in light mode
Add a temporary debug button to toggle light mode, then screenshot each component:

```javascript
// Add to index.html temporarily:
<button onclick="document.body.classList.toggle('light-mode')" style="position:fixed;top:0;right:0;z-index:9999;padding:8px 16px;background:#fff;color:#000">Toggle Light</button>
```

Check these in light mode:
1. **Card backgrounds**: Should be `rgba(0, 229, 255, 0.15)`, not dark `#0a1628`
2. **Modal overlay**: Should be `rgba(0, 0, 0, 0.50)`, not `rgba(0, 0, 0, 0.70)`
3. **Chart background**: If charts have a dark background, they need light mode override
4. **Countdown timer**: Check digits and labels
5. **Alert/demotion box**: Should use light mode danger colors

## Step 3: Fix token violations
For any component using hardcoded dark-mode values, replace with the correct token:

```css
/* BEFORE (hardcoded dark) */
.gem-modal__overlay {
  background: rgba(0, 0, 0, 0.70);
}

/* AFTER (uses token) */
.gem-modal__overlay {
  background: var(--gem-modal-overlay);
}
```

If no token exists for the use case, add one to `styles.css` in the `:root.light-mode` section.

## Files Modified
- `styles.css` — fix token violations in light mode
- `index.html` — add debug toggle button (temporary, remove after audit)

## Verification
```bash
# Open index.html, toggle light mode, visually inspect every component
# All should be legible, no dark-only colors
```