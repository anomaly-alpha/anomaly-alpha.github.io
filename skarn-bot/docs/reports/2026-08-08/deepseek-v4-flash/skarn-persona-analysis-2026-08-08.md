# Skarn Persona & Capability Analysis — 2026-08-08

Read-only analysis of skarn-bot's current persona, capabilities, and upgrade paths. No code was modified. Every claim cites file + line.

---

## 1. Executive Summary

- **The wisdom layer lives in the identity, but the primary runtime path largely bypasses it.** The main consult/mention pipeline (`features/ai/sharedPipeline.js`) routes through the preprocessing pipeline, whose `assembler.js` builds the system prompt from **only** `SKARN_CORE_IDENTITY` + role line + a handful of context lines. **`SKARN_RULES`, `SKARN_FOOTER`, `safetyLine`, `moodLine`, `relationshipLine`, `socraticLine`, `emotionalLine`, `warmthLine`, `patienceLine`, `newsLine`, `loreLine`, `dreamLine`, and 15+ other context lines never reach the model on the primary path** — they only appear via the fallback `buildContext()` path, which fires for messages < 10 chars or when the analyzer fails.
- **Guardrail gap on the primary path:** `SKARN_RULES` (Discord TOS + `<untrusted_data>` handling) and the slur `safetyLine` are absent from the assembler path, and memory/knowledge lines are injected **raw without `<untrusted_data>` wrapping** (`assembler.js:10-12` vs `identity.js:118-129`). OpenAI moderation still gates centrally (`ai/client.js:14-39, 57-67`), so severity is bounded — but the prompt-level protections are missing on the main path.
- **Confidant Mode and Friend Tiers are spec-only.** Both "known features" exist only as design docs (`docs/specs/2026-07-18/sonnet-5-medium/confidant-mode-v2.md`, `docs/specs/2026-07-19/sonnet-5-medium/friend-tiers-permissions.md`). No module, no table, no command. `CONTEXT.md:52` already flags the Confidant drift. Friend-tier gating — the only true per-user "what Skarn can say" system in the docs — is unimplemented.
- **Dead code:** `features/intelligence/knowledgeGraph.js` (`formatKnowledge`, `runKnowledgeDecay`) has **zero callers**; `getRecentMessages` (`db/conversation.js:240`) has zero callers; `features/conversation/contextAssembler.js` is a deprecated shim; `CHEAP_COMMANDS` (`preprocessing/pipeline.js:5`) is exported but never consumed.
- **Cost/latency:** a single mention/consult can fire up to **5 LLM calls**: analyzer (`gpt-4.1-mini`, `analyzer.js:32`) + tone analysis (`gpt-4o-mini`, `toneAnalyzer.js:55`) + main call + condenser (`gpt-4.1-mini`, `condenser.js:11`) + postProcessor extraction (`gpt-4.1-mini`, `postProcessor.js:26`). The analyzer call also gates which prompt assembly path runs.
- **Default persona model is `gpt-3.5-turbo`** (`modelRouter.js:13`, `AI_MODEL` env default) — a weak base for the "wiser/more intelligent" ambitions; support calls hardcode `gpt-4.1-mini`/`gpt-4o-mini` instead of the persona call itself.

**Top 3 recommended actions**
1. **Unify prompt assembly on `buildSystemPrompt()`** — make the primary path use the full context bundle (or at minimum add `SKARN_RULES` + `SKARN_FOOTER` + `safetyLine` + untrusted-wrapping to `assembler.js`). Highest impact/effort ratio.
2. **Delete the dead code and resolve the spec-only features** (Confidant Mode, Friend Tiers) — either implement or formally de-scope in CONTEXT.md.
3. **Raise the default model** and add a per-guild chat spend budget.

---

## 2. Files Read

