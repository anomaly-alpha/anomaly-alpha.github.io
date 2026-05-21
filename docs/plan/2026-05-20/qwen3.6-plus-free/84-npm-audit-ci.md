# Plan 84: npm Audit CI Gate

**Problem:** No dependency vulnerability scanning exists in CI. A vulnerable package could be introduced without detection.

**Goal:** Add `npm audit` to the CI pipeline as a blocking check.

---

## Step 1: Add audit script

```json
// package.json
"audit": "npm audit --audit-level=moderate",
"audit:fix": "npm audit fix"
```

## Step 2: Add to CI

```yaml
# .github/workflows/ci.yml
- name: Security audit
  run: npm audit --audit-level=moderate
```

## Step 3: Allow known vulnerabilities

If a known vulnerability can't be fixed immediately, create an `.npm-auditrc`:

```json
{
  "audit-level": "moderate",
  "exceptions": [
    {
      "id": 1234,
      "reason": "Dev dependency only, no production impact",
      "expires": "2026-06-01"
    }
  ]
}
```

## Files Modified
- `package.json` — audit scripts
- `.github/workflows/ci.yml` — audit step

## Verification
```bash
npm run audit
# Should pass or show specific vulnerabilities to address
```
