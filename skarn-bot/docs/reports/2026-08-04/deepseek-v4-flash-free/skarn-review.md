# Skarn Bot — Quality Review & Improvement Roadmap

- **Date:** 2026-08-04
- **Scope:** Full-codebase review (79 JS files, ~16.5k LOC, 51-table SQLite schema) across persona, architecture, memory, RPG, authenticity, safety, ops, and process
- **Method:** 6 parallel research sub-agents (architecture/AI, persona, memory, Realm, authenticity/safety, dev culture) consolidated with a direct read of README / CONTEXT.md / ARCHITECTURE.md; all findings verified against the current working tree (findings: `research/skarn/findings/F1–F6.md`)
- **Status:** Review + recommendations only — no code changes made
- **Previous audit reference:** `docs/reports/2026-08-02/deepseek-v4-flash/pre-upgrade-audit.md` — most Critical/Important findings there (trade exploit, crash on dropped `user_memory`, missing FK/WAL/migrations/backups, 10 unmoderated call sites, no pm2) have since been resolved; this review reflects the post-fix tree.

---

## 1. Executive summary

Skarn is a Discord.js v14 bot whose center of gravity is a single LLM persona: **"Skarn, Warmaster of the Abyss — a 10,000-year-old retired demon who served Anomaly Alpha."** On the surface it is a 77-slash-command utility bot (games, polls, leveling, server admin, weather, news). Underneath it is a deep persona-engineering project: a 5-layer persona stack, tiered context assembly, 5 distinct memory stores, a 2,800-line persistent RPG, a 10-tool AI system where the model can execute real server commands through a fake Discord message, a probability-based attention gate, and a layered human-ness emulation stack (typing keepalive, message editing, reaction-only mode, deadpan banter).

**Overall verdict: ~8.3/10 — exceptional craft, fragile production system.** The persona and the engineering ambition are the crown jewels; the deliberately test-free posture and doc-vs-code drift are the biggest liabilities. As a maintainable product rather than a craft project, it drops to ~7/10.

---

## 2. Scorecard

| Dimension | Score | Basis |
|---|---|---|
| Persona & identity | 9/10 | Coherent 10k-year arc; wisdom layer with philosopher names banned from the prompt; 4 anti-drift guardrails; socratic engine; per-emotion learning loops; formal `wrath` mood |
| Technical ambition | 9/10 | `run_command` facade, tiered context, omen-via-embeddings, persistent RPG, 51-table schema |
| Authenticity engineering | 8.5/10 | Typing keepalive, message editing, react-only, deadpan escalation — very thoughtful; slightly over-engineered (two stacked typing systems, two "reaction systems") |
| Engineering hygiene | 7/10 | Strong conventions (vertical slices, single AI gate, all-state-in-SQLite, per-bucket rate limits) but zero tests, god-modules, and documented doc/code drift |
| Cost control | 8.5/10 | Sleep mode, 3-strike silence, react-only 10%, per-concern buckets, condenser with zero-call fast path, visible `-(40/50)` budget suffix; persona needs are intrinsically spendy |
| Ops maturity | 8/10 | pm2, WAL-aware `VACUUM INTO` backups, versioned migrations, FK enforcement — impressive for a 5-week-old bot |
| Dev process | 8.5/10 | Docs-driven, grill-gated, agent-executable runbooks with temp-DB smokes; effective solo/agentic, won't scale to a team |
| **Overall** | **8.3/10** | Exceptional passion project; fragile production system |

---

## 3. Findings by five-axis review

Severity: **Critical** (blocks launch / data loss / exploit) · **Important** (should fix) · **Suggestion** (worth considering) · **Nit** (optional).

### 3.1 Correctness

- **Critical — `run_command` surface grows without tests.** The 10th AI tool's enum is built live from the activation registry (`toolDefinitions.js:141-146`), so every new activation phrase silently expands what the model may execute. The recursion guard (dispatch via `handleActivation`, never `execute(interaction)`, `toolRunner.js:226-231`) is the only protection against nested-AI loops; nothing verifies it per-command. [F1]
- **Important — load-bearing schema CHECK constraints with zero tests.** `memory_entries.type` CHECK already caused a production batch-drop crash (`CONTEXT.md §9.7`); the fix (whitelist/coerce in `postProcessor.js:11,47`) is runtime discipline with no regression guard. [F3]
- **Important — deadpan/banter state read from in-memory Map** (`comedyTiming.js`): was broken once (SQLite write, Map never updated, `CONTEXT.md §12.1`) — the class of bug the "dual-write invariant" documents but no test enforces. [F2]
- **Suggestion — callback sampling deviates from spec** (`callbackEngine.js`): 10% random instead of sentiment/reaction gating; "noisier than intended" and unfixed (`CONTEXT.md §12.6`). [F2]
- **Suggestion — `shouldReactOnly()` dead API surface**: only ever called with `'casual'` (`mentionRouter.js:35`); other intents are dead. [F5]
- **Nit — RAG index-misalignment risk** (`promptContext.js`): embedding rows filtered with `filter(Boolean)` while paired arrays are not — same class as the fixed 08-02 audit finding #15; worth re-verifying in current tree.

