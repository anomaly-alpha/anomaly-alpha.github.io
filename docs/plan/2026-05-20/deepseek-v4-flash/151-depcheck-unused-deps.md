# Plan 151: Depcheck for Unused Dependencies

**Gap:** `package.json` lists 3 dev dependencies (tailwindcss, csso, terser) plus potential additions from plans. Over time, some may become unused as tools change.

**Best practice (npm):** Run `depcheck` to find unused and missing dependencies. Integrate into CI.

---

## Step 1: Install depcheck

```bash
npm install -D depcheck
```

---

## Step 2: Run baseline

```bash
npx depcheck --ignores="depcheck"
```

---

## Step 3: Address findings

```bash
# Remove unused dependencies:
npm uninstall <package-name>

# Add missing dependencies (used in code but not in package.json):
npm install <package-name>
```

---

## Step 4: Add to CI

```yaml
- name: Check dependency usage
  run: npx depcheck --ignores="depcheck,lightningcss,biome"
```

---

## Step 5: Add npm script

```json
"check:deps": "npx depcheck --ignores=\"depcheck,lightningcss,biome\""
```

---

## Files Modified: `package.json`, `.github/workflows/deploy.yml`
