# Lore Assembler — Random Lore Injection for Skarn

> Design: 2026-07-21 — User-approved via brainstorm session.

## [S1] Problem

Skarn has 1653+ auto-generated lore stories plus 20 canonical stories in `skarn_stories`, but they're only injected when the user's message matches specific trigger topics (war, loss, change, technology, time, power). Most conversations get zero lore references, missing an opportunity to deepen Skarn's persona through scattered memories.

## [S2] LoreAssembler module

New file: `features/wisdom/loreAssembler.js`

### Selection logic

- Query `skarn_stories` for 10 random stories (not recently used)
- Dedup: check `app_flags` for `lore_used_{storyId}` — skip stories used in last 24 hours
- Pick 2-3 from the 10 candidates (weighted by `used_count` — less used = more likely)
- Mark selected stories as used in `app_flags` with 24h TTL
- Format as a context line:

```
Skarn's scattered memories: ["story1 text"] ["story2 text"] ["story3 text"]
Reference these naturally in your response if they fit the conversation. Weave them in as personal memories, not quotes. 1-2 references max per reply.
```

### Trigger conditions

- Message length >= 50 chars, OR
- Message contains `?` (question), OR
- Emotional keywords detected (sad, angry, anxious, frustrated, happy, excited, lost, confused, help, need)
- If none of these: return empty string (no lore injection)

## [S3] Integration

### promptContext.js — new loreLine

Add `loreLine` to the `buildContext()` return object:

```js
const { getLoreLine } = require('./wisdom/loreAssembler');

// Inside buildContext():
const loreLine = getLoreLine(userContent);

return {
  // ... existing lines ...
  loreLine: loreLine,
};
```

### identity.js — buildSystemPrompt() signature

Add `loreLine` to the optional parameters:

```js
function buildSystemPrompt({
  // ... existing params ...
  loreLine = ''
} = {}) {
  // ... existing code ...
  if (loreLine) parts.push(loreLine);
  // ... rest of function ...
}
```

## [S4] Files changed

| File | Change |
|------|--------|
| `features/wisdom/loreAssembler.js` | **New** — selection, dedup, formatting |
| `features/promptContext.js` | Add `loreLine` import and injection |
| `persona/identity.js` | Add `loreLine` to `buildSystemPrompt()` signature |

## [S5] Token budget adjustments

Increase `roleTokenBudgets` for conversation-heavy roles to accommodate the larger system prompt from lore injection (+100-200 tokens):

| Role | Current | New |
|------|---------|-----|
| consult | 400 | 600 |
| story | 400 | 600 |
| adventure | 400 | 600 |

Other roles unchanged — casual roles (roast, compliment, etc.) don't get lore injection, and serious roles (homework, code) have their own token needs.

## [S6] Non-goals

- No new database tables (reuses `skarn_stories` + `app_flags`)
- No per-user lore tracking (same stories for everyone, dedup is global)
- No AI generation of lore (all from existing 1653+ stories)
- No changes to the existing topic-triggered story injection (that path continues working alongside this)
