# Plan — Wisdom & pushback (spec: `docs/specs/2026-11-01/deepseek-v4-flash/wisdom-pushback.md`)

Date: 2026-11-01
Ordering note: the lore slice shipped first (commit `57d3208`); tools come after this one.

## Work packages

Five packages, each with a single owner and no overlapping files. WP1–WP3 are independent and run
in parallel; WP4 depends on WP1; WP5 depends on WP4.

### WP1 — Stance lever (new core)

Files (owner only):

- **new** `features/wisdom/stance.js`
- `features/mood/moodManager.js`
- **new** `scripts/smokes/26-stance.js`

Steps:

1. `resolveStance({ userContent, emotionState, familiarity, volumeEnergy })` →
   `{ stance, line, allowHold, pushbackLine }`. Precedence `support > challenge > match >
   observe`, total and fixed.
2. Consequential-claim detector per spec §3.2 — deterministic, no LLM call, excludes questions,
   jokes, taste statements, and messages under 12 chars.
3. `pushbackLine` emitted only for `challenge` + claim (spec §3.3); `allowHold` true only for
   `challenge` + advice request.
4. `moodManager.js`: delete `MOOD_LINES` and `getMoodLine`; keep `evaluateMood` and export it as
   the `volumeEnergy` source. Any other caller of `getMoodLine` is pinned by WP4.
5. Smoke `26-stance.js`: precedence (support beats a claim), claim detection positive/negative
   (taste and jokes excluded), `allowHold` only on challenge+advice, no line for `observe`.

### WP2 — Position store

Files (owner only):

- **new** `features/wisdom/positions.js`
- `features/preprocessing/postProcessor.js`
- **new** `scripts/smokes/27-positions.js`

Steps:

1. `getPositions(userId, guildId)` — `memory_entries` where `type='preference'` and
   `content LIKE 'position:%'`, newest first, capped.
2. `buildPositionLine(currentMessage, positions)` — keyword overlap, returns **one** position or
   `''`. Never dump the list.
3. `postProcessor` prompt gains a `positions[]` field, written through
   `addMemoryEntry(..., 'preference', 'position: ' + claim, 0.5, context)`. Reuse the existing
   type whitelist coercion; a `positions` entry is never a `person` and must never crash the
   batch (see CONTEXT.md §9.7).
4. Smoke `27-positions.js`: write→read roundtrip, prefix filter excludes ordinary preferences,
   overlap picks the right one, no-overlap returns `''`, identical claim deduped by the
   `UNIQUE` constraint.

### WP3 — Pending question

Files (owner only):

- **new** `features/wisdom/pendingQuestion.js`
- **new** `scripts/smokes/28-pending-question.js`

Steps:

1. `recordPendingQuestion(userId, channelId, reply)` — extracts the first `?`-terminated
   sentence, caps at 200 chars, writes `app_state` key `pendingq:<uid>:<cid>` with
   `{ question, askedAt, dodges }`. No-op when the reply has no question.
2. `classifyPendingQuestion(userId, channelId, incoming)` → `{ status:
   'answered'|'partial'|'dodged'|'none', line }`. TTL 30 min; expired state is cleared, not
   reported.
3. `pendingQuestionLine` for `dodged` instructs: answer now, briefly, one line of why — no third
   question. `answered`/`partial` clear state and emit no line.
4. Smoke `28`: roundtrip, TTL expiry, dodge phrases increment, `dodges >= 1` yields the
   answer-now line, answered clears, question extraction caps and trims.

### WP4 — Prompt + role wiring (hot path, single owner)

Files (owner only):

- `features/promptContext.js`
- `persona/identity.js`
- `features/ai/sharedPipeline.js`
- `features/wisdom/socraticEngine.js`

Steps:

1. `socraticEngine.js`: narrow triggers per spec §3.7; suppress on how-to signals; add structured
   `{ requested, line }` while `getSocraticQuestion` keeps today's behaviour (smoke `08`,
   `audit-docs.js:19`).
2. `buildContext`: resolve stance once; apply the D9 veto (`socraticLine` empty unless the hold is
   allowed); return `stance`, `adviceRequested`, `stanceLine`, `pushbackLine`, `positionLine`,
   `pendingQuestionLine`. All new lines gated on `allowPersonalContext`.
3. `identity.js`: drop `moodLine`, add `stanceLine`, `pushbackLine`, `positionLine`,
   `pendingQuestionLine` in the assembly order (stance with the other state lines; pushback
   immediately after `socraticLine`; positions with the untrusted memory block).
4. `sharedPipeline.js`: promote `roleName` to `'advice'` when
   `ctx.stance === 'challenge' && ctx.adviceRequested`, before `buildSystemPrompt`; call
   `recordPendingQuestion` after a successful send when the hold applied. Skip both for
   `isUnaddressed`.
5. Smoke `08` must stay byte-identical in what it asserts; do not edit it to pass.

### WP5 — Eval harness + docs

Files (owner only):

- **new** `scripts/wisdom-eval.js`
- `package.json` (add `eval:wisdom`)
- `CONTEXT.md`
- `docs/reports/2026-11-01/deepseek-v4-flash/wisdom-eval-baseline.md`

Steps:

1. 12 fixed prompts across the 8 situations in spec §5, a seeded temp DB (emotion, familiarity,
   two positions), real prompt assembly, then a judge pass scoring 4 criteria 1-4.
2. Table + totals to stdout and to the report file.
3. `CONTEXT.md`: stance replaces the mood line; positions are a prefixed preference; pending
   question state; the advice role is now reachable; smoke count 27 → 30.
4. Record the baseline (pre-change) numbers by checking out the previous prompt behaviour, or by
   running the eval before WP4 lands if the harness is ready first.

## Verification

- `npm run smoke` — 30 suites; the 4 baseline failures (`08`, `11`, `16`, `17`) stay as they are,
  and `08` must not gain a *new* failure from the veto.
- `npm run audit:docs` — 4/4.
- `npm run eval:wisdom` — reported before/after, 12 prompts, no silent skips.

## Cost

One eval run = 12 replies + 12 judge calls ≈ 24 requests, plus tool/condenser overhead. Run
through `railway run` so the working key is injected; the local `skarn-bot/.env` key is a 401.