| File | Role | Status |
|---|---|---|
| `persona/identity.js` | `SKARN_CORE_IDENTITY`, `SKARN_RULES`, `SKARN_FOOTER`, `buildSystemPrompt()` — canonical persona | Live, canonical |
| `persona/roles.js` | 37 role lines + `roleTokenBudgets` + `ROLE_NATURE` + reply targets | Live (3-way key duplication, no guard) |
| `persona/examples.js` | `EXAMPLE_DIALOGUES` + `buildExamplesLine` | Live |
| `features/preprocessing/pipeline.js` | 3-stage analyzer→retriever→assembler chain | Live |
| `features/preprocessing/analyzer.js` | LLM message analyzer (`gpt-4.1-mini`, 300 tok) | Live — extra call per message |
| `features/preprocessing/retriever.js` | Thin context retrieval for assembler path | Live |
| `features/preprocessing/assembler.js` | **Thin prompt builder — drops most persona context** | Live — the core gap |
| `features/preprocessing/postProcessor.js` | Entity extraction → memory (Derived Memory write) | Live |
| `features/promptContext.js` | `buildContext()` — the full 25+ line context bundle | Live — fallback only |
| `features/ai/sharedPipeline.js` | `runPipeline()` — main consult/mention pipeline | Live |
| `ai/client.js` | OpenAI singleton + `moderatedChatCompletion()` gate | Live, canonical gate |
| `features/ai/condenser.js` | Reply condenser (char target, fail-open) | Live |
| `features/mentionRouter/mentionRouter.js` | @mention entry → sharedPipeline | Live |
| `features/consult/consult.handler.js` | /consult entry → sharedPipeline | Live |
| `features/mood/moodManager.js` | 6 guild moods incl. `wrath` | Live |
| `features/channelState/stateTracker.js` | 4 channel states | Live |
| `features/channelState/stateDecay.js` | Decay pass (only Dormant assigner) | Live |
| `features/warmth/warmthManager.js` | Warmth + patience + active listening | Live |
| `features/etiquette/etiquetteEngine.js` | Gratitude/firstOfDay/milestone/apology | Live |
| `features/wisdom/emotionalIntelligence.js` | 5 directive systems + emotion tracking | Live |
| `features/wisdom/socraticEngine.js` | 18-trigger socratic line | Live |
| `features/wisdom/storyEngine.js` | Story topic engine + lore batch | Live |
| `features/wisdom/growthTracker.js` | Growth lines + weekly eval | Live |
| `features/wisdom/loreAssembler.js` | Lore + dream lines | Live |
| `features/humor/callbackEngine.js` | Callback/banter lines | Live |
| `features/humor/comedyTiming.js` | Deadpan budget + banter chains | Live |
| `features/intelligence/modelRouter.js` | `selectModel()` + knowledge match | Live |
| `features/intelligence/toneAnalyzer.js` | LLM tone analysis (`gpt-4o-mini`) | Live |
| `features/intelligence/responseLearner.js` | Hit/miss tracking | Live |
| `features/intelligence/knowledgeGraph.js` | `formatKnowledge()` + decay | **Dead — zero callers** |
| `features/intelligence/embeddings.js` | `embedText`, `cosineSimilarity` | Live |
| `features/etch/etch.handler.js` | /etch write | Live |
| `features/memory/memory.handler.js` | /memory read | Live |
| `features/memory/memoryExtractor.js` | Wrapper → postProcessor | Live |
| `features/relationship/relationshipTracker.js` | Familiarity tiers, tags | Live |
| `features/activation/activationRegistry.js` | Text activation registry | Live |
| `features/tools/toolDefinitions.js` | 10 tools incl. `run_command` | Live |
| `features/tools/toolRunner.js` | Tool dispatch + permission gate | Live |
| `features/safety/slurFilter.js` | `safetyLine`, strikes, silence | Live |
| `features/safety/safeMessages.js` | Moderation block messages | Live |
| `features/safety/crisisResponse.js` | Self-harm crisis response | Live |
| `features/authenticity/reactionController.js` | 10% reaction-only | Live |
| `features/serverMemory/signalStore.js` + `signalCapture.js` | Server signals | Live |
| `features/serverMemory/omen/omenJob.js` + `omenCommand.js` | Omen gen/fulfill | Live |
| `features/serverMemory/chronicle/chronicleJob.js` | Weekly chronicle | Live |
| `features/conversation/messageStore.js` | Thread/message store + embeddings | Live |
| `features/conversation/summarizer.js` | Thread summarizer | Live |
| `features/conversation/contextAssembler.js` | Deprecated shim → buildContext | **Dead** |
| `features/presence/interjectionEngine.js` | Passive interjections | Live |
| `features/search/search.handler.js` | /search | Live |
| `features/vein/vein.handler.js` | /vein | Live |
| `features/realm/aiDriver.js` | Realm AI driver | Live (head read) |
| `lib/rateLimit.js` | Atomic per-user buckets | Live |
| `bot.js` | messageCreate routing (Steps 1-11) | Live |
| `db/conversation.js` | Conversation queries + embeddings | Live; `getRecentMessages` dead |
| `db/skarn-schema.sql` | All tables | Live — **no friend_tiers/confidant tables** |
| `docs/specs/2026-07-18/sonnet-5-medium/confidant-mode-v2.md` | Confidant spec | **Spec-only** |
| `docs/specs/2026-07-19/sonnet-5-medium/friend-tiers-permissions.md` | Friend tiers spec | **Spec-only** |

---

