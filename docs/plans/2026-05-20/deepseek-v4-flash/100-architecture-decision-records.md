# Plan 100: Architecture Decision Records (ADRs)

**Problem:** Key architectural decisions (why no fetch(), why inline JSON, why self-hosted assets, why onclick attributes) are implicit in the code but undocumented. Future contributors must reverse-engineer the reasoning.

**Goal:** Create a set of ADRs documenting the rationale behind major architectural choices.

---

## Step 1: Create ADR directory

```bash
mkdir -p docs/adr
```

---

## Step 2: Create ADR template

**File: `docs/adr/ADR-000-template.md`**:

```md
# ADR-000: [Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Date:** YYYY-MM-DD
**Author:** [Name]

## Context
What's the problem this decision addresses?

## Decision
What was chosen?

## Rationale
Why was this chosen over alternatives?

## Consequences
What are the trade-offs? What becomes easier or harder?

## Alternatives Considered
- Option 1: ...
- Option 2: ...

## References
- Link to related code, issues, or discussions
```

---

## Step 3: Write ADR-001 — No fetch() architecture

**File: `docs/adr/ADR-001-no-fetch.md`**:

```md
# ADR-001: No fetch() — Inline JSON Config Architecture

**Status:** Accepted
**Date:** 2026-05-01
**Author:** Anomaly

## Context
The calculator needs data (leagues, arenas, payouts, cards, codes) loaded at runtime. Options: fetch from server, inline in HTML, or bundled in JS.

## Decision
Embed all config data as inline `<script type="application/json">` tags in the HTML `<head>`.

## Rationale
- Works from `file://` protocol (no server needed)
- Zero network requests for data (fast initial load)
- Single deployable artifact (HTML contains all data)
- Easy to audit data by viewing page source

## Consequences
- HTML files are larger (~114 KB for index.html)
- Data cannot be updated without a full deploy
- Config parsing uses simple `loadConfig(id)` helper

## Alternatives Considered
- Fetch from `/data/*.json`: requires a server, breaks `file://` usage
- Inline in JS object: harder to audit, not validatable
- Server-side API: overengineered for a static site

## References
- `index.html` lines 35-766 (7 inline configs)
- `script.js` `loadConfig()` function
```

---

## Step 4: Write ADR-002 — Self-hosted assets (zero CDN)

**File: `docs/adr/ADR-002-self-hosted-assets.md`**

---

## Step 5: Write ADR-003 — onclick HTML attributes

**File: `docs/adr/ADR-003-onclick-attributes.md`**

---

## Step 6: Write ADR-004 — Single JS file, global scope

**File: `docs/adr/ADR-004-single-js-global.md`**

---

## Step 7: Write ADR-005 — Dark mode via CSS custom properties

**File: `docs/adr/ADR-005-dark-mode-css-custom-props.md`**

---

## Step 8: Reference ADRs from CONTEXT.md

Add a section at the bottom of `CONTEXT.md`:

```md
## Architecture Decision Records

See `docs/adr/` for documented architectural decisions:

- [ADR-001](docs/adr/ADR-001-no-fetch.md): No fetch() — inline JSON configs
- [ADR-002](docs/adr/ADR-002-self-hosted-assets.md): Zero CDN dependencies
- [ADR-003](docs/adr/ADR-003-onclick-attributes.md): onclick HTML attributes
- [ADR-004](docs/adr/ADR-004-single-js-global.md): Single JS file, global scope
- [ADR-005](docs/adr/ADR-005-dark-mode-css-custom-props.md): Dark mode via CSS custom properties
```

---

## Files Created: `docs/adr/ADR-001-no-fetch.md` through `docs/adr/ADR-005-dark-mode-css-custom-props.md`, `docs/adr/ADR-000-template.md`
