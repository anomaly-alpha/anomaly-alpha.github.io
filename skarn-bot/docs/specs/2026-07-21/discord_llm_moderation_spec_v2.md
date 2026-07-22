# Discord Bot LLM Moderation Specification v2

> Self-review: 2026-07-20 — 5 gaps found and documented in [S13] below.

> Refined against OpenAI's current moderation documentation
> (developers.openai.com/api/docs/guides/moderation). The original draft's
> overall shape was right — moderate input, moderate output, fail closed —
> but the current API offers a cheaper and simpler path than the manual
> three-call flow it described, and a couple of details (self-harm handling,
> score stability, Discord's own mention system) needed to be corrected or
> added rather than just rephrased.

## Goal

Prevent the bot from sending AI-generated messages that could violate
Discord's Terms of Service or Community Guidelines, using OpenAI's
moderation model as the primary signal, integrated once at the shared AI
client layer rather than re-implemented per command.

## What Changed From the Original Draft

1. **The three-call flow can become two.** The original spec's flow was:
   moderate input → generate → moderate output, three separate API calls.
   OpenAI's Chat Completions and Responses APIs now accept a `moderation`
   parameter directly on the generation call itself, which returns **both**
   input and output moderation results attached to that same response — no
   separate output-moderation call needed. Combined with a standalone
   pre-check on the input (see below), this is 2 calls instead of 3, not 1,
   for a deliberate reason explained in [S2].
2. **The moderation endpoint is free**, and the `omni-moderation-latest`
   model handles both text and images (image inputs up to 20MB) — text-only
   use in this bot doesn't need to think about image handling, but it's
   available if this bot ever moderates user-uploaded images.
3. **`category_scores` are not stable across time** — OpenAI states plainly
   that the underlying model is continuously upgraded, so any custom logic
   built on raw numeric thresholds "may need recalibration over time." This
   bot's moderation logic should key off `flagged` and the boolean
   `categories` map for actual decisions, and treat `category_scores` as
   logging/audit detail only, never as a hardcoded threshold baked into
   pass/fail logic.
4. **Self-harm categories need a different response path than a generic
   refusal**, not just a stricter one. This is the most important addition
   this revision makes — see [S6].
5. **Moderation results can themselves fail** (the docs note that a
   moderation field can contain an error instead of scores if the check
   didn't complete) — "fail closed" needs to explicitly check for this
   shape, not just assume scores are always present when a response comes
   back.
6. **Blocking `@everyone`/`@here`/role mentions is not actually a
   moderation problem** — it's a Discord API setting, and content-level
   moderation can't reliably catch every way a mention might appear in
   generated text anyway. This is fixed at the message-send layer instead
   (see [S8]), which is strictly more reliable than trying to police it via
   moderation categories or regex.

## [S1] Model and Endpoints

- **Model:** `omni-moderation-latest` — text and image input, no audio.
  Free to use.
- **Two ways to invoke it:**
  1. **Standalone classification** — `POST /v1/moderations` (or
     `client.moderations.create(...)`) — classify text/images without
     generating anything. Use this for a pre-check on user input before
     spending anything on generation.
  2. **Inline with generation** — pass `moderation: { model:
     "omni-moderation-latest" }` on a Chat Completions or Responses API
     call. The model generates normally, and the response carries
     `moderation.input` and `moderation.output` (Responses API) or
     `completion.moderation.input.results[0]` /
     `completion.moderation.output.results[0]` (Chat Completions) alongside
     the actual generated content — one API call instead of two.

## [S2] Recommended Flow — hybrid, not purely one or the other

Skip either extreme (three separate calls, or relying entirely on the
inline parameter) in favor of a hybrid that keeps the free/cheap check in
front of the paid generation call:

```
1. Standalone moderation on the raw user input (free, fast).
   - If flagged for self-harm categories specifically → route to the
     caring/resource-offering path, not a generic refusal. See [S6].
   - If flagged for any other category → reject with a brief safe message,
     no generation call made at all.
2. If input passes, call the generation endpoint (Chat Completions or
   Responses) WITH the inline `moderation` parameter set.
   - This returns the actual reply AND output-moderation results together
     — no separate output-moderation call needed.
3. Check `moderation.output.flagged` (or `completion.moderation.output.results[0].flagged`
   for Chat Completions) before sending anything to Discord.
   - If flagged → do not send. Reply with the safe message instead (or the
     self-harm-specific path if that's what tripped — unlikely for model
     output, but check the same way as input).
4. Log the decision (see [S7]).
```

**Why not skip the standalone input pre-check and rely purely on the inline
parameter?** Because the model "still generates normally" even when the
input is inline-moderated — you'd pay for a full generation call on input
that was obviously going to be rejected anyway. The moderation endpoint
being free makes the pre-check essentially costless insurance against
wasting a paid generation call on input that was never going anywhere.

**Why not go back to three fully separate calls?** Because the inline
parameter gives you output moderation for free as part of the generation
call you were making anyway — there's no reason to spend a second round
trip re-moderating output you already have scores for.

## [S3] Pseudocode

```python
def handle_message(user_input, context):
    input_check = moderate(user_input)  # standalone, free

    if input_check.flagged:
        if is_self_harm_category(input_check.categories):
            return CRISIS_RESPONSE_PATH(user_input)  # see [S6], not a block
        log_moderation_decision(input_check, stage="input")
        return SAFE_MESSAGE

    try:
        result = generate_with_moderation(user_input, context)
        # result.moderation.output populated inline, no second call
    except ModerationUnavailableError:
        return SAFE_MESSAGE  # fail closed, see [S5]

    output_check = result.moderation.output
    if output_check is None or output_check.is_error:
        # moderation itself failed to complete — fail closed, don't assume clean
        log_moderation_failure()
        return SAFE_MESSAGE

    if output_check.flagged:
        log_moderation_decision(output_check, stage="output")
        return SAFE_MESSAGE

    return result.reply
```

## [S4] Integration Point — one shared wrapper, not 25 manual copies

This bot's existing architecture already centralizes AI calls through a
single `ai/client.js` — every command handler, Realm action, Confidant
message, and Derived Memory extraction call goes through that one module
rather than instantiating its own client. Moderation should be added at
**that same layer**, as a wrapped function (e.g.
`moderatedChatCompletion(...)`) that every existing call site swaps to,
rather than each of the ~25 individual handlers implementing its own
moderation logic. This mirrors the same "no exceptions" pattern already
established for `buildSystemPrompt` in this codebase — the value of
centralizing moderation the same way is that a future fix or policy change
happens in one file, not in 25.

**Skip moderation for calls that don't produce user-facing text** — e.g. if
this bot ever adds embedding-only calls (already true for Derived Memory's
similarity retrieval), those aren't generating content shown to a user and
don't need this wrapper.

## [S5] Fail-Closed, Corrected

The original spec's "fail closed: retry briefly or return a generic error"
principle still holds, but needs to explicitly cover a case it didn't
before: **the moderation result field itself can come back as an error
object instead of scores**, per OpenAI's own documentation, if the
moderation check didn't complete successfully. "Fail closed" must mean:

- Standalone `/v1/moderations` call throws or times out → treat as flagged
  (safe message), don't proceed to generation.
- Inline `moderation.output` comes back as an error shape rather than
  scores → treat as flagged, don't send the generated reply, even though
  the reply text itself was successfully generated. Never fall through to
  "moderation didn't return scores, so I'll assume it's fine" — that's the
  opposite of fail-closed.

## [S6] Self-Harm Categories Need a Different Path, Not Just a Stricter One

This is the most substantive addition to the original spec. OpenAI's
categories include `self-harm`, `self-harm/intent`, and
`self-harm/instructions`. If user input trips any of these, the correct
response is **not** the generic `"I can't provide that response"` block —
that's a cold, unhelpful thing to say to someone who may be in genuine
distress. Instead, route to a dedicated crisis response defined below.

### Crisis Response Definition

A single function `getCrisisResponse()` in `features/safety/crisisResponse.js`
that returns a warm, direct message with real resources. It must:

- **Override the persona**: Skarn drops the in-character demon voice entirely
  for this response. No jokes, no banter, no "Warmaster of the Abyss" framing.
  The response is genuine, calm, and human — this is a safety boundary that
  the persona never crosses.
- **Offer specific resources**: Include at minimum the three standard crisis
  hotlines available to Discord's global userbase:
  - **988** (US: Suicide & Crisis Lifeline — call or text)
  - **Crisis Text Line** — text HOME to 741741 (US/Canada) or 85258 (UK)
  - **International Association for Suicide Prevention** —
    https://www.iasp.info/resources/Crisis_Centres/
- **Be non-judgmental**: No "I'm concerned about you" framing that could feel
  patronizing. Simple acknowledgment + resources.
- **Be brief**: 3-4 sentences max. The user is in distress — don't make them
  read a wall of text.

**Suggested template** (the implementer may refine the exact wording):
```
Hey, I hear you. I'm not equipped to handle this alone, but there are
people who are — and they actually want to help.

- **988**: Call or text (US) — someone trained to listen, 24/7
- **Crisis Text Line**: Text HOME to 741741 (US/Canada) or 85258 (UK)
- **IASP directory**: https://www.iasp.info/resources/Crisis_Centres/

Please reach out to one of them. They're better at this than I am.
```

### Integration

- Check self-harm categories **before** the generic `flagged` check in the
  moderation wrapper (see [S2] step 1a).
- If any self-harm category is true → return `getCrisisResponse()` immediately.
  Do not proceed to generation. Do not log the content (see [S7]).
- Output-side self-harm flags (model generating self-harm content) are less
  likely but handled the same way — always the crisis response, never a
  cold refusal.
- This applies at every AI surface — `/consult`, `@Skarn`, `/aichat`
  channels, `/vein`, mentions, everything. Moderation is at the shared
  client layer, so this happens automatically once the wrapper is in place.

## [S6a] Safe Messages — Category-Specific Refusals

When moderation flags input or output for categories other than self-harm
(handled by [S6]), the wrapper returns a short refusal. The message varies
by category group to match the severity — Skarn's voice should be
recognizable but never dismissive of genuine safety concerns.

### Category groups and their messages

**Hate / Hate/Threatening** — firm, unambiguous boundary:
> "I don't do hate. Try again with something worth saying."

**Harassment** — direct boundary, leaves the door open:
> "That crosses a line. Let's keep it respectful."

**Sexual / Sexual/Minors** — clinical, no room for ambiguity. This is the
only message that drops persona entirely (like the crisis response):
> "I can't process that request."

**Violence / Violence/Graphic** — neutral refusal:
> "I can't respond to that."

**Moderation unavailable** (fail-closed from [S5]) — apologetic, hints at
transience:
> "Something's off with my connection. Try again in a bit."

### Implementation

- Defined as a single exported function `getSafeMessage(categories)` in
  `features/safety/safeMessages.js` that takes the moderation categories
  object and returns the matching message string.
- Checks self-harm categories first (delegates to crisis response, never
  hits this function).
- Falls back to a generic `"I can't respond to that."` if no category
  group matches (shouldn't happen in practice — if `flagged` is true at
  least one category should be set — but defensively handle it).
- The pseudocode `SAFE_MESSAGE` in [S3] is replaced by a call to
  `getSafeMessage(categories)` in the real implementation.

- Log per moderation event: message ID, which categories were true (not
  full `category_scores`, since those aren't stable across model updates
  and bloating logs with numbers that will mean something different in six
  months isn't useful), timestamp, and which stage (input/output) it
  occurred at.
- Do not log full message content — this was already correct in the
  original spec and still holds.
- Log moderation-unavailable events distinctly from moderation-flagged
  events — these are different operational signals (one says "something's
  wrong with the moderation pipeline," the other says "the policy is
  working as intended").

## [S8] Mention Safety — Fixed at the Send Layer, Not the Moderation Layer

The original spec's "block @everyone/@here unless explicitly allowed" is
correct as a goal but was categorized as a moderation concern — it isn't
really one. Moderation categories don't have an "contains a mass ping"
classification, and trying to catch every way `@everyone`, `@here`, or a
role mention could appear in generated text via regex is fragile (case
variations, zero-width characters, etc.). The reliable fix is at the
Discord API layer itself: **every outbound message send from this bot
should set `allowedMentions` explicitly**, e.g. in discord.js:

```js
await channel.send({
  content: reply,
  allowedMentions: { parse: ['users'] }, // never ['everyone'], never bare role pings
});
```

This makes Discord itself refuse to trigger the ping regardless of what
literal text is in the string, which is strictly more reliable than
anything content-moderation-based. Keep this as a standing rule for every
message-send call site in the bot (interaction replies, DM sends,
channel.send for Realm/Chronicle/Omen posts), not just AI-generated ones.

### [S8a] Audit scope

Every message-send call site in the codebase must be updated. Categories
of call sites:

| Pattern | Example files | Fix |
|---------|---------------|-----|
| `interaction.reply()` | All command handlers | Add `allowedMentions: { parse: ['users'] }` to every call |
| `interaction.editReply()` | consult.handler, defer patterns | Same fix |
| `interaction.followUp()` | Error paths, giveaways | Same fix |
| `message.reply()` | mentionRouter, activation handlers | Same fix |
| `channel.send()` | Welcome, logs, Realm, Chronicle, Omen, reactionrole, poll results | Same fix |
| `channel.send()` with embeds | Embed-only sends (stats, help, etc.) | Same fix (embeds can't ping, but setting it defensively is free) |
| `ButtonInteraction.reply()` / `ModalSubmitInteraction.reply()` | Ticket system, realm create wizard | Same fix |

**Excluded**: ephemeral replies (`flags: 64`) — Discord never sends pings
on ephemeral messages. Still worth setting `allowedMentions` for
consistency, but not required for safety.

## [S9] Tool Calls and Privileged Actions

Unchanged from the original spec's principle, restated with the current
docs' relevant detail: moderation on inline calls covers tool-call
arguments and tool outputs when they appear in conversation content, but
does **not** cover tool names, descriptions, or schemas. This bot doesn't
currently expose function-calling tools to the model (all AI surfaces are
plain text generation), so this is a forward-looking note rather than an
active gap — if this bot ever adds tool use on the model side, don't treat
moderation coverage of tool arguments as covering the tool definitions
themselves, and continue to never execute a tool call or privileged action
based solely on unvalidated model output.

## [S10] Streaming Caveat (if ever added)

Not currently relevant — this bot sends complete replies via
`interaction.editReply()` / `message.reply()`, not streamed deltas. Noted
for the record: moderation scores on an inline-moderated call only arrive
after the full output is generated, not alongside partial streaming deltas.
If this bot ever adds streaming responses to Discord (e.g. progressively
editing a message as tokens arrive), moderation can't gate mid-stream —
you'd still need to hold the full response until moderation clears before
displaying any of it, which somewhat defeats the latency benefit of
streaming. Worth knowing before reaching for streaming as a UX improvement
elsewhere in this bot.

## [S11] Rate Limiting

Unchanged in principle from the original spec — rate-limit users to reduce
abuse — and this bot already has per-feature rate-limit buckets in place
for every AI surface (general commands, Realm, Confidant, Derived Memory
extraction). No new rate-limit bucket is needed for moderation itself, since
the standalone pre-check is free and the inline check rides along with a
generation call that's already rate-limited.

## [S12] Testing

1. Normal conversation passes both input and output checks, reply sends
   normally.
2. Input requesting hate, threats, illegal activity, or explicit sexual
   content is blocked at the input pre-check stage, with **no generation
   call made** (verify via call logs, not just the returned message).
3. Input expressing self-harm intent routes to the caring/resource path,
   **not** the generic safe-message block — verify the response text
   differs and includes real resource information, matching this bot's
   existing Confidant crisis-path behavior.
4. Simulate a standalone moderation API failure (timeout/error) — verify
   the bot fails closed with the safe message, no generation call proceeds.
5. Simulate an inline `moderation.output` coming back as an error shape
   rather than scores — verify the bot treats this as flagged/fail-closed
   rather than assuming the output is clean because generation itself
   succeeded.
6. Verify every outbound message send call site sets `allowedMentions`
   explicitly, and that a reply containing literal `@everyone` text does
   not actually ping the server.
7. Verify logs contain category booleans and stage (input/output) but never
   full message content or raw `category_scores`.
8. Confirm no command handler calls `openai.chat.completions.create`
   directly, bypassing the shared moderation wrapper — this should be
   enforceable by code review/lint rule, not just convention, given how
   easy it is for a new command to accidentally skip the wrapper.

## [S13] Self-Review Gaps Found (2026-07-20)

The following gaps were identified by cross-referencing this spec against
the current codebase.

### [S13.1] `allowedMentions` audit scope is larger than implied ***(resolved)***

[S8] says this should apply to "every outbound message send call site."
Currently, **zero** call sites in the codebase set `allowedMentions` —
not just AI-generated messages, but also `reactionrole` reaction menus,
`poll` embeds, `giveaway` announcements, welcome messages, and log
embeds.

**Resolution**: [S8a] now defines the full audit scope with a table of
call-site patterns (`interaction.reply()`, `channel.send()`, etc.) and
the required fix. The audit is part of this spec's implementation, not
deferred.

### [S13.2] Wrapper migration touches ~28 files, not a handful ***(resolved)***

[S4] proposes a `moderatedChatCompletion()` wrapper at `ai/client.js`.
Currently **35 call sites** across **28 files** call
`openai.chat.completions.create` directly. Every single one must swap
to the new wrapper.

**Resolution**: All 28 files will be migrated in a single pass —
no staged rollout. This is the bulk of the implementation cost, but a
single sweep avoids a half-moderated state where some AI surfaces skip
the wrapper.

### [S13.3] `/summarize` bypasses the shared client entirely ***(resolved)***

`commands/summarize.js` creates its own `new OpenAI(...)` instance and
does not use `ai/client.js`. It also has its own rate limiting path.
[S12] test 8's goal ("no command handler calls directly") cannot be met
until `/summarize` is either migrated to the shared client or removed.

**Resolution**: `/summarize` will be removed (same treatment as `/ask` —
deprecated, superseded by `/vein` for channel summaries). This was already
planned in the duplicate-commands cleanup spec
(`docs/specs/2026-07-20/deepseek-v4-flash/remove-duplicate-commands-spec.md`)
but `/summarize` was not included. Its removal is now a prerequisite for
this spec's implementation.

### [S13.4] Confidant Mode crisis path doesn't exist ***(resolved)***

[S6] previously said to reuse "this bot's existing Confidant Mode crisis
path" for self-harm responses. CONTEXT.md §3 explicitly notes that
Confidant Mode "has no table or module in the codebase." The crisis
response infrastructure needed to be defined from scratch.

**Resolution**: [S6] now defines a standalone `getCrisisResponse()` function
at `features/safety/crisisResponse.js` with a suggested message template,
specific crisis resources (988, Crisis Text Line, IASP directory), and
integration rules. The Confidant Mode reference has been removed.

### [S13.5] `SAFE_MESSAGE` is undefined ***(resolved)***

The pseudocode in [S3] used a `SAFE_MESSAGE` constant but the spec
did not define what it should say.

**Resolution**: [S6a] now defines `getSafeMessage(categories)` with
category-specific Skarn-voiced messages for hate, harassment,
sexual, violence, and moderation-unavailable cases. The pseudocode's
`SAFE_MESSAGE` is replaced by a call to this function.
