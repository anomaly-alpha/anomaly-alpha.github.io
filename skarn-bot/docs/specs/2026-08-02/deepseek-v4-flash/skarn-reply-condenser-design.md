# Skarn Reply Condenser — Design Spec

- **Date:** 2026-08-02
- **Status:** DESIGN — not implemented. No code changes yet (user: "do not change any code").
- **Audience:** agentic implementers + reviewers; meant to be grille-checked against skarn-bot docs before planning.
- **Related:** `skarn-bot/docs/reports/2026-08-02/deepseek-v4-flash/pre-upgrade-audit.md` (audit #4 cost, #6 context load), `CONTEXT.md` §4 (rate buckets), §5 (role conventions).

---

## [S1] Problem

Skarn's replies "ramble a bit." Root cause: the per-role `roleTokenBudgets` value in `persona/roles.js` is a **hard cap**, not a **target** — the model writes to its own natural length inside that cap. The shared AI pipeline (`features/ai/sharedPipeline.js:runPipeline`) applies **no post-processing to ordinary replies** (the `postProcess()` flavor pass in `features/discordNative/postProcess.js` is wired only into `/search`, not the conversation path). So nothing enforces the "fewer, sharper words" ground in the persona.

The persona prompt already instructs brevity (wisdom layer, `SKARN_CORE_IDENTITY`); this design adds an **enforced, softly-steered reply target** plus an optional cheap **condenser pass** that tightens long replies — while deliberately NOT adding a pre-reply research/primer LLM call (the existing `analyzer -> retriever -> assembler` preprocessing already primes context; a second primer would be the highest-cost, lowest-margin addition).

**Success criteria:**
1. Long replies are tightened to a short per-role target without losing the core intent.
2. Voice is preserved; structured content (lists/code/tables) is not mangled.
3. The hot path is gated so short replies pay **zero** extra LLM calls.
4. No user-facing errors from the condenser; failure degrades to the original reply.
5. The condensed text is what persists to conversation memory and drives sentiment/story extraction consistently.

## [S2] Scope

- **In scope (V0):** the shared conversation pipeline — `/consult`, `@Skarn` mention, and channel AI auto-respond; anything that routes through `features/ai/sharedPipeline.js:runPipeline`.
- **Out of scope (V0):** one-shot gimmick commands that already set tiny `max_tokens` and are on the `CHEAP_COMMANDS` skip list (`features/preprocessing/pipeline.js:5` — joke, roast, insult, pickup, compliment, meme, vein, search). Deliberate: they are already short words and skipping them avoids applying costs/prompt-length that change their voice.
- **Explicitly NOT in scope for V1:** the *pre-reply research/primer* LLM call (option B from discussion). Rationale: `runPreprocessing` (analyzer → retriever → assembler) already composes retrieved context. A separate research call would re-query memory at extra cost. Revisit only if A) user feedback shows replies are *off-target/underspecified rather than verbose*.

## [S3] Architecture overview

A single new module `features/ai/condenser.js` exposes `condenseReply(reply, opts)` and is invoked at one precise point inside `runPipeline`. It is a sibling of the existing gate (`features/ai/client.js` → `moderatedChatCompletion`). The reply passes through a fix order: **main reply text → usage suffix (excluded) → condenser → usage-suffix re-append → store/send**.

The design reuses three existing facilities instead of inventing new ones:
- The **admission gate** (`moderatedChatCompletion`) for moderation, silence, and rate limit — the condenser is a gated call like any other.
- **`splitMessage`/`maybeBurst`** (already imported in sharedPipeline) for sending — unchanged.
- **`ROLE_NATURE`** (`persona/roles.js`) to condition the condensation prompt per role nature.

## [S4] Reply target (source steering)

