# Spec: Unify Prompt Assembly Path + Model Default Upgrade

**Status:** Ready for implementation
**Origin:** `docs/skarn-persona-analysis-2026-08-08.md`, Executive Summary items 1 & 5, Quick Win #1, Strategic #8, Open Questions #1 & #4
**Type:** Bug fix (persona drift) + config change, not a new feature

---

## 1. Problem Statement

Two divergent prompt-assembly paths exist:

- **Primary path** (`sharedPipeline.js` → `preprocessing/pipeline.js` → `assembler.js`) — fires on nearly all real @mentions and `/consult` calls. Builds the system prompt from only 8 lines: `SKARN_CORE_IDENTITY` + roleLine + emotionalDirective + memoryLine + knowledgeLine + kbLine + profileLine + conversationLine + channelLine.
- **Fallback path** (`buildContext()` → `buildSystemPrompt()`) — only fires on messages <10 chars or analyzer failure. Builds the full 25+ line bundle including `SKARN_RULES`, `SKARN_FOOTER`, `safetyLine`, `moodLine`, `relationshipLine`, `warmthLine`, `patienceLine`, `socraticLine`, and all wisdom-layer lines.

**Root cause (confirmed):** drift, not design. The wisdom-layer reauthor on 2026-08-01 upgraded `identity.js` and `promptContext.js`, but `sharedPipeline.js:74-92` was never repointed to consume the upgraded output — it still prefers the older thin `assembler.js` result. This is an unintentional regression, not a deliberate lightweight/full split.

**Impact:** every trait upgrade made to the persona (wisdom, patience, kindness, intelligence delivery) is invisible on the primary path. Guardrails (TOS rules, slur safety line, `<untrusted_data>` wrapping) are also silently absent from the path that handles almost all traffic — mitigated by central OpenAI moderation, but not by design.

---

## 2. Goals

- Every live conversational path builds its system prompt through a single source of truth: `buildSystemPrompt()` fed by `buildContext()`.
- No behavioral regression: response latency and the analyzer's model-routing/tiering function must be preserved.
- `assembler.js`, `retriever.js`, and the thin-path branch in `sharedPipeline.js` are retired, not left as dead parallel code.
- Model default is corrected from `gpt-3.5-turbo` to `gpt-5.4-mini`, verified against actual `.env` deployment.

## 3. Non-Goals

