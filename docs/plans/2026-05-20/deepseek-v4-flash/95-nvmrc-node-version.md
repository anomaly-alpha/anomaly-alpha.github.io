# Plan 95: nvmrc for Node Version Pinning

**Problem:** `package.json` specifies dev dependencies but no minimum Node version. If a contributor uses an older or incompatible Node, builds may fail with confusing errors.

**Goal:** Add `.nvmrc` and `engines` field to pin Node version.

---

## Step 1: Create .nvmrc

**File: `.nvmrc`**:

```
20
```

---

## Step 2: Add engines field to package.json

```json
"engines": {
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```

---

## Step 3: Add Node version check script

**File: `scripts/check-node.js`**:

```js
var pkg = require('../package.json');
var semver = require('semver');
var nodeVersion = process.version;

if (pkg.engines && pkg.engines.node) {
  if (!semver.satisfies(nodeVersion, pkg.engines.node)) {
    console.error(
      '✗ Node ' + nodeVersion + ' is not supported.\n' +
      '  Required: ' + pkg.engines.node + '\n' +
      '  Use nvm to switch: nvm use'
    );
    process.exit(1);
  }
  console.log('✓ Node ' + nodeVersion + ' (compatible with ' + pkg.engines.node + ')');
}
```

---

## Step 4: Add to prebuild

```json
"prebuild": "node scripts/check-node.js && node scripts/update-version.js && node scripts/hash-assets.js"
```

---

## Step 5: Add nvm convenience scripts

```json
"nvm:install": "nvm install",
"nvm:use": "nvm use"
```

---

## Files Created: `.nvmrc`, `scripts/check-node.js`
