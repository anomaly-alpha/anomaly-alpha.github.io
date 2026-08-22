# Plan 09: ESLint Configuration

**Problem:** No linting exists for `script.js`. The single JS file has ~40 functions in global scope with no automated style or error checking. Inconsistencies in naming, missing semicolons, and potential bugs go undetected.

**Goal:** Add ESLint with a minimal config that enforces ES5-compatible rules, catching common errors without requiring module syntax.

---

## Step 1: Install ESLint

```bash
npm install --save-dev eslint
```

## Step 2: Create ESLint config

```json
// .eslintrc.json
{
  "env": {
    "browser": true,
    "es6": false
  },
  "parserOptions": {
    "ecmaVersion": 5
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-undef": "error",
    "semi": ["error", "always"],
    "eqeqeq": "warn",
    "no-console": "off",
    "no-var": "off",
    "prefer-const": "off",
    "indent": ["warn", 2],
    "quotes": ["warn", "single"],
    "comma-dangle": ["warn", "never"],
    "no-trailing-spaces": "warn",
    "eol-last": "warn"
  },
  "globals": {
    "GAME": "readonly",
    "REWARDS": "readonly",
    "CHARTS": "readonly",
    "COUNTDOWN": "readonly",
    "UI": "readonly",
    "THEME": "readonly",
    "Chart": "readonly",
    "loadConfig": "readonly",
    "loadAllConfigs": "readonly"
  }
}
```

## Step 3: Add lint script

```json
// package.json
"lint": "eslint script.js",
"lint:fix": "eslint script.js --fix"
```

## Step 4: Add lint to build

```json
"build": "npm run lint && tailwindcss ..."
```

## Files Modified
- `.eslintrc.json` — new file
- `package.json` — lint scripts, build integration

## Verification
```bash
npm run lint
# Should show warnings for style issues, errors for bugs
npm run lint:fix
# Should auto-fix style issues
```
