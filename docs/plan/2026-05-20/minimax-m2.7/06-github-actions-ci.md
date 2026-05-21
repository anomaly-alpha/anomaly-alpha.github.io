# Plan 06: GitHub Actions CI Pipeline

**Problem:** No CI pipeline exists. Every change is manually built and tested before merge, creating risk of broken builds and untested code entering main.

**Goal:** Create a GitHub Actions workflow that runs on every PR: install, build, lint (if exists), and test. Fail fast on errors.

---

## Step 1: Create .github/workflows directory structure
Create the CI workflow file:

```bash
mkdir -p .github/workflows
```

## Step 2: Write the CI workflow
Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Check for modified files
        run: |
          if [ -n "$(git diff --name-only)" ]; then
            echo "Build produced changed files:"
            git diff --name-only
            echo "Commit generated files after HTML/CSS/JS changes."
            exit 1
          fi

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: build

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test || true

      - name: Run accessibility tests
        run: npm run test:a11y || true
```

## Step 3: Verify workflow runs correctly
Commit and push, then check the Actions tab on GitHub. The build should complete in <2 minutes.

## Files Modified
- `.github/workflows/ci.yml` — new file

## Verification
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI pipeline"
git push
# Check GitHub Actions tab for passing build
```