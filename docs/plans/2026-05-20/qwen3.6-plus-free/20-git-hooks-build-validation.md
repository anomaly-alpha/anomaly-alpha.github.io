# Plan 20: Git Hooks for Build Validation

**Problem:** Developers can commit unminified or broken code. The build step (`npm run build`) must be run manually before each commit, and it's easy to forget.

**Goal:** Add a pre-commit hook that runs the build and checks for errors before allowing the commit.

---

## Step 1: Create pre-commit hook

```bash
#!/bin/sh
# .husky/pre-commit (or .git/hooks/pre-commit)

echo "Running pre-commit checks..."

# Run build
npm run build
if [ $? -ne 0 ]; then
  echo "Build failed! Commit aborted."
  exit 1
fi

# Check links
npm run check-links
if [ $? -ne 0 ]; then
  echo "Broken links found! Commit aborted."
  exit 1
fi

# Check for uncommitted build artifacts
git diff --cached --name-only | grep -q '\.map$'
if [ $? -eq 0 ]; then
  echo "Warning: Source map files included in commit"
fi

echo "All checks passed ✓"
exit 0
```

## Step 2: Set up Husky (recommended)

```bash
npx husky-init
npm install --save-dev husky
```

```json
// package.json
"husky": {
  "hooks": {
    "pre-commit": "npm run build && npm run check-links"
  }
}
```

## Step 3: Alternative — simple git hook

If not using Husky, create the hook directly:

```bash
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
npm run build && npm run check-links
EOF
chmod +x .git/hooks/pre-commit
```

## Files Modified
- `.husky/pre-commit` — new file (if using Husky)
- `package.json` — husky config

## Verification
```bash
# Make a small change to script.js
git add script.js
git commit -m "test"
# Should run build + link check before commit
```
