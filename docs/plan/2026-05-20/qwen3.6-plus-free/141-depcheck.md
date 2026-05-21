# Plan 141: depcheck for Unused Dependencies

**Problem:** `package.json` may have dependencies that are no longer used. `depcheck` identifies unused dev dependencies.

**Goal:** Add depcheck to catch unused dependencies.

---

## Step 1: Install depcheck

```bash
npm install --save-dev depcheck
```

## Step 2: Add script

```json
// package.json
"check-deps": "depcheck --ignores=tailwindcss,csso,terser"
```

## Step 3: Add to CI

```yaml
# .github/workflows/ci.yml
- name: Check dependencies
  run: npm run check-deps
```

## Files Modified
- `package.json` — check-deps script

## Verification
```bash
npm run check-deps
# Should show no unused dependencies
```
