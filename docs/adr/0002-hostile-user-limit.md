# ADR-002: Hostile User Limit (3 Strikes / 1 Hour Silence)

**Status:** Accepted
**Date:** 2026-07-19

## Context

Users may attempt to test, break, or harass Skarn. The existing persona rules ("never argue", "de-escalate", "never cruel") are passive — they tell Skarn how to respond, not when to stop responding. With GPT 5.4 mini being agreeable by default, a hostile user can keep the bot engaged in unproductive or abusive conversations indefinitely.

## Decision

Implement a 3-strikes system:

1. **Detection**: A shared `isHostile(text)` function checks for patterns like "shut up", "stupid bot", "fuck you", "you're useless", "stop", "bad bot", etc.
2. **Storage**: `app_flags` table — key `hostile_{userId}_strikes`, value = JSON `{ count, windowStart }`
3. **Increment**: In `handleMention()` and `consult.execute()`, before the AI call, check if message is hostile. If so, increment counter.
4. **Silence**: If 3+ strikes within 1 hour, skip AI response entirely (return without reply for mentions, short static reply for /consult).
5. **Cooldown expires**: After 1 hour from the first strike, the counter resets.

## Persona addition

In `SKARN_CORE_IDENTITY`, add a Self-preservation section:

> Self-preservation:
> - If someone is hostile, testing you, or trying to break you, don't
>   engage. Acknowledge once if you want ("i'm not doing this"), then
>   stop. You're 10,000 years old — you've dealt with worse. Silence
>   is a valid response.
> - Your job is to be a warm presence, not a punching bag.

## Consequences

- Hostile users are silently rate-limited out of the AI after 3 messages
- Normal users are unaffected (message must trigger the hostile word list)
- False positives possible — a user saying "this code is bad, not you bot" might trigger it. Mitigation: require intent (targeting the bot: "you're bad" vs "this is bad")
- Static response on 4th+ hostile /consult attempt: "i'm not doing this" — no AI call, no token cost
