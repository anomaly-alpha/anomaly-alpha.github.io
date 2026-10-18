# Implementation Plan: Skarn Natural-Language Guide Panel

**Status:** Ready for implementation
**Date:** 2026-10-18
**Spec:** [`docs/specs/2026-10-18/gpt-5/natural-language-guide-panel.md`](../../../specs/2026-10-18/gpt-5/natural-language-guide-panel.md)

## Goal

Deliver an interactive Discord panel for all 9 dedicated natural-language tools, opened by ephemeral `/guide` or public invoker-only `skarn guide`. Enforce the agreed opt-in/channel gate at entry and execution, dispatch examples through the existing dedicated-tool runner using catalog-fixed arguments, keep results ephemeral, confirm personal-state writes, and delete panels on Close or after 5 minutes. Preserve `/help` and `skarn help` as the complete slash-command catalog.

## Scope boundaries

- The panel covers only the dedicated tools defined in `features/tools/toolDefinitions.js`; no `run_command` or full slash-command catalog.
- Do not alter the meaning or behavior of `/help` or `skarn help`.
- Do not add DM support, persistent panels, cross-user public controls, or a new generic component router.
- No Discord command deployment or Railway deployment is part of this local implementation plan. `deploy-commands.js` already discovers all modules in `commands/`; the new `/guide` command still needs registering through the existing deployment workflow before it appears in Discord.

## Existing architecture and implementation constraints

- `bot.js` auto-loads slash command modules from `commands/`; `deploy-commands.js` serializes those modules for Discord registration.
- `activationRegistry.scanCommands()` reads activation metadata from the same command modules. The message handler invokes command activations directly; it does not make `skarn guide` a normal AI chat turn. The guide handler must enforce its own entry gate.
- AI opt-in is exposed by `features/proactive/absenceDetector.canInteract(userId, guildId)`. Enabled channels are stored as guild config `aiChannels`; AI access restrictions are checked by `features/friendTiers/friendPermission.checkAiPermission(...)`. No existing shared helper combines all three guide requirements, so implement a small fail-closed guide access helper and call it consistently.
- `features/ai/sharedPipeline.runPipeline()` is not the right path for a guide button: it performs a normal conversational turn, offers the model the broad tool catalog, emits visible typing, and includes chat-history/memory/follow-up side effects. Use the existing `features/tools/toolRunner.runTool()` directly with a fixed catalog-selected tool and validated arguments; return its result in an ephemeral interaction response.
- `features/tools/toolRunner.runTool()` has dedicated dispatch for 9 function tools and uses `userId`, `guildId`, and `channelId` from context. `getTools()` also includes `run_command`, which has source-message/interaction execution behavior and must not be included in guide execution.
- `/help` uses interaction-scoped message collectors, owner/message filters, and a two-minute timeout. Reuse its interaction pattern where valid, but the guide's chosen lifetime is five minutes and Close/expiry deletes the panel rather than merely disabling controls.
- Tests are plain Node smoke scripts under `scripts/smokes/`; `scripts/run-smokes.js` discovers all of them.

## Implementation sequence

### 1. Reconcile the spec and prove direct tool dispatch

1. Keep the companion spec synchronized with the live registry and settled behavior: `skarn guide` is additive to `skarn help`; the interactive catalog has 9 dedicated tools and excludes `run_command`; the timeout is 5 minutes.
2. Add a small `guideExecution` wrapper that resolves an example ID against the catalog, checks the tool against the exact dedicated-tool allowlist from `toolDefinitions`, validates/builds the final arguments, and calls `runTool()` once with the clicking user's context. Never accept a tool name or raw arguments from a component custom ID.
3. Return the `runTool()` result content by editing an ephemeral deferred component response. Do not call `runPipeline`, `channel.send`, `sendTyping`, source-panel `followUp`, or a model tool-selection loop for a guide button.
4. Consume/lock a successful confirmation before dispatch; malformed catalog values must fail before `runTool()` is called. Keep network services mockable in tests.

**Gate:** do not build the panel's Run action until a smoke proves the server-resolved catalog entry dispatches exactly one intended dedicated tool with the expected requester/arguments and the result goes only to the ephemeral interaction response.

### 2. Build the dedicated-tool catalog

Add `features/guide/guideCatalog.js` with stable category IDs, labels, descriptions, and example records migrated from the 9 dedicated-tool sections of `docs/NL-TOOLS.md`. Each runnable example must define:

- stable example ID, display wording, and concise instructions;
- exactly one dedicated tool name;
- typed, validated argument mapping for that example;
- input metadata for editable values (required for `etch_memory` and `set_reminder`);
- side-effect classification and a confirmation summary template.

Use the 9 actual dedicated function tool names: `etch_memory`, `get_memory`, `search_web`, `set_reminder`, `get_weather`, `get_news`, `roll_dice`, `flip_coin`, and `get_user_stats`. Derive/validate the set from the live tool definitions and explicitly exclude `run_command`. Keep category and example labels within Discord select-option limits (maximum 25 options per select), and test any pagination/grouping needed if the catalog grows.

Export pure catalog lookup/validation helpers so UI handlers and smoke tests use the same rules. Catalog input validation must be stricter than trusting a select value or modal custom ID.

### 3. Add a shared access gate

Add `features/guide/guideAccess.js` (or the equivalent smallest feature-local module) that checks, in order and fail-closed:

