# ADR-001: Tiered Context Assembly for Prompt Efficiency

**Status:** Accepted — amended 2026-11-07 (see Amendment)
**Date:** 2026-07-19

## Amendment (2026-11-07)

Two claims in the original text are now historical rather than current:

1. **Line count.** The Context section says "~18 context lines". `buildContext()` has grown since: it now returns **39 keys, of which 37 are prompt lines** (`features/promptContext.js:296-330`); the other two (`stance`, `adviceRequested`) drive role selection and are ignored by `buildSystemPrompt()`.
2. **`moodLine` is gone.** The Decision section lists "mood" among the directive lines. `MOOD_LINES`/`getMoodLine()` were deleted 2026-11-01; mood survives only as the `volumeEnergy` *input* to `resolveStance()`, and the line it used to produce is now **`stanceLine`** (`features/promptContext.js:300`). The tier logic itself (≥50 chars or `?` → full tier; 3 messages light, 15 messages + 2 summaries + profile + knowledge on full) still matches the code.

## Context

Skarn's system prompt is assembled from ~18 context lines (state, mood, relationship, warmth, memory, conversation history, etc.) plus the core identity and role line. With the merge of `collectContext()` and `assembleContext()` into a single `buildContext()` function, every AI call would receive full conversation context (30 recent messages, 5 summaries, profile, knowledge match) regardless of message length or complexity.

For a short message like "lol" or "fr", sending 3,000+ tokens of conversation history is wasteful — most of that context is irrelevant to the reply.

## Decision

We use a **tiered `buildContext()`** function:

- **Lightweight tier** (default for messages < 50 chars or casual banter):
  - All directive lines (state, mood, warmth, relationship, memory, etc.)
  - Last 3 recent messages
  - No summaries, no profile, no knowledge match
  - ~1,000 tokens total (excluding identity)

- **Full tier** (for messages ≥ 50 chars or containing a question):
  - All directive lines
  - Last 15 recent messages
  - 2 summaries
  - User profile
  - Knowledge match
  - Server buzz context
  - ~3,000 tokens total (excluding identity)

- **Advice tier** (for messages matching advice triggers like "should I", "what should"):
  - Full tier content
  - Plus socratic directive

The threshold is: message length ≥ 50 OR message contains `?`.

## Consequences

- Short messages get faster, cheaper responses
- Full context only used when the conversation warrants it
- ~60% of AI calls will use lightweight tier, saving ~2,000 tokens each
- Implementation complexity: a conditional branch in `buildContext()`
