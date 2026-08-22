# Plan 83: Renovate Configuration

**Problem:** Dependencies (tailwindcss, csso, terser) are not automatically updated. Security patches and feature updates require manual checking.

**Goal:** Add Renovate bot configuration for automated dependency updates.

---

## Step 1: Create renovate.json

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["every weekend"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "branch"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["major-update"]
    }
  ],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["every weekend"]
  }
}
```

## Step 2: Enable Renovate on GitHub

Install Renovate bot on the repository via GitHub Apps.

## Files Modified
- `renovate.json` — new file

## Verification
```bash
# Renovate will create PRs automatically
# Check PRs for dependency updates
```
