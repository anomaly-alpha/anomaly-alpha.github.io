# Remove Duplicate Commands

## [S1] Problem

Two pairs of commands in `commands/` provide overlapping functionality:

| Pair | Why duplicate |
|------|---------------|
| `/relation` ↔ `/relationship` | Both query `user_relationship` to display Skarn's relationship with the user. `/relation` is a plain-text subset (familiarity + tags + banter level). `/relationship` is a rich embed (familiarity bar, messages, interactions, engagement, milestones, nickname). |
| `/ask` ↔ `/consult` | Both send a user question to OpenAI and return an AI reply. `/ask` (deprecated, per README) has its own inline system prompt, creates its own OpenAI instance, hardcodes `gpt-3.5-turbo`, and bypasses the entire persona/context pipeline. `/consult` goes through the full vertical-slice pipeline: persona system, model router, context assembly, rate limiting, post-processing, and tracking. |

## [S2] Solution

Remove `commands/relation.js` and `commands/ask.js`. Both have a strictly-superior replacement already registered as a slash command.

### [S3] Files to delete

- `commands/relation.js` — delete. `/relationship` (and `skarn relationship`) provide the same data in a richer format.
- `commands/ask.js` — delete. `/consult` (and `@Skarn`) provide AI conversation through the full persona pipeline.

### [S4] Documentation updates

After deletion, update the three files that reference `/ask`:

| File | Lines | Change |
|------|-------|--------|
| `README.md` | 63-68 | Remove `/ask` row from AI Chat table — no replacement needed, `/consult` is already in the Persona table above |
| `README.md` | 200-202 | Remove `/ask` detail section under AI Chat |
| `docs/ARCHITECTURE.md` | 79 | Change "Every AI call (except deprecated `/ask` and `/summarize`)" → "Every AI call (except `/summarize`)" |
| `CONTEXT.md` | 13, 71, 261 | Remove `/ask` references entirely — no longer present in the codebase |

No documentation references `/relation` by name in README.md, ARCHITECTURE.md, or CONTEXT.md.

### [S5] What does NOT break

- **`deploy-commands.js`**: Dynamically reads the `commands/` directory with `fs.readdirSync`. Deleted files are simply excluded from the next deployment.
- **Activation registry**: `skarn relation` activation phrase disappears with `relation.js` — `skarn relationship` still works. `/ask` has no activation phrase.
- **No external requires**: No file outside `commands/` imports `relation.js` or `ask.js`.
- **Database**: `user_relationship` table and `relationship_milestones` are untouched — `/relationship` continues working.
- **Consult pipeline**: `features/consult/` is self-contained and unaffected.
- **Historical docs**: `.md` files in `docs/plans/`, `docs/specs/`, `docs/reports/` reference `relation.js` and `ask.js` as historical records. These should NOT be updated — they capture the state of the codebase at the time of writing.

### [S6] Post-removal action

Run `node deploy-commands.js` to re-register slash commands with Discord. This removes `/relation` and `/ask` from Discord's command list on the next sync.

### [S7] Verification

1. Confirm `commands/relation.js` and `commands/ask.js` no longer exist
2. Confirm `README.md` no longer references `/ask`
3. Confirm `docs/ARCHITECTURE.md` no longer references `/ask`
4. Confirm `CONTEXT.md` no longer references `/ask`
5. Run `node -e "require('./commands/relationship'); console.log('relationship OK')"` — confirms `/relationship` still loads
6. Run `node -e "require('./features/consult/consult.command'); console.log('consult OK')"` — confirms `/consult` still loads

## Spec Self-Review

- **Placeholders**: None. All sections are complete.
- **Internal consistency**: Consistent — delete two files, update four doc references, no breakage.
- **Scope check**: Focused — single plan for a single change set.
- **Ambiguity check**: Clear which files to delete and which docs to update. No interpretation needed.
