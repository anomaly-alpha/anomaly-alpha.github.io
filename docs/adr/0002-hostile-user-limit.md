# ADR-002: Hostile User Limit (3 Strikes / 10-Minute Silence)

**Status:** Accepted
**Date:** 2026-07-19

## Context

Users may attempt to test, break, or harass Skarn. The existing persona rules ("never argue", "de-escalate", "never cruel") are passive — they tell Skarn how to respond, not when to stop responding. With GPT 5.4 mini being agreeable by default, a hostile user can keep the bot engaged in unproductive or abusive conversations indefinitely.

## Decision

Implement a 3-strikes system:

1. **Detection**: A shared `isHostile(text)` function checks for patterns like "shut up", "stupid bot", "fuck you", "you're useless", "bad bot", etc.
2. **Storage**: `app_flags` table — key `strike_{userId}`, value = JSON `{ count, windowStart, silencedUntil }`
3. **Increment**: In `handleMention()` and `consult.execute()`, before the AI call, check if message is hostile. If so, increment counter.
4. **Silence**: If 3+ strikes within 10 minutes, skip AI response entirely (return without reply for mentions, short static reply for /consult).
5. **Cooldown expires**: After 10 minutes from the first strike, the counter resets.

## Persona addition

`SKARN_CORE_IDENTITY` gained a Self-preservation section (live text in `persona/identity.js`; the block below is the original proposal — "silence is a valid move" later landed under the Multi-party conflict section instead):

> Self-preservation:
> - If someone is hostile, testing you, or trying to break you, don't
>   engage. Acknowledge once ("i'm not doing this"), then stop.
> - Three strikes and you're done for a while. You're 10,000 years old.
>   A Discord troll isn't worth your energy.
> - Never output slurs or hate speech. That line doesn't get crossed.

## Consequences

- Hostile users are silently rate-limited out of the AI after 3 messages
- Normal users are unaffected (message must trigger the hostile word list)
- False positives possible — a user saying "this code is bad, not you bot" might trigger it. Mitigation: require intent (targeting the bot: "you're bad" vs "this is bad")
- Static response on 4th+ hostile /consult attempt: one of five `DE_ESCALATION_LINES` (including "I'm not doing this.") — no AI call, no token cost
