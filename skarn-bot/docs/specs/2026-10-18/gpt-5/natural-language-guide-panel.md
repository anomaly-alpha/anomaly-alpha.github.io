# Skarn Natural-Language Guide Panel

**Status:** Proposed
**Date:** 2026-10-18

## Summary

Turn the natural-language examples in `docs/NL-TOOLS.md` into a compact, interactive Discord guide. Users choose a natural-language tool category, inspect example prompts and usage instructions, then optionally run an example. The visual treatment should feel like a lightly styled, old-school terminal while staying readable with Discord's native embeds and components.

Keep this guide separate from `/help`: `/guide` teaches users how to ask Skarn for things in plain language; `/help` remains the complete slash-command catalog.

## Entry points and Discord constraint

- Add `/guide`, opening the guide as an ephemeral interaction response.
- Add the natural-language activation phrase `skarn guide`, alongside or replacing `skarn help` only if the existing `/help` text activation continues to mean the command catalog. The phrase should open the same guide content and controls.
- A typed message cannot receive an ephemeral response in Discord. Therefore `/guide` is private, while `skarn guide` must show the panel publicly in the invoking channel (or use a separately agreed DM-based experience). Do not claim both entry points are ephemeral.
- Keep `/help` and the existing `skarn help` text activation's command-catalog behavior unchanged. `skarn guide` is a separate activation. Do not silently repurpose either help route.
- Require the user's AI opt-in and an AI-enabled guild channel before either entry point opens the guide. Guide browsing is therefore not available in DMs or non-enabled channels.

## User experience

### Panel layout

Use one embed with native Discord components rather than a generated image. The embed should have a restrained terminal-console feel: near-black/charcoal presentation where Discord permits, cyan or muted green accent, a short monospace status/header line, clear section labels, and no large blocks of decorative ASCII art. Discord controls retain their native appearance.

The panel contains:

1. A title such as `SKARN // NATURAL LANGUAGE INTERFACE`.
2. A short instruction: select a tool family, choose an example, then either run it or use its wording in chat.
3. A category selector for the 10 dedicated natural-language tools only.
4. An example selector populated for the current category.
5. A detail area showing the selected example, what Skarn will do, any required context, and whether it has side effects.
6. A `Run example` button and a `Close` button. Disable `Run example` until an example is selected.

The category taxonomy should follow the guide's functional groupings, not imply every slash command is a natural-language tool. Suggested categories: Weather, News, Dice & Coin, Conversation Stats, Web Search, Reminders, and Personal Memory. Do not add a `run_command` category. A short instruction may explain that some text-activation commands can also be requested naturally and that `/help` lists slash commands.

### Example selection and use

- Selecting a category updates the examples and instructions in place. Selecting an example updates the detail area without executing it.
- The panel must distinguish “copy/use this wording yourself” from “run this example now.” Discord does not allow a bot button to insert text into the user's message composer or to post as the clicking user.
- `Run example` explicitly asks Skarn to process the selected sample on behalf of the clicking user through the same supported natural-language/tool path. The bot must not fabricate a user-authored message or bypass tool routing. Every listed dedicated-tool example is runnable.
- For personal-state examples, open a form/modal so the user can review and edit the values before execution. Show a separate confirmation step summarizing the final effect and values. This applies to setting reminders and saving memory. Never run literal placeholder text or an unreviewed sample value as a personal fact.
- Return results ephemerally by default, including when the panel itself was posted publicly. Do not expose personal memory or conversation stats in the channel.

### Natural-language instructions

Every example detail should include a compact instruction: “You can also mention `@Skarn` or start with `skarn`, then ask this in your own words. These examples are starters, not required exact phrases.” State that AI chat requires the user's opt-in (`skarn opt in`) and an enabled AI channel. Explain that dedicated tools and eligible text commands are distinct routes; slash-only workflows still require their slash command.

## Example content source

Avoid maintaining a second hand-edited copy of examples in the command handler. Extract a small structured guide catalog into a feature module (for example `features/guide/guideCatalog.js`) with stable category IDs and records containing:

- example ID and display label;
- natural-language phrase shown to the user;
- explanation and input requirements;
- route kind (`dedicated-tool`, `text-command`, or conversational intent);
- execution eligibility and side-effect/visibility metadata.