## 3. Prompt Assembly Trace

### Primary path (message ≥ 10 chars, analyzer succeeds)

```
bot.js:175 messageCreate
 → handleMention (mentionRouter.js:6) / consult.execute (consult.handler.js:5)
 → runPipeline (sharedPipeline.js:46)
   ├─ storeMessage (user)           sharedPipeline.js:59
   ├─ updateEmotion → toneAnalyzer (gpt-4o-mini)  sharedPipeline.js:65, emotionalIntelligence.js:17-28
   ├─ runPreprocessing (pipeline.js:7)
   │   ├─ analyzeMessage (gpt-4.1-mini, 300 tok)   analyzer.js:31
   │   ├─ retrieveContext           retriever.js:5
   │   └─ assemblePrompt            assembler.js:3   ← SYSTEM PROMPT BUILT HERE
   ├─ story injection               sharedPipeline.js:99-105
   ├─ reply-target hint             sharedPipeline.js:107-110
   ├─ moderatedChatCompletion       sharedPipeline.js:125, gate: client.js:41
   │   └─ selectModel               modelRouter.js:3
   ├─ condenseReply (gpt-4.1-mini)  sharedPipeline.js:166
   └─ extractMemory (gpt-4.1-mini)  sharedPipeline.js:234, postProcessor.js:25
```

**assembler.js system prompt = `SKARN_CORE_IDENTITY` + roleLine + `emotionalDirective` + `memoryLine` + `knowledgeLine` + `kbLine` + `profileLine` + conversationLine + channelLine** (assembler.js:3-27).

**Missing vs buildSystemPrompt:** `SKARN_RULES`, `SKARN_FOOTER`, `safetyLine`, `moodLine`, `relationshipLine`, `cultureLine`, `warmthLine`, `patienceLine`, `callbackLine`, `gratitudeLine`, `firstOfDayLine`, `milestoneLine`, `apologyLine`, full `emotionalLine`, `trajectoryLine`, `memoryEmotionLine`, `escalationLine`, `calibrationLine`, `climateLine`, `newsLine`, `socraticLine`, `lorebookLine`, `ragLine`, `guidanceLine`, `serverWisdomLine`, `dreamLine`, `growthLine`, `followUpLine`, `loreLine`, `examplesLine`, plus `<untrusted_data>` wrapping.

### Fallback path (message < 10 chars, or analyzer failure)

```
sharedPipeline.js:83-92
 → buildContext (promptContext.js:21)   — the full 25+ line bundle
 → buildSystemPrompt (identity.js:111)  — full assembly incl. SKARN_RULES, SKARN_FOOTER, safetyLine, untrusted wrapping
```

### Other call sites (all use `buildSystemPrompt` directly, thin contexts)

`interjectionEngine.js:39-42`, `omenJob.js:21,40`, `chronicleJob.js:30`, `vein.handler.js:80-84`, `search.handler.js:51-54`, `realm/aiDriver.js:24`, `commands/advice.js:20` (role line only).

### Model & call configuration

- `AI_MODEL` default `gpt-3.5-turbo`; `AI_MODEL_COMPLEX` falls back to `AI_MODEL` (modelRouter.js:4,7,13). Complex chosen on knowledge-match, >100-char question, or analyzer complexity > 0.7 (modelRouter.js:10-12).
- Hardcoded: `gpt-4.1-mini` (analyzer, condenser, postProcessor), `gpt-4o-mini` (toneAnalyzer:55, advice.js:25), `gpt-3.5-turbo` (search, vein, interjection, storyEngine:72, summarizer).
- Temperature per call: analyzer 0.1, tone 0.1, condenser 0.3, main chat 0.8-0.85, omen 0.9, creative 0.95-1.0.

---

## 4. Current Persona Snapshot

- **Identity** (identity.js:1-80): Skarn, Warmaster of the Abyss, 10,000 years old, retired demon. Wisdom reauthor with 8 sections + "Wisdom Through Millennia" (5 trait directives) + anti-drift guardrails (no aphorisms, no therapy-speak, no excessive humility, no lecturing, mood-modulated expression) + 2 voice example pairs. Bedrock 3 paragraphs preserved.
- **Rules** (identity.js:82-109): Discord TOS guardrails, positive demon energy, sense of self, `<untrusted_data>` untrusted-data handling.
- **Footer** (identity.js:163): "Speak with fewer, sharper words… The restraint is the strength."
- **Roles** (roles.js:1-40): 37 role lines; `consult` default; realm roles restrict content (roles.js:32-34).
- **Channel state** (stateTracker.js:9-14): Dormant/Attentive/Charged/Weathering lines; Charged = "sharper and shorter, more opinionated."
- **Guild mood** (moodManager.js:3-10): refreshed/neutral/tired/amused/focused/wrath; wrath = "shorter sentences, sharper edges, but the restraint stays."
- **Emotion** (emotionalIntelligence.js:201-224): per-state directives (happy/sad/anxious/angry/stressed) + tone subtext.
- **Socratic** (socraticEngine.js:14-17): 18 triggers → "Prefer the sharper question over the answer… offer the answer only when asked twice."
- **Memory at runtime:** etch facts (≤10) + interest-type extracted entries only (promptContext.js:42-46); projects/events extracted but never formatted into the prompt (`formatKnowledge` is dead).

