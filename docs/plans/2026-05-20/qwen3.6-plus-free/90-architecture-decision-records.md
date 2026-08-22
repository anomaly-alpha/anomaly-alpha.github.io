# Plan 90: Architecture Decision Records

**Problem:** Key architectural decisions (no fetch, no CDN, ES5 only, inline JSON) are documented in AGENTS.md but not as formal ADRs. Future maintainers need to understand why these decisions were made.

**Goal:** Create ADRs for key architectural decisions.

---

## Step 1: Create ADR directory and template

```
docs/adr/
├── 0001-no-fetch-architecture.md
├── 0002-no-cdn-dependencies.md
├── 0003-es5-only-javascript.md
├── 0004-inline-json-configs.md
├── 0005-bem-css-naming.md
└── 0006-chart-js-lazy-loading.md
```

## Step 2: Create first ADR

```markdown
# ADR-0001: No Fetch Architecture

**Status:** Accepted
**Date:** 2026-01-15

## Context

The calculator needs to work from `file://` URLs for local development and offline access. Using `fetch()` would require a server and break local file access.

## Decision

All data is embedded as inline `<script type="application/json">` tags in the HTML. The `loadConfig(id)` function parses these at runtime.

## Consequences

- **Positive:** Works from file://, zero network requests for data, instant loading
- **Negative:** HTML file is larger (~114KB), data updates require HTML edit
- **Mitigation:** HTML is served compressed; data updates are infrequent
```

## Files Modified
- `docs/adr/*.md` — new ADR files (6)

## Verification
```bash
ls docs/adr/
# Should show 6 ADR files
```