Initially migrate the 10 tool sections and representative `run_command` examples from `docs/NL-TOOLS.md`. Keep Markdown as the detailed human-readable guide, but add a consistency test or audit that verifies the interactive catalog's tool/route names against live tool and activation registries. Avoid claiming every guide Markdown example is executable until it has an explicit catalog entry and safe argument handling.

## Execution and safety

- Reuse the existing AI/tool pipeline and dedicated tool dispatch/validation rather than implementing a parallel execution path. Do not route these examples through `run_command`.
- Component handlers must use the component interaction's user as the requester and retain guild, channel, and source-interaction context needed by existing routing.
- Check AI opt-in and enabled-channel eligibility before opening the panel, then re-check them along with route-specific command permissions, guild-only constraints, rate limits/cooldowns, and safety policy at execution time. Opening the guide does not grant or cache access.
- Never trust client-provided custom IDs as an example definition or arguments. Custom IDs should identify the panel/action; resolve catalog records server-side. Validate all modal input.
- Scope component interactions to the panel owner and message ID, acknowledge promptly, and handle expired/unknown interactions. Keep the lifetime to 10 minutes. On Close or expiry, delete the panel message (public or ephemeral) and end its collector. Don't create a channel-wide collector that can accept unrelated component interactions.
- Use per-panel state (owner, selected category/example, originating guild/channel, expiry) rather than module-global mutable selection state.
- Avoid writing panel interactions or sample text to durable conversation history unless the user actually runs an example and the existing pipeline normally records that interaction.

## Suggested implementation shape

- `commands/guide.js`: `/guide` definition, AI-access check, ephemeral initial response, route into shared panel controller.
- `features/guide/guideCatalog.js`: structured category/example data and validation helpers.
- `features/guide/guidePanel.js`: render embed/components and handle select/run/confirm/close interactions for both entry points.
- Natural activation `skarn guide`: run the same AI-access check and call the shared panel renderer/controller; document that message-origin panels are public and invoker-only.
- Component IDs should be namespaced (for example `guide:category`, `guide:example`, `guide:run`, `guide:confirm`, `guide:close`) and remain within Discord's custom-ID length limit.
- Prefer interaction-scoped collectors with strict owner/message filters, matching the existing `/help` pattern but with proper ephemeral handling. If a centralized component router is introduced, that is a separate architectural choice and should not be required for this feature.

## Acceptance criteria

1. Both `/guide` and `skarn guide` require AI opt-in and an enabled guild channel. `/guide` opens an ephemeral panel; `skarn guide` opens the same experience as a public message.
2. `/help` still opens the complete slash-command browser and is not replaced or relabeled as the natural-language guide.
3. Users can switch categories, select an example, read its purpose/requirements, and close the panel; controls update without posting a new guide message.
4. The category selector covers the 10 dedicated tools only. No example executes merely by selecting it. Every documented dedicated-tool example is runnable; state-changing examples have editable values and a separate confirmation step.
5. Examples execute as the clicking user through existing routes and respect all current eligibility, permissions, safety, and rate-limit checks.
6. Results are ephemeral by default; personal or otherwise sensitive output is never leaked into a public channel by a panel interaction.
7. Empty/missing inputs, expired panels, non-owner clicks, invalid custom IDs, and failed tool executions produce safe, acknowledged responses.
8. Interactive tool names are checked against the live tool registry, and tests cover category navigation, owner isolation, 10-minute expiry/deletion, validation, confirmation, and execution gating.
9. The panel communicates how to ask naturally, including mention/`skarn` phrasing, opt-in/channel requirements, and the boundary between natural-language routes and slash-only workflows.

## Verification plan

- Unit tests for catalog integrity, component rendering limits, category/example transitions, input validation, expiry, and owner checks.
- Route tests confirming that Run delegates to the existing pipeline and re-evaluates opt-in/channel/permission gates; test side-effect confirmation separately.
- Smoke tests for `/guide`, text activation, `/help` non-regression, and ephemeral/public visibility.
- Run `npm run audit:docs` and the relevant Skarn smoke tests after implementation.
