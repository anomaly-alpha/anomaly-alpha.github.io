# MD Documentation Sync Plan

## Status: EXECUTED

## Decisions Locked

| # | Decision | Outcome |
|---|----------|---------|
| 1 | Line counts | Remove entirely from docs |
| 2 | "Multiverse Alliance War" → "Alliance War" | Replace in all 32 locations |
| 3 | Default modes | Fix AGENTS.md + README bug fixes |

---

## Execution Log

### Fix 1: Remove line counts

- `docs/index.md` line 87 — removed line count string
- `docs/DESIGN_SYSTEM.md` lines 434-435 — removed updated line counts

### Fix 2: Replace naming (32 occurrences)

- README.md — 11 replacements
- CONTEXT.md — 3 replacements
- docs/index.md — 3 replacements
- advertising.md — 1 replacement
- docs/plan/*.md — 12 replacements
- journal/*.md — 4 replacements

### Fix 3: Default modes

- AGENTS.md line 52 — added "(defaults: event, pvp, login — CODE inactive)"
- README.md — added note to bug fixes list

---

## Commit

- `docs: sync MD files with app state — remove stale line counts, rename to Alliance War, document CODE-default'