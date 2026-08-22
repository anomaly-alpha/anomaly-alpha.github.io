# Plan 103: Fetch Metadata Validation

**Problem:** No server-side request validation exists. Fetch Metadata request headers can help detect and block cross-site request forgery and other attacks.

**Goal:** Document Fetch Metadata requirements for any future backend integration.

---

## Step 1: Create Fetch Metadata documentation

```markdown
# docs/FETCH_METADATA.md

## Fetch Metadata Request Headers

When a backend is added, validate these headers:

### Sec-Fetch-Site
- `same-origin` — expected for all requests
- `none` — expected for direct navigation
- Reject: `cross-site`, `same-site`

### Sec-Fetch-Mode
- `navigate` — page loads
- `no-cors` — resource loads
- Reject: other modes from unexpected sources

### Sec-Fetch-Dest
- `document` — page loads
- `script` — JS loads
- `style` — CSS loads
- `font` — font loads
- `image` — image loads

### Sec-Fetch-User
- `?1` — user-initiated navigation
```

## Step 2: Add to CSP

```
# _headers — add to existing CSP
navigate-to 'self'
```

## Files Modified
- `docs/FETCH_METADATA.md` — new file
- `_headers` — navigate-to directive

## Verification
```bash
# DevTools > Network — check Sec-Fetch-* headers on requests
# All should be same-origin
```