### 3.2 Readability & Simplicity

- **Important — god-modules persist**: `db/database.js` (870+ lines, 60+ exports) and `features/realm/realmCommand.js` (897 lines, 11 subcommand routers in one file). The vertical-slice convention is violated at the data layer by design ("no feature reaches into database.js directly" except Realm which has its own store — but the main bot still funnels everything through one file). [F4][F6]
- **Important — three parallel role registries drift-prone**: `roles`, `roleTokenBudgets`, `ROLE_NATURE` duplicate the same key set in `persona/roles.js`; `search`/`realm_npc` already absent from `ROLE_NATURE` (`CONTEXT.md §11.3`). Adding a role means editing three objects with no guard. [F2]
- **Suggestion — two modules named `postProcess*`** (`discordNative/postProcess.js` = casual styling vs `preprocessing/postProcessor.js` = memory extraction) and **two reaction systems** (`discordNative/reactionSystem.js` vs `authenticity/reactionController.js`) — a documented confusion trap for extenders. [F5]
- **Nit — duplicate `isSleepTime` semantics** (UTC-offset in `bot.js` vs local-hour variant) — carry-over from audit #14. [F5]

### 3.3 Architecture

- **Good — shared layers are genuinely shared**: one `buildSystemPrompt()`, one `moderatedChatCompletion()` gate, one `runPipeline()` for consult+mention, activation registry as the single text-command source. [F1]
- **Important — 5 intentionally separate memory stores** with different scopes is correct but the conversation-graph read path is raw SQL duplicated in `promptContext.js` while `database.js` exports equivalent functions that are dead (`CONTEXT.md §6.1`). Consolidate the read path. [F3]
- **Suggestion — Realm AI driver doc/code drift**: CONTEXT.md + spec claim it hardcodes `gpt-5.4-mini` and ignores the router; the code calls `selectModel()` (`aiDriver.js:3,26`). One of them is wrong — resolve and update. [F4]
- **Suggestion — ARCHITECTURE.md is stale**: still labels the Advice tier "not implemented / dead surface area" while `promptContext.js:30-33` implements it. [F1]

### 3.4 Security