1. Interaction/message belongs to a guild and has a guild channel.
2. The current channel is present in that guild's `aiChannels` configuration.
3. `canInteract(userId, guildId)` confirms the user's explicit opt-in.
4. `checkAiPermission(userId, guildId, 'mention')` permits the AI surface.

Call this before opening either entry point and re-run it when handling every component transition and immediately before executing a tool. Return private/safe denial copy for slash and component interactions; the public message activation may only have a public denial reply, so keep it generic and do not disclose moderation/permission details. Never infer guild or user identity from component custom IDs.

### 4. Implement panel rendering and bounded session state

Add `features/guide/guidePanel.js` with pure render helpers plus a session/controller entry point. Reuse Discord embeds, string selects, buttons, and modal builders. Keep the presentation restrained: dark-console language, cyan/green accent, concise monospace-like labels, readable instructions, no image asset.

Panel states:

1. **Browse:** category selected or default category shown; example selector populated; Run disabled until an example is selected.
2. **Preview:** selected prompt, purpose, inputs, and side-effect notice shown; selection itself has no side effect.
3. **Input:** for memory/reminder examples, collect/edit fields in a modal; validate limits and normalize values server-side.
4. **Confirm:** show the exact memory fact or reminder message/time and require a distinct confirmation click. Cancel returns to preview/browse without execution.
5. **Run:** defer the component interaction ephemerally, re-check eligibility, invoke the dedicated dispatcher once, and return its result ephemerally.
6. **Closed/expired:** delete the originating panel and stop the collector.

Store owner ID, original message ID, guild/channel IDs, selected category/example, current modal/confirmation state, execution lock/status, and expiration per session. Use namespaced custom IDs that carry only opaque action/session identifiers; resolve definitions and arguments server-side. Filters must reject non-owner clicks and interactions for another message. Use `awaitModalSubmit` (or an equivalently scoped modal-submit listener) filtered to owner/session, and keep modal handling inside the feature rather than adding a generic global component router. Atomically mark a session as running before tool invocation so double-clicks/replayed interactions cannot repeat memory or reminder writes. On expiry at five minutes or Close, delete the public or ephemeral panel and release collector/state. Handle unknown/expired interactions without uncaught errors.

### 5. Wire `/guide` and `skarn guide` without changing help

Add `commands/guide.js`:

- `/guide` checks access, replies with the panel using ephemeral flags, and starts the shared controller.
- Its text activation phrase is exactly `skarn guide`; it checks the same gate, posts the shared panel publicly, and scopes controls to the invoking user.
- Preserve `commands/help.js`, `/help`, and `skarn help` unchanged.
- Keep the guide's access decision feature-local; do not add `guide` to the general AI-command allowlist as a substitute for the required channel + opt-in gate.
- Use the existing top-level slash interaction error handling and activation registry rather than adding a second global component dispatcher.

### 6. Add documentation and registry regression coverage

Update `docs/NL-TOOLS.md` with the two entry points, their private/public distinction, the opt-in + enabled-channel requirement, invoker-only controls, 5-minute deletion behavior, and the fact that selecting is not running. Clarify that state-changing examples are editable and confirmed. Preserve the rest of the slash-command catalog.

Add `scripts/smokes/24-guide-panel.js` (or next unused numeric prefix after checking the current directory) and pure unit-style checks for:

- every catalog tool exists in `getTools()` and no `run_command` entry is present;
- example IDs are unique, categories/examples fit Discord option constraints, and arguments validate against tool schemas;
- required-tool selection excludes other tools; malformed/unknown tool names fail closed;
- gate behavior for opted-out users, disabled channels, blocked users, DMs, and eligible users;
- owner/message isolation, modal validation, confirm/cancel transitions, Close/expiry deletion, and no execution on category/example selection;
- ephemeral response adapter usage and rejection/error handling.

Mock network-backed services (weather/search/news) so the smoke suite is deterministic and offline. Add dispatcher tests proving the selected catalog example routes once to its named tool with validated arguments and the current interaction user's context.

## Verification and release checklist

Run from `skarn-bot/`:

1. `node scripts/smokes/24-guide-panel.js` — focused catalog, access, component-state, and tool-routing checks.
2. `npm run audit:docs` — documentation assertions.
3. `npm run smoke` — all existing and new smoke suites.
4. `git diff --check` — whitespace validation.
5. Inspect the command JSON with the existing module loader/`deploy-commands.js` serialization path; do not call Discord REST during local validation.
6. Manual Discord QA after deployment: `/guide` is ephemeral; `skarn guide` is public and owner-only; both deny users who have not opted in or use disabled channels; all categories/examples navigate; read-only tools return ephemeral results; memory/reminder changes require editing and explicit confirmation; non-owner clicks fail safely; Close and five-minute expiry remove the panel; `/help` remains unchanged.

No push or deployment is included in this plan. Register `/guide` with the existing command deployment procedure and deploy the bot only when separately authorized.

## Completion criteria

- All acceptance criteria in the companion spec pass.
- Tool execution is bound to the catalog-selected dedicated tool and clicking user; no natural-language guide action can dispatch `run_command`, invoke the normal conversational pipeline, or post a result publicly.
- Entry and execution gates are re-evaluated and fail closed.
- Stateful examples are editable and confirmed before mutation.
- Five-minute panel lifetime and deletion behavior are tested for both entry points.
- Existing `/help`, `skarn help`, and smoke suites have no regressions.
- Documentation accurately explains the behavior and registry-derived catalog is tested against the live definitions.
