# Plan 66: Code Splitting Per Guide Page

**Problem:** Every page loads the same `script.js` which contains all functions — PvP calculators, chart code, modals, etc. Guide pages only need a subset but download the full 29 KB.

**Goal:** Split `script.js` into a shared core and page-specific modules. Only load what each page needs.

---

## Step 1: Audit what each page actually needs

| Feature | Main | Code Guide | Event Guide | PvP Guide | Login Guide | FAQ Guide | Beginners |
|---------|------|------------|-------------|-----------|-------------|-----------|-----------|
| loadConfig | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PvP payouts | ✅ | | | ✅ | | | |
| Charts | ✅ | | | | | | |
| Modal system | ✅ | | | | | | |
| Countdown | ✅ | | | ✅ | | | |
| Promo codes | ✅ | ✅ | | | | | |
| Theme toggle | ✅ | | | | | | |
| State persistence | ✅ | | ✅ | ✅ | | | |

---

## Step 2: Create file structure

```
script.src.js           # Core: loadConfig, utilities (shared by all)
script.main.js          # Main page only: charts, modals, PvP, countdowns
script.guide.js         # Guide pages only: theme toggle, smooth scroll
```

---

## Step 3: Extract core utilities

**`script.src.js`** becomes the shared core:
```js
// ===== CORE =====
function loadConfig(id) { ... }
function loadAllConfigs() { ... }

// Theme (needed everywhere)
function applyTheme(mode) { ... }
```

---

## Step 4: Extract main-page-specific code

**`script.main.js`**:
```js
// Loaded only on index.html
function getPvpPayout() { ... }
function updatePvpCard() { ... }
function initCharts() { ... }
function showCardModal() { ... }
// ... all PvP, chart, modal functions
```

---

## Step 5: Update HTML to load correct scripts

**`index.html`**:
```html
<script src="script.src.js"></script>
<script src="script.main.js"></script>
```

**`guide/*/index.html`**:
```html
<script src="script.src.js"></script>
<script src="script.guide.js"></script>
```

---

## Step 6: Build pipeline adjustment

Update `package.json` to minify all 3 source files:
```json
"build:js": "terser script.src.js script.main.js script.guide.js --compress --mangle --source-map --output script.js"
```

---

## Step 7: Measure savings

```bash
# Before: 29 KB on every page
# After:
#   index.html: 20 KB (core + main) + 9 KB (guide)
#   guide pages: 9 KB (core only)

# Guide pages save ~20 KB each × 6 pages = 120 KB total transfer
```

---

## Files Modified: `script.src.js` (trimmed), `script.main.js` (new), `script.guide.js` (new), `index.html`, `guide/*/index.html`, `package.json`