- **Good — centralized, fail-closed moderation**: single gate in `moderatedChatCompletion()` (`ai/client.js:41`) does silence check, rate-limit reservation, input moderation, generation, output moderation; fails closed on moderation errors; violence deliberately allow-listed for in-character battle narration. [F1][F5]
- **Good — parameterized SQL everywhere**, `.env` gitignored/untracked, no hardcoded tokens. [F6]
- **Good — prompt-injection mitigation**: user-derived context wrapped in `<untrusted_data>` tags with data-only guardrail (`identity.js:108-157`). [F1]
- **Important — 3-strike silence can be gamed via bypass paths**: hostile pre-checks run in consult/mention handlers, but the hard gate is central; Realm has its own driver path with its own bucket — verify a silenced user cannot trigger Realm AI (audit #3 previously flagged 10 bypass sites; the 08-02 consolidation addressed most — re-audit the realm/omen/chronicle/weather paths in current tree). [F1][F4]
- **Nit — `searchFriends` LIKE wildcards unescaped** and FTS5 sanitizer misses `-`/operator words (carried from audit #24). [F6]

### 3.5 Performance

- **Important — multiple LLM passes per mention**: preprocessing analyzer (`gpt-4.1-mini`) + main call + topic extraction + embeddings + condenser + memory post-processor — up to ~6 OpenAI calls on a rich mention. Four bypass the shared gate (embeddings/topic/summarizer/tone) and share the 50/10-min bucket; ~16 such interactions can exhaust it. Biggest cost risk; audit #4 flagged it, consolidation partial. [F1][F3][F6]
- **Important — `buildContext()` runs ~25 sync SQLite queries per AI call** (`promptContext.js:36-223`) — per-reply DB amplification on the event loop. [F1]
- **Suggestion — per-message write amplification**: ~10 sync better-sqlite3 writes per message (audit #17) — `Promise.allSettled` does not make sync SQL async. [F1]
- **Suggestion — omen job embedding N+1**: re-embeds every signal per omen (audit #5) — verify `signal_embeddings` caching fully resolves it in current tree. [F3]
- **Nit — canvas Tetris render per button press** blocking the event loop (audit #18). [F6]

---

## 4. Improvement recommendations by area

Each recommendation is scoped and ordered; the highest-leverage items are starred.

### 4.1 Persona & identity
- **Introduce a persona test harness (starred).** The persona is the product. Extract the deterministic parts — socratic trigger matching (`socraticEngine.js`), emotion/mood line selection (`moodManager.js`, `emotionalIntelligence.js`), familiarity tiers (`relationshipTracker.js`), etiquette directives (`etiquetteEngine.js`) — into pure functions and add a smoke suite asserting the exact line/directive returned for representative inputs (e.g. "help me think" → socratic line + full-tier promotion). These are pure logic; they don't need OpenAI mocks. This directly protects the crown jewel.
- **Eliminate the three-registry drift**: derive `roleTokenBudgets` and `ROLE_NATURE` from a single `ROLES` definition (or add a startup assertion that all three key sets match, failing loudly). Close the `search`/`realm_npc` gap.
- **Resolve the Realm-driver model question**: pick one truth — either restore the documented hardcoded model/isolated behavior or update CONTEXT.md + spec to the actual `selectModel()` behavior.
- **Reconsider the advice-tier cost**: promoting every socratic match to full tier burns ~3k tokens on the shortest messages. Consider a *medium* tier (directives + 8 messages, no RAG) for advice matches — cheaper, still context-rich.
- **Flesh out the growth arc**: `growthTracker.js` tracks weekly trends; a long-term "year of service" arc (milestone stories, evolving voice) would deepen the 10k-year premise.

### 4.2 Architecture & AI pipeline
- **Split the god-modules (starred).** `db/database.js` → group by domain (memory, conversation, relationship, ops) with thin re-export facade; `realmCommand.js` → per-subcommand handler files matching the vertical-slice convention. This is the single biggest maintainability win.
- **Consolidate the conversation read path**: route `promptContext.js` through the `database.js` exports instead of duplicated raw SQL; delete the dead exports.
- **Add a `run_command` capability registry gate**: a startup scan that warns (like the `/help` theme-map warning) when a command's `activation.type:'command'` handler is not permission-safe for tool dispatch; codify the recursion-guard as a test.
- **Make the two post-process/reaction modules unambiguous**: rename `preprocessing/postProcessor.js` → `preprocessing/memoryExtractor.js` (its actual job) and document the reaction-system split in CONTEXT.md.

### 4.3 Memory & persistence
- **Add a memory-store test suite (starred).** Cover: etch permanence vs extracted decay (×0.95/30d, prune <0.2), type-coercion on off-schema LLM drift, `/forget` cascade (threads/messages/summaries/FTS/embeddings), and the Dormant-only-from-decay invariant (`stateDecay.js`). These are the load-bearing invariants that already crashed once.
- **Verify the RAG pairing fix** from audit #15 in current tree and add a unit smoke for the embedding-cache alignment.
- **Index the scheduled-scan tables**: `reminders (remind_at, delivered)` and `giveaways (ends_at, ended)` (carried from audit #20).
- **Consider a retention policy for `server_signals`/`signal_embeddings`** consistent with the 30-day prune, so embedding cache can't grow unbounded.

### 4.4 Realm of Skarn
- **Re-audit the Realm AI paths against the central gate** (starred): confirm `aiDriver.js` calls `moderatedChatCompletion` with `bucket:'realm'` and that a silenced user cannot enter Realm AI; the 08-02 consolidation claimed full coverage — verify.
- **Refactor `realmCommand.js` (897 lines)** into per-subcommand files (create/explore/combat/inventory/trade/quest) following the house vertical-slice pattern.
- **Add the double-submit/anti-exploit smokes from README into a runnable script** (trade dup-rejection, atomic 2-item transfer, per-round HP persistence) so the anti-exploit math stays verified.
- **Consider persistent combat/trade sessions** (SQLite with TTL) instead of in-memory Maps — the "intentionally volatile" posture is documented, but a restart mid-trade is user-hostile; at minimum log and notify on expiry.

### 4.5 Authenticity layer
- **Reconcile the two typing systems (starred):** `typingSim` keepalive + `simulateTyping` + `typingController.estimateDelay` stack redundant delays. Pick one delay model; keep the keepalive (it's the load-bearing part) and make the pre-send delay a single function.
- **Wire message-editing to the mention path too**, or document why edits are `/consult`-only — the asymmetry is currently invisible to most users.
- **Grow the interjection vocabulary**: hard-coded fallbacks ("bruh moment 😔") are the lowest-quality output the bot produces; replace with a small curated pool or template set.
- **Make callback sampling match the spec** (sentiment/reaction-gated) or delete it — a noisy 10% random callback is worse than none.

### 4.6 Safety & moderation
- **Centralize the remaining bypass audit (starred):** grep for direct `openai.chat.completions.create` / `client.chat` call sites not going through `moderatedChatCompletion`; route embeddings/topic-extraction/summarizer/tone-analysis through a no-moderation variant of the gate that still enforces rate limits and silence.
- **Unify sleep semantics**: one `isSleepTime()` implementation (UTC-offset) used by slash, mention, activation, and interjection paths; add a `skarn status`-visible state.
- **Re-verify FTS5 sanitizer** against `-`/`|`/`>` operators and escape `searchFriends` LIKE wildcards (carried from audit #24).

### 4.7 Ops & data layer
- **CI smoke pipeline (starred):** the temp-DB `node -e` smokes in README are excellent — promote them to a single `npm run smoke` script that runs all of them against `SKARN_DB_PATH=$(mktemp -d)` and exits nonzero on failure. This is the cheapest way to get "tests" without reintroducing the removed suite.
- **Add monitoring**: log per-interaction token spend and gate-rejection counts (rate-limit, silence, moderation) to a daily table; the `-(40/50)` suffix is a user-facing proxy for a missing internal metric.
- **Schedule backups**: wire `scripts/backup-db.js` into a cron/pm2 timer (currently manual `npm run backup`).
- **Verify WAL + FK on the live DB** (the 08-02 migration set them; confirm the production `data/skarn.db` actually reports `journal_mode=wal` and `foreign_keys=1`).

### 4.8 Development process
- **Adopt the review-before-commit gate (starred):** the codebase is built by agents with zero review — introduce a lightweight two-stage check (an independent review sub-agent per change, using the five-axis checklist) before merge. The skill this report was written with formalizes the severity labeling; adopt it in the runbooks.
- **Decompose `CONTEXT.md` drift**: ARCHITECTURE.md is stale in at least 3 places (Advice tier, rate-limit number, hostile-detector gates); make CONTEXT.md the sole living spec and mark ARCHITECTURE.md as historical, or auto-generate the section from code.
- **Add a smoke to the runbooks' checklist**: every plan should end with "run `npm run smoke`" (once it exists) plus the specific `node -e` checks.
- **Split oversized changes**: the 129-commit day and 80-commit days show the discipline exists; keep the "one plan = one theme" rule and use the grill gate for contested architecture changes (it already works).

---

## 5. Priority roadmap

**P0 — correctness & safety (do first):**
1. Re-audit remaining moderation bypass paths (4.6) — the largest safety gap.
2. Add the memory-store + persona smoke suites (4.3, 4.1) — protect the invariants that already crashed.
3. Promote README smokes to `npm run smoke` + CI-less gate (4.7).

**P1 — cost & maintainability:**
4. Split `db/database.js` and `realmCommand.js` god-modules (4.2, 4.4).
5. Consolidate conversation read path; reconcile typing systems (4.2, 4.5).
6. Resolve all doc/code drift (Realm model, Advice tier, ARCHITECTURE.md) (4.1, 4.3).

**P2 — depth & polish:**
7. Advice-tier medium context; interjection vocabulary; callback gating (4.1, 4.5).
8. Monitoring table + scheduled backups + live-DB WAL verification (4.7).
9. Review-before-commit gate in the dev process (4.8).

---

## 6. Open questions

1. Is `run_command`'s growing execution surface acceptable? The model can run any activation-registered command with real permission checks; there is no test or registry gate ensuring newly activated commands are tool-safe.
2. Should combat/trade sessions become persistent? "Intentionally volatile" is documented, but a restart mid-trade is user-hostile; the cost of SQLite persistence is small relative to the rest of the schema.
3. Where is the line between "deliberately human" and "deliberately worse"? Reaction-only mode, message editing, and filler abbreviations trade correctness for believability — worth an explicit policy so it doesn't creep.

---

## Sources

1. `research/skarn/REPORT.md` + `research/skarn/findings/F1–F6.md` (6 parallel sub-agent deep-dives, 2026-08-04, file:line verified against current tree)
2. `skarn-bot/CONTEXT.md` — domain glossary & decisions record (authoritative)
3. `skarn-bot/docs/ARCHITECTURE.md` — architecture overview (partially stale; noted above)
4. `skarn-bot/docs/reports/2026-08-02/deepseek-v4-flash/pre-upgrade-audit.md` — prior audit, most items since resolved
5. `skarn-bot/README.md` — command reference + verification smokes
