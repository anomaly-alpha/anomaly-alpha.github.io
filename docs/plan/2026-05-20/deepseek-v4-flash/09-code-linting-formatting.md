# Plan 09: Code Linting & Formatting

**Problem:** There is no ESLint or Prettier configuration. Code style is maintained manually. The single minified JS file makes it impossible to see the source code style, and the HTML `onclick` attributes are an implicit convention that could be caught/enforced by tooling.

**Goal:** Add ESLint (with project-specific rules) and Prettier. Configure editor settings. The linter must accommodate the project's conventions (global scope, `onclick`, `function` declarations, etc.) rather than fighting them.

---

## Step 1: Install dependencies

```bash
npm install -D eslint prettier eslint-config-prettier
```

---

## Step 2: Create ESLint config

**File: `.eslintrc.json`**

```json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": ["eslint:recommended", "prettier"],
  "parserOptions": {
    "ecmaVersion": 12
  },
  "globals": {
    "loadConfig": "readonly",
    "loadAllConfigs": "readonly",
    "getPvpPayout": "readonly",
    "filterCards": "readonly",
    "updatePvpCard": "readonly",
    "updateAllPageTotals": "readonly",
    "animateValue": "readonly",
    "updateChartsByModes": "readonly",
    "initializePvPCards": "readonly",
    "showCardModal": "readonly",
    "closeCardModal": "readonly",
    "revealCode": "readonly",
    "toggleCharts": "readonly",
    "loadChartJs": "readonly",
    "initCharts": "readonly",
    "savePageState": "readonly",
    "loadPageState": "readonly",
    "findCardById": "readonly",
    "getModeTotal": "readonly",
    "GAME": "readonly",
    "REWARDS": "readonly",
    "CHARTS": "readonly",
    "COUNTDOWN": "readonly",
    "UI": "readonly",
    "THEME": "readonly",
    "Chart": "readonly"
  },
  "rules": {
    "no-unused-vars": ["warn", { "args": "none" }],
    "no-var": "off",
    "prefer-const": "warn",
    "no-console": "off",
    "no-alert": "warn",
    "eqeqeq": ["warn", "smart"],
    "curly": ["warn", "all"],
    "no-throw-literal": "warn",
    "prefer-template": "off",
    "no-shadow": "warn",
    "no-unused-expressions": "warn",
    "no-lonely-if": "warn"
  },
  "ignorePatterns": ["vendor/", "node_modules/", "*.min.*", "*.map"]
}
```

---

## Step 3: Create Prettier config

**File: `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

**File: `.prettierignore`**

```
vendor/
node_modules/
*.min.*
*.map
tailwind.css
```

---

## Step 4: Add npm scripts

```json
"lint": "eslint script.src.js",
"lint:fix": "eslint script.src.js --fix",
"format": "prettier --write '*.html' 'guide/**/*.html' 'script.src.js' 'styles.css'",
"format:check": "prettier --check '*.html' 'guide/**/*.html' 'script.src.js' 'styles.css'"
```

---

## Step 5: ESLint rules specific to this project

Some project conventions would normally be flagged as warnings. Account for them:

| Convention | ESLint rule | Action |
|------------|-------------|--------|
| Global functions (no ES modules) | `no-implicit-globals` | Warn, not error |
| `onclick` in HTML | `no-eval`-related | Not applicable — `onclick` attributes are the convention |
| `function` declarations (not arrow) | `prefer-arrow-callback` | Turned off |
| `var` keyword | `no-var` | Turned off (project uses `function` + `var` style) |
| Single-letter variable names in minified code | `id-length` | Only lint `script.src.js` (source), not the minified output |
| Long lines from SVG strings | `max-len` | Turn off for template strings containing SVGs |

---

## Step 6: Editor integration

**File: `.vscode/settings.json`**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "prettier.configPath": ".prettierrc.json",
  "eslint.validate": ["javascript"],
  "files.exclude": {
    "**/*.map": true,
    "**/*.min.css": true
  }
}
```

**File: `.vscode/extensions.json`**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ]
}
```

---

## Step 7: Pre-commit hooks (optional, requires `husky`)

```bash
npm install -D husky lint-staged
npx husky init
```

**File: `.husky/pre-commit`**
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**In `package.json`:**
```json
"lint-staged": {
  "script.src.js": ["eslint --fix", "prettier --write"],
  "*.html": ["prettier --write"],
  "styles.css": ["prettier --write"]
}
```

---

## Step 8: First lint run — baseline

```bash
npm run lint
# Review warnings and decide which to fix vs. disable via inline comments
```

Expected initial warnings:
- Unused function parameters (common in event handlers)
- `no-shadow` for variables with similar names
- `prefer-const` for variables that are never reassigned

Fix systematically:
```bash
npm run format     # Fix formatting first
npm run lint:fix   # Auto-fix what ESLint can
npm run lint       # Review remaining warnings
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `.eslintrc.json` | **New** |
| `.prettierrc.json` | **New** |
| `.prettierignore` | **New** |
| `.vscode/settings.json` | **New** |
| `.vscode/extensions.json` | **New** |
| `.husky/pre-commit` | **New** (optional) |
| `package.json` | Add `lint`, `format` scripts, optional `lint-staged` + `husky` |
| `script.src.js` | Fix lint warnings |

---

## Verification

```bash
npm run lint        # No errors, minimal warnings
npm run format:check  # All files formatted
npm run lint:fix    # If any auto-fixable issues
```
