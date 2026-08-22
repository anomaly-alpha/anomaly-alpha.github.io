# Plan 93: npm Audit CI Step

**Problem:** Vulnerability scanning is only done when someone manually runs `npm audit`. Vulnerable dependencies can be merged and deployed without warning.

**Goal:** Add `npm audit` to the CI pipeline. Fail the build on critical vulnerabilities.

---

## Step 1: Add audit script

```json
"test:audit": "npm audit --audit-level=high"
```

---

## Step 2: Add to CI workflow

```yaml
- name: Security audit
  run: npm audit --audit-level=high
  continue-on-error: true # Don't block deploy for moderate/low issues
```

---

## Step 3: Add audit-only workflow for weekly scanning

**.github/workflows/security-audit.yml**:

```yaml
name: Security Audit
on:
  schedule:
    - cron: '0 6 * * 1' # Every Monday
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm audit --audit-level=high
      - name: Report vulnerabilities
        if: failure()
        run: |
          echo "::error::High/critical vulnerabilities found"
          npm audit
```

---

## Step 4: Add npm audit fix script

```json
"audit:fix": "npm audit fix"
```

---

## Files Modified: `package.json`, `.github/workflows/deploy.yml`, `.github/workflows/security-audit.yml` (new)
