# Plan 22: Dependabot + Repository Health

**Problem:** The repository has no automated dependency management (Dependabot), no issue templates, no contributing guide, and no ownership file. This makes it harder for contributors to participate and for maintainers to track dependency updates.

**Goal:** Add Dependabot configuration, issue/PR templates, CONTRIBUTING.md, and CODEOWNERS for a healthier open-source repository.

---

## Step 1: Dependabot configuration

**File: `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
    commit-message:
      prefix: "chore"
      prefix-development: "chore"
    reviewers:
      - "anomaly-alpha"
```

---

## Step 2: Bug report template

**File: `.github/ISSUE_TEMPLATE/bug_report.md`**

```md
---
name: Bug report
about: Report incorrect gem calculations or display issues
title: ''
labels: bug
assignees: ''
---

## Describe the bug
A clear description of what's wrong.

## To Reproduce
1. Go to '...'
2. Select league '...' and rank '...'
3. See error

## Expected behavior
What should happen instead.

## Screenshots
If applicable, add screenshots.

## Environment
- Device: [e.g. iPhone 14, Desktop]
- OS: [e.g. iOS 18, macOS 15]
- Browser: [e.g. Chrome 125, Safari 18]
```

---

## Step 3: Feature request template

**File: `.github/ISSUE_TEMPLATE/feature_request.md`**

```md
---
name: Feature request
about: Suggest an improvement for the gem calculator
title: ''
labels: enhancement
assignees: ''
---

## Problem
What doesn't the calculator do that it should?

## Solution
How would you want this to work?

## Alternative approaches
What else have you considered?

## Additional context
Screenshots, mockups, or references.
```

---

## Step 4: Pull request template

**File: `.github/PULL_REQUEST_TEMPLATE.md`**

```md
## Summary
Brief description of changes.

## Changes
- List specific changes made

## Testing
How was this tested? (manual browser check, npm test, etc.)

## Related issues
Closes #(issue number)

## Screenshots
If UI changes were made.
```

---

## Step 5: CONTRIBUTING.md

**File: `CONTRIBUTING.md`** (root)

```md
# Contributing to Gem Rewards Calculator

## Quick Start
1. Fork and clone the repo
2. `npm install && npm run build`
3. Open `index.html` in your browser

## Development
- Edit `script.src.js` (not `script.js` which is minified)
- Run `npm run dev` for unminified builds with source maps
- Run `npm run watch` for auto-rebuild on file changes

## Pull Request Checklist
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run validate:html` — no HTML errors
- [ ] Run `npm run lint` — no lint errors
- [ ] Tested in Chrome and Safari
- [ ] Tested on mobile viewport

## Code Conventions
- JS: `function` declarations, camelCase, no imports/exports
- CSS: BEM naming (`.gem-block__element--modifier`)
- Config: inline JSON in HTML, loaded via `loadConfig(id)`
- No `fetch()` — all data inline in HTML
- No CDN dependencies — all assets self-hosted

## Questions?
Open a discussion or issue.
```

---

## Step 6: CODEOWNERS

**File: `.github/CODEOWNERS`**

```
# Default owners for everything
* @anomaly-alpha

# Build configuration
package.json @anomaly-alpha
tailwind.config.js @anomaly-alpha

# Documentation
*.md @anomaly-alpha
docs/ @anomaly-alpha
```

---

## Step 7: GitHub config directory

If creating `.github/` directory for the first time:

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

---

## Step 8: Verify Dependabot (requires push to default branch)

After pushing `.github/dependabot.yml` to `main`:
1. Go to GitHub → Insights → Dependency graph → Dependabot
2. Verify Dependabot is enabled and configured
3. Check for pending dependency update PRs on next Monday

---

## Files Created

| File | Status |
|------|--------|
| `.github/dependabot.yml` | **New** |
| `.github/ISSUE_TEMPLATE/bug_report.md` | **New** |
| `.github/ISSUE_TEMPLATE/feature_request.md` | **New** |
| `.github/PULL_REQUEST_TEMPLATE.md` | **New** |
| `.github/CODEOWNERS` | **New** |
| `CONTRIBUTING.md` | **New** |

---

## Verification

```bash
# Validate YAML syntax:
node -e "require('js-yaml').load(require('fs').readFileSync('.github/dependabot.yml','utf8'))" && echo "✓ Valid YAML"
# Validate Dependabot config:
# https://dependabot.com/docs/config-file/validator/
```
