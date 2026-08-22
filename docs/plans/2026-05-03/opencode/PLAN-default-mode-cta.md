# Default Mode State + CTA Messaging Plan

## Goals
1. CODE mode NOT active on first load (other modes active)
2. Add CTA encouraging mode selector exploration

## Implementation

### 1. Update CODE button (index.html line 958)
- REMOVE: `active` class from CODE button
- KEEP: `active` on All, Event, PvP, Login buttons

### 2. Add CTA message (index.html ~line 988, before cards)
```html
<p class="gem-cards-cta text-white/50 text-sm text-center mb-4">
  Tap mode buttons above to filter rewards by category
</p>
```

### 3. Add CSS (styles.css)
```css
.gem-cards-cta {
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.05em;
}
```

## Files to Modify
- index.html (2 changes)
- styles.css (1 addition)

## Execution Order
1. Update line 958 in index.html
2. Add CTA message before cards grid
3. Add CSS style
4. Test refresh