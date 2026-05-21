# Plan 92: Renovate Dependency Updates

**Problem:** Dependabot (Plan 22) handles dependency updates, but Renovate offers more flexibility: grouping, schedules, automerge, and a config file in the repo.

**Goal:** Add Renovate configuration as an alternative or complement to Dependabot.

---

## Step 1: Create Renovate config

**File: `renovate.json`**:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "schedule": ["before 9am on monday"],
  "timezone": "America/New_York",
  "labels": ["dependencies"],
  "assignees": ["anomaly-alpha"],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchDepTypes": ["devDependencies"],
      "automerge": true,
      "groupName": "devDependencies"
    },
    {
      "matchPackageNames": ["chart.js"],
      "labels": ["dependencies", "vendor"],
      "reviewers": ["anomaly-alpha"]
    }
  ],
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "assignees": ["anomaly-alpha"]
  }
}
```

---

## Step 2: Add Renovate badge to README

```md
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen?logo=renovatebot)](https://renovate.whitesourcesoftware.com/)
```

---

## Step 3: Remove Dependabot (optional)

If using Renovate instead of Dependabot, delete `.github/dependabot.yml`.

---

## Files Created: `renovate.json`
