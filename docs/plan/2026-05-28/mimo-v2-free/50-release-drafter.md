# Plan 50: Release Drafter Automation

**Problem:** There are no releases or version tags. When changes are made, there's no way to track "this deployment includes these changes" without reading git log.

**Goal:** Add Release Drafter — a GitHub Action that automatically drafts release notes from merged PRs. Add version tagging to the build.

---

## Step 1: Create Release Drafter config

**File: `.github/release-drafter.yml`**

```yaml
name-template: 'v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'
categories:
  - title: '🚀 Features'
    labels:
      - 'feat'
      - 'enhancement'
      - 'feature'
  - title: '🐛 Bug Fixes'
    labels:
      - 'fix'
      - 'bug'
  - title: '⚡ Performance'
    labels:
      - 'perf'
      - 'performance'
  - title: '♿ Accessibility'
    labels:
      - 'a11y'
      - 'accessibility'
  - title: '🔍 SEO'
    labels:
      - 'seo'
  - title: '📖 Content'
    labels:
      - 'content'
  - title: '📝 Documentation'
    labels:
      - 'docs'
      - 'documentation'
  - title: '🔧 Maintenance'
    labels:
      - 'chore'
      - 'refactor'
      - 'dependencies'
change-template: '- $TITLE (#$NUMBER)'
change-title-escapes: '\<*_&'
version-resolver:
  major:
    labels:
      - 'major'
  minor:
    labels:
      - 'minor'
      - 'feat'
      - 'enhancement'
  patch:
    labels:
      - 'fix'
      - 'bug'
      - 'perf'
      - 'a11y'
      - 'seo'
      - 'content'
      - 'docs'
      - 'chore'
      - 'refactor'
      - 'dependencies'
  default: patch
template: |
  ## What's Changed

  $CHANGES

  **Full Changelog:** https://github.com/$OWNER/$REPOSITORY/compare/$PREVIOUS_TAG...v$RESOLVED_VERSION
```

---

## Step 2: Create Release Drafter workflow

**File: `.github/workflows/release-drafter.yml`**

```yaml
name: Release Drafter

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, reopened, synchronize, labeled, unlabeled]

permissions:
  contents: read

jobs:
  update_release_draft:
    permissions:
      contents: write
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Step 3: Add version to the site build

**In `package.json`**, add a version field if not present:

```json
{
  "name": "gem-rewards-calculator",
  "version": "2.0.0",
  "private": true
}
```

---

## Step 4: Display version in the footer

**In `index.html`** footer:

```html
<p class="gem-text--muted text-xs">
  v<span id="app-version">2.0.0</span>
  &middot; Data last verified: <span class="gem-text--cyan">May 20, 2026</span>
</p>
```

Auto-update version during build:

```js
// In scripts/update-version.js (from Plan 28):
var pkg = JSON.parse(fs.readFileSync('package.json'));
// Update version in footer
html = html.replace(
  /v<span id="app-version">[^<]+<\/span>/,
  'v<span id="app-version">' + pkg.version + '</span>'
);
```

---

## Step 5: Create first release

After merging the release drafter config:

1. Go to GitHub → Releases → "Draft a Release"
2. Review auto-generated notes from Release Drafter
3. Click "Publish Release"
4. This creates tag `v1.0.0` (or whatever version)

---

## Step 6: Add release badge to README

```md
[![Latest Release](https://img.shields.io/github/v/release/anomaly-alpha/anomaly-alpha.github.io)](https://github.com/anomaly-alpha/anomaly-alpha.github.io/releases)
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `.github/release-drafter.yml` | **New** |
| `.github/workflows/release-drafter.yml` | **New** |
| `package.json` | Ensure version field exists |
| `scripts/update-version.js` | Add version auto-update |
| `index.html` | Add version to footer |
| `guide/*/index.html` (×6) | Add version to footer |
| `404.html` | Add version to footer |
| `README.md` | Add release badge |

---

## Verification

```bash
# After PR merge to main:
# 1. GitHub Actions runs Release Drafter
# 2. Draft release appears at:
#    https://github.com/anomaly-alpha/anomaly-alpha.github.io/releases
# 3. Contains all merged PRs since last release
# 4. Version is auto-incremented based on labels
```