- Not implementing Confidant Mode or Friend Tiers (separate spec, Strategic #11 in the report).
- Not reducing the 5-LLM-call-per-message stack (Strategic #10 — separate pass).
- Not changing per-user vs. per-guild rate-limit scoping (Strategic #9 — separate pass).

---

## 4. Design Decision

**Chosen approach: retire the thin path, keep the analyzer for routing only.**

The analyzer (`analyzer.js`, gpt-4.1-mini) currently does two jobs: (1) feeds `retriever.js`/`assembler.js` for thin context, and (2) feeds `modelRouter.js` for complexity-based model selection. Job (1) is being removed. Job (2) is retained — the analyzer's output continues to inform `selectModel()`, it just stops informing prompt assembly.

This was chosen over "backport the missing lines into `assembler.js`" (the alternative from the original report) because:
- Maintaining two prompt-construction implementations is exactly the failure mode that caused this drift in the first place — a future persona edit would need to touch both files again.
- `buildContext()` already exists, is tested (fallback path), and is the full intended design.

---

## 5. Implementation Steps

### 5.1 — Repoint the primary path
**File:** `features/ai/sharedPipeline.js`

- Remove the branch at `sharedPipeline.js:74-92` that chooses between `assemblePrompt()` (thin) and `buildContext()`+`buildSystemPrompt()` (full) based on message length / analyzer success.
- Always call `buildContext()` → `buildSystemPrompt()` for the system prompt, regardless of message length or analyzer outcome.
- Keep the analyzer call (`analyzer.js`) but wire its output only into `modelRouter.selectModel()`. If the analyzer fails, `selectModel()` should fall back to a safe default tier rather than affecting prompt content at all.

### 5.2 — Retire the thin assembly path
**Files:** `features/preprocessing/assembler.js`, `features/preprocessing/retriever.js`, `features/preprocessing/pipeline.js`

- Delete `assembler.js` and `retriever.js` once 5.1 confirms nothing references them.
- Trim `pipeline.js` to only the analyzer step (rename if its responsibility is now solely "message analysis for routing," e.g. `messageAnalysis.js`, at the team's discretion — not required for correctness).

### 5.3 — Guardrail regression check
**File:** `persona/identity.js`

- Confirm `buildSystemPrompt()` unconditionally includes `SKARN_RULES`, `SKARN_FOOTER`, `safetyLine`, and wraps memory/knowledge context in `<untrusted_data>` tags (identity.js:118-129) for every call site now routed through it — not just the ones that previously used the fallback path.

### 5.4 — Clean up related dead code
(Bundled here since it's touched by the same refactor and was flagged in the original report as small/no-risk.)

- Delete `formatKnowledge`/`runKnowledgeDecay` (`knowledgeGraph.js`) — or wire `formatKnowledge` into `promptContext.js:46` if project/event memory should surface in the prompt. **Decision needed from Anomaly** — recommend wiring it in rather than deleting, since it's the only path for extracted projects/events to ever reach Skarn's context.
- Delete `getRecentMessages` (`db/conversation.js:240`) — zero callers, unrelated to this refactor's surviving paths.
- Delete `features/conversation/contextAssembler.js` — deprecated shim, superseded by `buildContext()`.
- Remove or wire `CHEAP_COMMANDS` (`preprocessing/pipeline.js:5`) depending on whether message-length-based cost gating is still wanted elsewhere (see 5.5).

### 5.5 — Preserve the cost-saving intent of the old thin path
The thin path existed for short messages, likely as an implicit cost/latency optimization even if not documented as such. To avoid silently increasing average LLM spend:

- Add an explicit, intentional gate instead: skip the analyzer call entirely (not just prompt assembly) for messages under a length threshold or matching a low-effort pattern, mirroring `isFullTier` logic already in `promptContext.js:28`. This was already recommended independently as Quick Win #6 in the original report — implement it alongside this fix so the unification doesn't regress cost.

---

## 6. Model Default Upgrade

### 6.1 — Verify actual deployment
**Before changing code:** confirm what `.env` currently sets for `AI_MODEL` in the deployed Railway environment — the report could only confirm the *code* default (`gpt-3.5-turbo`, `modelRouter.js:13`), not the live value. Anomaly has indicated `.env` already sets this to `gpt-5.4-mini` — verify this is present in the Railway environment variables (not just local `.env`), since these can drift independently.

### 6.2 — Update the code-level default
**File:** `features/intelligence/modelRouter.js`

- Change the fallback default (used if `AI_MODEL` is ever unset) from `gpt-3.5-turbo` to `gpt-5.4-mini`, so the code's own safety-net matches intent rather than silently downgrading if an env var is ever dropped.
- `AI_MODEL_COMPLEX` currently falls back to `AI_MODEL` if unset (`modelRouter.js:7`) — with `gpt-5.4-mini` as the new baseline, decide whether `AI_MODEL_COMPLEX` should point to full `gpt-5.4` for the highest-complexity tier (>100-char question, knowledge-match, analyzer complexity >0.7), since `gpt-5.4-mini` already approaches `gpt-5.4`-level performance on several benchmarks — the complexity split may now be less necessary than it was under 3.5-turbo, but a genuine capability gap likely still exists between mini and full for the hardest cases.

### 6.3 — Reasoning effort parameter (new capability, not available under gpt-3.5-turbo)
`gpt-5.4-mini` supports a `reasoning.effort` parameter (`none` default, `low`/`medium`/`high`/`xhigh`). This is a lever the old model didn't have. Recommend:

- Main persona call: `low` or `medium` — Skarn's "economy of language" identity trait (fewer, sharper words) doesn't need `xhigh` reasoning, and higher effort adds latency.
- Leave `none`/default for support calls (analyzer routing, tone analysis, condenser) unless testing shows a quality gap — these are cheap, high-frequency calls where latency matters more than depth.
- This should be tuned empirically post-deploy, not fixed permanently in this spec — flag as a follow-up tuning pass, not a blocking decision.

### 6.4 — Consider consolidating hardcoded support-call models
The report noted support calls hardcode `gpt-4.1-mini` (analyzer, condenser, postProcessor) and `gpt-4o-mini` (toneAnalyzer, advice.js) independently of the persona model. Given `gpt-5.4-mini` is described as running 2x+ faster than `gpt-5-mini` with improved reasoning, it's worth a follow-up cost/latency comparison against the currently-hardcoded models — **out of scope for this spec**, flag as a candidate for Strategic #10 (reduce the per-message LLM stack).

---

## 7. Testing / Validation Plan

1. **Persona invariant smokes:** extend `scripts/smokes/08-persona-invariants.js` (already checks no-name-drop / anti-aphorism) to assert that a primary-path (@mention, ≥10 char message) response's system prompt includes `SKARN_RULES`, `safetyLine`, and at least one wisdom-layer line (e.g. `socraticLine` when a trigger is present). This is the regression test that would have caught the original drift.
2. **Manual conversation pass:** run a set of representative @mention messages (short factual question, emotionally loaded message, banter, a message that should trigger Socratic mode) and confirm mood/warmth/patience/socratic lines are present in logged prompts.
3. **Guardrail check:** confirm `<untrusted_data>` wrapping appears around injected memory/knowledge content in logged prompts for the primary path.
4. **Cost/latency spot-check:** compare average LLM calls per message and rough token cost before/after 5.5's gating change, to confirm the unification didn't silently increase spend.
5. **Model default check:** confirm Railway env `AI_MODEL=gpt-5.4-mini` is actually active in production (not just staged), via a logged model name on a live response.

---

## 8. Acceptance Criteria

- [ ] `assembler.js` and `retriever.js` deleted; no remaining references.
- [ ] Every live call site builds its system prompt via `buildSystemPrompt()`.
- [ ] Persona invariant smoke test passes on a primary-path (@mention) message, not just fallback-path.
- [ ] `SKARN_RULES`, `safetyLine`, and `<untrusted_data>` wrapping confirmed present on a primary-path logged prompt.
- [ ] `AI_MODEL` confirmed as `gpt-5.4-mini` in both code-level fallback default and live Railway env.
- [ ] No regression in average calls-per-message (short/banter messages still gated cheaply per 5.5).

---

## 9. Open Follow-Ups (not blocking this spec)

- Wire vs. delete `formatKnowledge` — needs Anomaly's decision (5.4).
- `AI_MODEL_COMPLEX` tiering strategy under the new baseline (6.2).
- `reasoning.effort` tuning per call type (6.3) — empirical, post-deploy.
- Hardcoded support-call model consolidation (6.4) — candidate for a future spec.
