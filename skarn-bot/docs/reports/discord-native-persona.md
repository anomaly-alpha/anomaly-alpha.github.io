---
feature: discord-native-persona
status: delivered
specs:
  - skarn-bot/docs/specs/2026-07-18-discord-native-persona.md
plans:
  - skarn-bot/docs/plans/2026-07-18-discord-native-persona.md
commits: (uncommitted)
---

# Discord-Native Skarn Persona — Final Report

## What Was Built

Skarn's persona was upgraded from "character performing a role" to "someone who actually lives on Discord." The system prompt now uses casual Discord-native language (lowercase, abbreviations, emoji reactions grounded in prompt). A response post-processor probabilistically transforms output (lowercase injection, period stripping, abbreviation/emoji sprinkling, message splitting). A reaction system lets Skarn passively react to messages with emoji. Typing simulation adds realistic delay before replies. Context injection threads recent channel conversation into consult/mention prompts.

## Architecture

```
skarn-bot/
└── features/
    └── discordNative/
        ├── postProcess.js       ← Probabilistic response transformer + splitter
        ├── reactionSystem.js    ← Passive emoji reactions (3% chance, 60s cooldown)
        ├── typingSim.js         ← Realistic typing delay before replies
        └── contextInjector.js   ← Last-5-messages context for consult/mentions
```

**Components:**

- **Post-processor** (`postProcess.js`): Exports `postProcess(response, roleNature)`, `splitMessage(text, maxLength)`, and `ROLE_NATURE` classification. Role tiers control aggressiveness: `casual` (full processing), `moderate` (period stripping only), `serious` (minimal). Transformations are probabilistic and independent.

- **Reaction system** (`reactionSystem.js`): Exports `maybeReact(message, client, isAsleep)`. Checks sentiment (skips negative messages), Discord permissions, 60s per-channel cooldown, and sleep mode before adding a reaction. Prefers server custom emojis, falls back to standard.

- **Typing simulation** (`typingSim.js`): Exports `simulateTyping(channel, responseLength)`. Sends typing indicator then waits 0.5-4s proportional to response length.

- **Context injector** (`contextInjector.js`): Exports `getRecentContext(channel, limit)` and `buildContextualPrompt(userMessage, context)`. Fetches last 5 messages (filtering bots) and prepends them to the user prompt.

**Integration points:**

| File | Change |
|------|--------|
| `persona/identity.js` | Rewrote `SKARN_CORE_IDENTITY` with Discord-native voice |
| `persona/roles.js` | Updated consult role line, bumped token budget to 900, added `ROLE_NATURE` export |
| `features/consult/consult.handler.js` | Added context injection, post-processing, typing sim, and message splitting |
| `features/mentionRouter/mentionRouter.js` | Same integrations as consult (temperature stays 0.85) |
| `bot.js` | Added `maybeReact` call after mention routing |

### Design Decisions

- **Probabilistic transformations**: Each post-processing step has independent chance to fire, so responses vary naturally rather than always being altered the same way.
- **Reactions passive only**: 3% chance per message, never to negative/venting content (sentiment check). Creates presence without spam.
- **Typing after generation**: AI generates the full response first, then Skarn "types" for realistic delay. Avoids blocking the AI call.
- **Context is per-request**: 5 recent messages fetched live, not stored. No new DB tables.
- **Mention cooldown stays at 1s**: Code was already at 1s (not 15s as early spec suggested).
- **Temperature preserved per surface**: consult=0.8, mentions=0.85 — kept different since they're different interaction modes.

## Usage

No user-facing changes to command syntax. Behavior changes:

- `/consult` and `@Skarn` replies now have: context from last 5 messages, probabilistically transformed text (lowercase, no periods, abbreviations, emoji), realistic typing delay, and message splitting for long replies (>400 chars become multiple messages).
- `/joke`, `/roast`, `/pickup`, etc. go through the same post-processor via their role classification.
- `/homework`, `/code`, `/recipe` get minimal post-processing (only period stripping on very short messages).
- Skarn occasionally reacts to messages with emoji in channels he's active in.
- Sleep mode suppresses reactions.

## Verification

All files exist at correct paths. Module exports verified. Integration points confirmed:
- `bot.js` imports `maybeReact` and calls it with `isAsleep` flag
- `consult.handler.js` and `mentionRouter.js` import all 3 new modules
- `roles.js` exports `ROLE_NATURE` alongside `roles` and `roleTokenBudgets`
- `userMessage` → `contextualMessage` replacement in both handler files
- `splitMessage` replaces existing 2000-char splitting in both handlers

No verification output available — this is a Discord bot with no test framework. Manual verification in Discord is the next step after deploy.

## Journey Log

> Brief notes on what informed the final design.

- [lesson] OpenAI client import returns a function, not a direct client — `getOpenAIClient()` must be called at call site, not at module load.
- [lesson] Actual mention cooldown was 1s, not 15s as an earlier spec claimed — always read the code.
- [lesson] Token budget field is `max_completion_tokens` (not `max_tokens`) — different OpenAI API parameter.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/specs/2026-07-18-discord-native-persona.md` | Design spec | Full Discord-native upgrade spec |
| `docs/plans/2026-07-18-discord-native-persona.md` | Implementation plan | 8 tasks with grilling fixes incorporated |
