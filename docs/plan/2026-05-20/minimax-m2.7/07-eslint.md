# Plan 07: ESLint Configuration

**Problem:** script.js has no consistent code style enforcement. No linting exists, so style issues (unused vars, implied globals, inconsistent formatting) accumulate silently.

**Goal:** Add ESLint with an ES5-compatible config and a minimal rule set, fix all errors, and add to CI.

---

## Step 1: Install ESLint and initialize
Install ESLint and its default config:

```bash
npm install --save-dev eslint @eslint/js globals
```

## Step 2: Create .eslintrc.json
Create `.eslintrc.json` with ES5-compatible rules:

```json
{
  "env": {
    "browser": true,
    "es5": true,
    "commonjs": true
  },
  "globals": {
    "GAME": "readonly",
    "REWARDS": "readonly",
    "CHARTS": "readonly",
    "COUNTDOWN": "readonly",
    "UI": "readonly",
    "THEME": "readonly",
    "SVG_CHEVRON_UP": "readonly",
    "SVG_CHEVRON_DOWN": "readonly",
    "SVG_CHECK_CIRCLE": "readonly",
    "SVG_INFO_CIRCLE": "readonly",
    "SVG_EXCLAMATION_TRIANGLE": "readonly",
    "selectedModes": "writable",
    "currentChartFilter": "writable",
    "charts": "writable"
  },
  "extends": ["@eslint/js"],
  "rules": {
    "no-unused-vars": "warn",
    "no-implied-eval": "error",
    "no-new-wrappers": "error",
    "radix": "error",
    "eqeqeq": ["error", "always"],
    "semi": ["error", "always"],
    "comma-dangle": ["error", "never"],
    "quotes": ["error", "single", { "avoidEscape": true }]
  }
}
```

## Step 3: Add lint script and fix errors
Add to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint script.js",
    "lint:fix": "eslint script.js --fix"
  }
}
```

Run lint to see all errors:

```bash
npm run lint
```

Fix common issues: add `"use strict";` at the top of `script.js`, fix any `==` → `===`, add missing semicolons. Many will be auto-fixable with `--fix`.

## Step 4: Add to CI
Add to `.github/workflows/ci.yml` after the build step:

```yaml
      - name: Lint
        run: npm run lint
```

## Files Modified
- `.eslintrc.json` — new file
- `package.json` — add lint scripts
- `script.js` — fix lint errors
- `.github/workflows/ci.yml` — add lint step

## Verification
```bash
npm run lint
# 0 errors
```