---

## 5. Trait-by-Trait Assessment

| Trait | Status | Evidence | Undercuts |
|---|---|---|---|
| **Wiser** | Strong in identity; **weak in delivery** | Wisdom sections identity.js:38-44,60-65; socratic engine socraticEngine.js:14-17 | Socratic line only on fallback path; assembler path never sees it |
| **More patient** | Strong in identity; context fallback-only | Patience identity.js:16,62; patienceLine warmthManager.js:84-101 | Wrath mood + Charged state add "shorter/sharp" — by design, but only on full path; patienceLine's "drop the wit, give the answer straight" (warmthManager.js:98) is a mild anti-wit nudge |
| **More knowledgeable** | **Weakest** — model + context limits | Knowledge synthesis identity.js:63; KB search, news, lore exist | **Default gpt-3.5-turbo**; knowledgeLine/newsLine/loreLine all fallback-only; extracted projects/events never formatted (dead formatKnowledge) |
| **More kind** | Strong in identity; context fallback-only | Kindness identity.js:10,53-54,64; emotion directives emotionalIntelligence.js:205-209 | 10% reaction-only can reply to a venting message with an emoji (reactionController.js:1-13) |
| **More intelligent** | Well-specified; model-capped | Economy of language identity.js:8,65; condenser enforces 200-char target (condenser.js:37-40) | Intelligence ceiling = gpt-3.5-turbo default; guidance/calibration lines (responseLearner) fallback-only |
| **In-character demon Warmaster** | Strong | Menace+command identity.js:70; wrath mood moodManager.js:9; realm/omen/presence roles | On primary path, SKARN_RULES (sense of self) is absent |

**Design principle check (no name-drops, no lecturing):** upheld in the prompt — philosopher names banned and asserted (smokes/08-persona-invariants.js:41-46); anti-aphorism guardrails explicit (identity.js:67-72). Drift risk is low in the identity but **high at runtime** because the primary path drops the anti-drift context lines.

---

## 6. Capability Gaps

### Persona / assembly
- **Dual divergent assembly paths** — the primary path strips the wisdom layer (`assembler.js` vs `identity.js:111`). Single biggest gap.
- **Missing guardrails on primary path:** no `SKARN_RULES` (TOS + untrusted-data), no `safetyLine`, no `<untrusted_data>` wrapping of memory/knowledge (assembler.js:10-12).
- `roleNature` is computed by the analyzer but never used for tiering (analyzer.js:26 comment "reserved").

### Memory
- **Derived Memory write-only:** extraction writes (postProcessor.js:53) but the read path only surfaces `interest` type (promptContext.js:46); `formatKnowledge` (which would format projects/events) is dead code.
- **RAG is one-turn-late** (promptContext.js:146-185: embeds computed async, cached to `app_state` for the **next** turn) and **guild-scoped** (`getRecentMessageEmbeddings(guildId, 60)`, db/conversation.js:223-231) — can surface other users' messages as "Related past conversations."
- `getRecentMessages` dead (db/conversation.js:240); `contextAssembler.js` deprecated shim.

### Permissions (Friend Tiers)
- **Five-tier reputation system: unimplemented.** No `friend_tiers` table in schema; spec exists only in docs. `commands/friends.js`/`addfriend.js` are a *friend-code list* (game codes), unrelated to AI permissions. No per-user gating on what Skarn can say beyond opt-in + hourly cap + silence.

### Safety / moderation
- Prompt-level guardrails (TOS, untrusted-data, slur line) absent on primary path — **mitigated** by central OpenAI moderation (client.js:14-39, fail-closed client.js:35-38).
- **Confidant Mode wellbeing guardrails don't exist anywhere** — the only wellbeing mechanism is the self-harm moderation category → crisis response (client.js:18-21, crisisResponse.js).
- No age-appropriateness or server-public-safety review beyond Discord TOS role lines (roles.js:32-34 realm only).

