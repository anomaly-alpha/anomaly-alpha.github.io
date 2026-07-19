# ADR-001: Tiered Context Assembly for Prompt Efficiency

**Status:** Accepted
**Date:** 2026-07-19

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