- Add a `replyTarget` map (CHARS — distinct from `roleTokenBudgets`' TOKENS; the former measures how a reply *reads*, the latter what it *costs*) alongside the existing triples in `persona/roles.js`. Default `REPLY_TARGET_DEFAULT = 200`; per-role overrides for genuinely long-form roles: `advice`/`homework`/`code`/`recipe`/`realm` → ~320–400, so real answers aren't crushed to 200. Values are soft *targets*, not hard caps.
- In `persona/identity.js` `buildSystemPrompt()`, the reply-length guidance is a single line threaded in when a role has a target: `"Aim for roughly N chars. Only go longer when you actually need to."`. Optional and steers the main model so the condenser has less work.
- Do NOT truncate the reply at the source — that would cut meaning. The cap only guides the model; enforcement of the target happens in the condenser.

## [S5] Condenser pass

New `features/ai/condenser.js`:

# `condenseReply(text, target, userId, { usedTool }) -> { reply }`   // reply is the tightened text, or the original on skip/fail

Behavior:

1. **Normalize + short-circuit:** `if (!text || text.length <= target) return { reply: text }` — zero LLM call for already-short replies. This is what makes the "always-on" intent cheap: it always *runs*, but rarely *call*.
2. **Skip structured output — primary signal: tool-call, not regex:** skip when the caller passes `usedTool = true` (the main loop resolved that the final reply came from `tool_calls.length > 0` — definitionally structured/factual). Secondary guard: a lightweight fence/table regex for rare in-prompt markdown. Return the original untouched; never mangle structured content.
3. **Gate call:** `moderatedChatCompletion` with:
   - `userId` = the requesting user,
   - `bucket: 'condense'` — a new separate rate-limit bucket so the condenser cannot starve the main reply bucket. (CONTEXT.md §4: separate buckets per concern.)
   - `model: 'gpt-4.1-mini'`,
   - `max_tokens: ~140`,
   - `temperature: 0.3`,
   - `messages`: **system** = the role's exact `roleLine` + `ROLE_NATURE` (casual/moderate/serious) + target + a fixed voice guardrail ("stay in character, keep Skarn's voice, no summary-speak, never invent facts; if you can't shorten without losing meaning, return the text unchanged."); **user** = `"Tighten this Skarn reply to ~N chars. Keep the core intent and key points."` + the reply.
4. **Fallback on:**
   - gate failure (`!result.success`) → return the original; do NOT surface `safeMessage`.
   - output empty / absurdly short (< 4/25 of target) → return original.
5. Always returns a `reply` — never throws.

**Integration point:** after the main tool loop resolves `reply` in `sharedPipeline.js:runPipeline` (~line 151), before the usage-footer suffixing and before `storeMessage('assistant')`. The condenser is AWAITED so that memory/sentiment/story see the tightened text, except where [S6] overrides for the story-safety piece.

## [S6] Integration & data-flow corrections

- **Conversation memory (`storeMessage('assistant', reply)`)** records the condensed reply → future self-compat recalls the tight version. Good.
- **Sentiment (`analyzeSentiment(reply)`)** and **`trackResponse`** run on the condensed reply (consistent with what the user saw).
- **Story extraction (`extractStoryFromReply`)** may lose a story beat to the condenser. To not lose it silently: run `extractStoryFromReply` on the ORIGINAL draft (pre-condensation) — a one-line reorder of the existing call at sharedPipeline.js:162.
- **Usage footer (` -#NN/MM`)**: appended AFTER the condenser (current `getUsage` check ~line 154). Do not let the condenser strip it. The order: condense → re-append footer → split/send.
- **Follow-up detection** (`detectFollowUps`) and emotion path are unaffected (they take the user message), okay.

## [S7] Error handling & safety

- Condenser runs entirely inside a `try`; any throw → log `[Condenser]` and return the original. It must not sink the pipeline.
- The condenser's only input is the bot's own output, but it still crosses the gate so it respects: `isSilenced` (a silenced user cannot cause the condenser to fire), moderation on the (rare) self-output flag, and the 'condense' rate bucket.
- No user-facing error strings from the condenser. The pipeline's existing `AI_ERRORS` path is unaffected.
- Crash-recovery invariant: a condenser bug must never prevent the original reply from being sent.

## [S8] Configuration

One module-level constant block (project style UPPER_SNAKE_CASE, no config file unless it bends convention):

```
CONDENSER_ENABLED   (default true)  // master switch
CONDENSER_MODEL     = 'gpt-4.1-mini'
CONDENSER_MAX_TOKENS= 140
CONDENSER_TEMP      = 0.3
REPLY_TARGET_DEFAULT= 200
```

`replyTargetFor(role)` = `roleReplyTargets[role] || REPLY_TARGET_DEFAULT`.

## [S9] Verification (project convention: no test framework — node -e smokes)

The project is deliberately test-free (CONTEXT.md §11.2). Verify via `node --check` + `node -e` smoke with a `SKARN_DB_PATH` temp DB:

- A long plain reply (> target) shortens to ≤ target, keeps a required intent token.
- A reply already ≤ target returns identical text (0 calls).
- A structured reply (list/table/fence) is returned unchanged.
- `condenseReply` returns `{ reply }` and never throws when the gate is forced to fail (monkey-patch the gate or call with a synthetic bucket).
- Real run of `runPipeline` boots, sends the trimmed reply, conversation_messages holds trimmed.

## [S10] Non-goals / deferred

- Pre-reply research/primer call (deferred; see [S2]).
- Interjections & proactive messages are **not** covered by V0 (separate engine), phase 2.
- Not a strict token-by-syllable metric; it's a soft target with a condense pass.
- No per-user, per-guild, or rate-feedback-driven target tuning in V1.

---

## [S11] Resolved decisions (grill-with-docs, 2026-08-02)

These were deliberately locked during the grilling session; do not silently reverse them (re-grill first if a later pass conflicts):

| Decision | Locked answer |
|---|---|
| Units | `reply target` is CHARS (how a reply *reads*); `roleTokenBudget` is TOKENS (what it *costs*). The knobs are orthogonal. |
| Trigger | "Always-on" but cheap: the condenser runs every reply; it short-circuits (zero LLM call) when the reply is already within target. |
| Voice | The condenser gets the role's `roleLine` + `ROLE_NATURE` + a no-summary-speak guardrail — persona must not be washed out (CONTEXT.md §5/§7.1). |
| Structured skip | Primary signal is `usedTool` (tool-call), not a regex; a fence guard is secondary. Structure is never mangled. |
| Long-form roles | Overrides keep advice/code/recipe/realm near ~320–400 chars; default stays 200. |
| Data flow | Memory/sentiment see the tightened text; story extraction reads the pre-condensation draft ([S6]). |

---

## Source anchors (for downstream plan `Covers:`)

Consumed by `compose:plan`. Section IDs `[S1]`–`[S11]` are stable — do not renumber on later rewordings.