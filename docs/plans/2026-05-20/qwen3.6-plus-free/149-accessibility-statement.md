# Plan 149: Accessibility Statement

**Problem:** No accessibility statement exists. Users who encounter accessibility barriers have no way to report issues or know what efforts have been made.

**Goal:** Create an accessibility statement page.

---

## Step 1: Create accessibility statement

```markdown
# Accessibility Statement

**Last updated:** May 20, 2026

## Commitment

We are committed to ensuring digital accessibility for all users. We continually improve the user experience for everyone and apply relevant accessibility standards.

## Standards

This site aims to conform to WCAG 2.2 Level AA.

## Features

- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion support
- Focus indicators
- Skip navigation link
- ARIA labels and live regions
- Color-blind friendly chart patterns

## Known Issues

- Chart.js charts may not be fully accessible to screen readers
- Some decorative elements lack text alternatives

## Feedback

We welcome your feedback on the accessibility of this site. Please contact us at [email].

## Technical Specifications

Accessibility relies on:
- HTML5 semantic elements
- ARIA attributes
- CSS media queries (prefers-reduced-motion, prefers-contrast)
- JavaScript for dynamic content updates
```

## Step 2: Link in footer

```html
<!-- index.html — in footer -->
<a href="/accessibility.html" class="gem-footer__link">Accessibility Statement</a>
```

## Files Modified
- `accessibility.html` — new file
- `index.html` — footer link
- All guide pages — footer link

## Verification
```bash
# Visit /accessibility.html
# Should show complete accessibility statement
```