### Architecture / scoping / cost
- **5 LLM calls per substantive interaction** (analyzer + tone + main + condenser + postProcessor) — no batching, no gating of the analyzer to questions.
- Rate buckets are per-user (`rate_limits`), not per-guild; **no guild-level AI budget** except Realm's 1,000/day (CONTEXT.md §4).
- `roles`/`roleTokenBudgets`/`ROLE_NATURE` 3-way duplication with no startup assertion (currently aligned 37/37/37, CONTEXT.md §11.3).
- **Systems don't inform each other:** mood (guild), channel state (channel), emotion (user), response-learning, and relationship are computed independently and injected as separate lines — no cross-signal integration; `socraticLine` promotes to full tier but nothing else reacts.

---

## 7. Upgrade Recommendations

Ordered by impact within each bucket (quick wins first).

### Quick wins

1. **Add `SKARN_RULES` + `SKARN_FOOTER` + `safetyLine` + untrusted-wrapping to the assembler path** (`features/preprocessing/assembler.js:3-27`) — or better, have `pipeline.js`/`sharedPipeline.js` reuse `buildSystemPrompt` for the system prompt while keeping the analyzer for model routing. Restores TOS/untrusted-data/slur guardrails on the primary path. *Small. Low risk. High impact.*
2. **Wire or delete the dead exports:** delete `formatKnowledge`/`runKnowledgeDecay` (knowledgeGraph.js), `getRecentMessages` (db/conversation.js:240), `contextAssembler.js`, `CHEAP_COMMANDS` — or wire `formatKnowledge` into `promptContext.js:46` so extracted projects/events reach the prompt. *Small. No risk.*
3. **De-scope or implement the spec-only features in CONTEXT.md:** Confidant Mode + Friend Tiers are claimed as known features; either implement (large) or mark "designed, not shipped" so future passes don't chase ghosts. *Docs-only. Small.*
4. **Scope RAG per-user-per-guild** (`db/conversation.js:223-231` + `promptContext.js:148-185`) so "Related past conversations" can't pull another user's messages. *Small. Privacy win.*
5. **Startup assertion for the 3-way role registries** (roles/tokenBudgets/ROLE_NATURE key equality) — same pattern as smokes/08. *Small.*
6. **Gate the analyzer to question/substantive messages** (≥ 50 chars or contains `?`, mirroring `isFullTier`, promptContext.js:28) to cut one LLM call per banter message. *Small. Cost win.*

### Strategic changes

7. **Unify prompt assembly on `buildSystemPrompt()`:** make `buildContext()` the single context source and delete the assembler/retriever thin path (or have the analyzer's tiering pass through as an override). Kills the whole class of "line exists in one path only" bugs. *Medium-large. Touches sharedPipeline.js, promptContext.js, preprocessing/*.*
8. **Raise the default persona model:** `AI_MODEL` default `gpt-3.5-turbo` caps all six traits; consider `gpt-4o-mini`+ default with `AI_MODEL_COMPLEX` for long/complex. *Small change, strategic effect (cost).*
9. **Per-guild AI spend budget** for the chat bucket (mirror Realm's 1,000/day pattern, CONTEXT.md §4) so one busy server can't exhaust a shared wallet. *Medium.*
10. **Reduce the per-message LLM stack:** reuse the analyzer's emotion output instead of a separate tone call (or cache tone per user+channel), and make condenser/postProcessor conditional on length already gated. *Medium. Cost/latency.*
11. **Implement Friend Tiers from the existing spec** (docs/specs/2026-07-19/sonnet-5-medium/friend-tiers-permissions.md) to get the designed per-user gating, or formally de-scope. *Large — needs its own plan/implementation pass.*
12. **Persist a persona eval harness:** add LLM-verification smokes (in-character assertions, no-aphorism checks on live prompts) alongside `scripts/smokes/08-persona-invariants.js`. *Medium.*

---

## 8. Open Questions

1. **Was the assembler path intended to be the primary?** The wisdom-layer reauthor (2026-08-01) upgraded `identity.js` and `promptContext.js` but `sharedPipeline.js:74-92` still prefers the thin assembler result. Human decision needed on whether assembler should be retired.
2. **Confidant Mode / Friend Tiers:** implement from existing specs, or de-scope? Both are prominent in CONTEXT.md as shipped features but have no code.
3. **RAG guild-scope:** is cross-user RAG acceptable on public servers, or should it be user-scoped?
4. **Model budget:** is gpt-3.5-turbo the deployed default, or does `.env` override it? Cost ceiling for a model upgrade?
5. **Analyzer necessity:** is the per-message analyzer (gpt-4.1-mini, 300 tokens) earning its cost, given it only feeds model routing + thin tiering?

