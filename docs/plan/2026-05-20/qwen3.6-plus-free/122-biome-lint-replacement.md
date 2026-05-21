# Plan 122: Biome Lint Replacement

**Note:** Conflicts with Plan 09 (ESLint) — choose one. Biome is faster and covers formatting + linting in one tool.

**Problem:** ESLint requires multiple plugins and configuration for a complete setup. Biome provides linting and formatting in a single, fast tool.

**Goal:** Replace ESLint with Biome for faster linting and formatting.

---

## Step 1: Install Biome

```bash
npm install --save-dev @biomejs/biome
npx biome init
```

## Step 2: Configure Biome

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.5.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noDoubleEquals": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    },
    "globals": ["GAME", "REWARDS", "CHARTS", "COUNTDOWN", "UI", "THEME", "Chart"]
  },
  "files": {
    "include": ["script.js"]
  }
}
```

## Step 3: Update scripts

```json
// package.json — replace ESLint scripts
"lint": "biome check script.js",
"lint:fix": "biome check --write script.js",
"format": "biome format --write script.js"
```

## Files Modified
- `biome.json` — new file
- `package.json` — updated scripts

## Verification
```bash
npm run lint
# Should be faster than ESLint
npm run format
# Should format script.js
```
