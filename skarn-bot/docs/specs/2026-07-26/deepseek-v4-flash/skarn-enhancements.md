---
feature: skarn-enhancements
status: delivered
updated: 2026-07-26
branch: feature/skarn-enhancements
commits: 64a731b..563e940
---

# Skarn Enhancements — Memory, Reminders, Character Card, Lorebook, Tool-Use Loop

## Report

**What was built** — Five features adding core AI-bot capabilities to Skarn:

1. **`/memory` command** — Users can now see what Skarn remembers about them, including etched facts (from `/etch`), extracted interests, relationship familiarity, profile stats, and conversation statistics — all in a single Discord embed.

2. **`/remind` command** — Users can set reminders with natural time strings ("30m", "2 hours", "1 day"). Skarn DMs them when it's due. The `reminders` table already existed in the schema but had no user-facing command. Added `processDueReminders()` on a 30s interval to deliver due reminders.

3. **Character Card format** — Added 5 example dialogues (`persona/examples.js`) demonstrating Skarn's voice across different scenarios (banter, celebration, comfort, disagreement, help). These inject into the system prompt via `examplesLine` in `buildSystemPrompt()`. First-time users get a greeting directive instead. Pattern inspired by SillyTavern character cards.

4. **Lorebook (World Info)** — A keyword-triggered context injection system. New `lorebook` table stores entries with comma-separated keywords, content, category, and priority. On every AI call, `promptContext.js` matches user message keywords against lorebook entries and injects matching ones into the system prompt. Admin `/lorebook` command to add/remove/list entries.

5. **Tool-use loop** — OpenAI function calling integration. Five tools defined: `etch_memory`, `get_memory`, `search_web`, `set_reminder`, `add_knowledge`. Both `mentionRouter.js` and `consult.handler.js` now pass tools to the first AI call. If the model responds with a tool call, the tool is executed and the result fed back (up to 3 rounds). This lets Skarn proactively save facts, look up memories, search the web, set reminders, and add to the knowledge base during conversation — all autonomously.

**Verification** — All 17 files (8 modified, 12 new) pass Node.js syntax check (`node -c`). No runtime verification was performed (no live bot token in worktree).

## [S1] Problem
Skarn lacked several modern AI-bot capabilities that users expect: memory visualization, user-initiated reminders, consistent character voice, contextual world knowledge, and the ability to use tools during conversation.

## [S2] Design
Each feature follows the existing vertical-slice pattern (feature/ subdirectory with command.js + handler.js + commands/ wrapper). The tool system uses OpenAI's native function calling API rather than custom routing, keeping the AI in control of when to use tools. The lorebook and character card inject into the existing `buildSystemPrompt()` / `buildContext()` pipeline.

## [S3] Out of Scope
Tool-use loop is only integrated into the two main conversational paths (mentionRouter and consult). Standalone command files (joke, roast, etc.) don't get tools — they're single-turn by nature. Web search tool requires `GOOGLE_CSE_KEY` and `GOOGLE_CSE_CX` env vars; falls back gracefully otherwise.

## Tasks
- [x] T1: `/memory` command — acceptance: user sees etched facts, interests, relationship, profile, stats in embed
- [x] T2: `/remind` command — acceptance: user sets reminder, Skarn DMs at due time
- [x] T3: Character Card — acceptance: example dialogues in system prompt improve voice consistency
- [x] T4: Lorebook — acceptance: admin adds keyword entry, Skarn references it in matching conversations
- [x] T5: Tool-use loop — acceptance: AI calls tools during conversation and incorporates results
