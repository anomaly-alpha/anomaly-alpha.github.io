# Plan 91: Danger JS Automated PR Review

**Problem:** PRs are reviewed manually. Common issues (missing CHANGELOG entry, large file changes, missing labels, stale docs) must be caught by human reviewers.

**Goal:** Add Danger JS that runs on every PR and automatically comments with warnings about common issues.

---

## Step 1: Install Danger JS

```bash
npm install -D danger
```

---

## Step 2: Create Dangerfile

**File: `dangerfile.js`**:

```js
import { danger, warn, fail, markdown } from 'danger';

const pr = danger.github.pr;
const modified = danger.git.modified_files;
const created = danger.git.created_files;

// 1. Check for CHANGELOG entry
const hasChangelog = modified.includes('CHANGELOG.md');
if (!hasChangelog) {
  warn('No CHANGELOG.md entry. Please add a note about this change.');
}

// 2. Check file size
const bigFiles = danger.git.fileMatch;
modified.forEach(file => {
  const content = danger.git.diffForFile(file);
  if (content && content.added > 300) {
    warn(`${file} has ${content.added} lines added. Consider splitting.`);
  }
});

// 3. Check PR description
if (!pr.body || pr.body.length < 10) {
  warn('PR description is too short. Please describe what and why.');
}

// 4. Check for missing labels
if (pr.labels.length === 0) {
  warn('No labels set. Please add a label (feat, fix, chore, etc.).');
}

// 5. Check for TODO comments
const todoPattern = /TODO|FIXME|HACK/g;
modified.forEach(file => {
  const content = danger.git.fileContent(file);
  if (content && todoPattern.test(content)) {
    warn(`${file} contains TODO/FIXME/HACK comments.`);
  }
});

// 6. Auto-generate PR summary from commits
const commits = pr.commits;
if (commits && commits.length > 0) {
  markdown(`## Commits\n${commits.map(c => `- ${c.commit.message.split('\n')[0]}`).join('\n')}`);
}
```

---

## Step 3: Add Danger CI step

**.github/workflows/deploy.yml**:

```yaml
danger:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx danger ci
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Step 4: Run on existing PRs

```bash
# Test locally:
npx danger pr https://github.com/anomaly-alpha/anomaly-alpha.github.io/pull/1
```

---

## Files Created: `dangerfile.js`, `.github/workflows/deploy.yml` (updated)
