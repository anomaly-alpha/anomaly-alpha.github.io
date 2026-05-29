# Plan 132: Biome Migration (Faster Linting)

**Gap:** The project uses ESLint (Plan 09). Biome is a Rust-based alternative that runs 10-100× faster and combines linting, formatting, and import sorting.

**Best practice (Biome docs):** Migrate from ESLint + Prettier to Biome. Single binary, unified config, zero config overhead. Drop-in replacement for most rules.

---

## Step 1: Install Biome

```bash
npm install -D --save-exact @biomejs/biome
npx biome init
```

---

## Step 2: Create biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": false },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "off",
        "noImplicitAnyLet": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": ["vendor/", "node_modules/", "*.min.*", "*.map"]
  }
}
```

---

## Step 3: Remove ESLint/Prettier deps

```bash
npm uninstall eslint prettier eslint-config-prettier
rm .eslintrc.json .prettierrc.json .prettierignore
```

---

## Step 4: Update npm scripts

```json
"lint": "biome lint script.src.js",
"format": "biome format --write .",
"format:check": "biome format .",
"lint:fix": "biome lint --apply script.src.js"
```

---

## Step 5: Run first migration

```bash
npx biome check --apply script.src.js
# Fix any remaining issues
```

---

## Step 6: Measure speed

```bash
time npx eslint script.src.js
time npx biome lint script.src.js
# Biome should be 10-50× faster
```

---

## Files Modified: `package.json` (ESLint/Prettier removed, Biome added), `biome.json` (new), `.eslintrc.json` (removed), `.prettierrc.json` (removed)
