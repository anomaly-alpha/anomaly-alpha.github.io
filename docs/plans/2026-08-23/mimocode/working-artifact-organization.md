# Working Artifact Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move MiMoCode handoff files out of the temporary directory into the repository’s dated, model-scoped handoff structure and make that convention mandatory for future work.

**Architecture:** Preserve each handoff as a repository file under `docs/handoffs/2026-08-22/gpt-5.6-luna/`. Update the root `AGENTS.md` as the single instruction source so specs, plans, reports, handoffs, and guides always use `docs/{type}/YYYY-MM-DD/<model>/` and never `docs/compose/`.

**Tech Stack:** Markdown, PowerShell filesystem operations, Git worktree inspection.

## Global Constraints

- Preserve the two handoff documents byte-for-byte while moving them.
- Use `docs/specs`, `docs/plans`, `docs/reports`, `docs/handoffs`, and `docs/guides` with dated/model-scoped directories.
- Do not move or modify unrelated worktree changes.
- Do not create `docs/compose` or singular `docs/plan` paths.

---

### Task 1: Move temporary MiMoCode handoffs

**Files:**
- Move: `C:\Users\petra\AppData\Local\Temp\mimocode-handoff-2026-08-22.md` → `docs/handoffs/2026-08-22/gpt-5.6-luna/mimocode-handoff-2026-08-22.md`
- Move: `C:\Users\petra\AppData\Local\Temp\mimocode-handoff-youtube-creators.md` → `docs/handoffs/2026-08-22/gpt-5.6-luna/mimocode-handoff-youtube-creators.md`

- [ ] Create the exact destination directory.
- [ ] Confirm both source files exist and both destination paths are absent.
- [ ] Move each source file without overwrite.
- [ ] Compare source-recorded model context and linked canonical artifacts against the destination date/model path.

### Task 2: Make artifact storage mandatory

**Files:**
- Modify: `AGENTS.md` in the `Docs structure` section.

- [ ] State that every new or updated spec, plan, report, handoff, and guide must be saved directly under the dated/model-scoped `docs/{type}/YYYY-MM-DD/<model>/` tree.
- [ ] Keep the existing type-specific directory map and explicit prohibition on `docs/compose/` and `docs/plan/`.
- [ ] Keep the instruction concise and make it the single source of truth for artifact locations.

### Task 3: Verify the migration

**Files:**
- Verify: `docs/handoffs/2026-08-22/gpt-5.6-luna/`
- Verify: `AGENTS.md`

- [ ] Confirm both handoffs exist in the destination and no matching handoff remains in `C:\Users\petra\AppData\Local\Temp`.
- [ ] Confirm `AGENTS.md` contains the mandatory artifact-location rule and the forbidden legacy paths.
- [ ] Run `git diff --check` and inspect `git status --short` to ensure only intended documentation changes are present alongside pre-existing user changes.
