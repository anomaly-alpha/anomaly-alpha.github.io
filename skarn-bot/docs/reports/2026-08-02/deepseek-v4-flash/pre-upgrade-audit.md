# Skarn Bot — Pre-Upgrade Audit

> **Status as of 2026-08-08:** ~15 of the ~27 findings below are now FIXED (see CONTEXT.md `> **Resolved ...**` notes): Realm trade dedup + transactional transfer (`economy.js`), `applyBaselineFamiliarity` re-pointed at `memory_entries`, trade flow wired into realm handlers, AI-gate consolidation (`audit-ai-gate.js` guards it), omen embedding cache, conversation-read consolidation, db decomposition (46-line facade), versioned migrations + WAL + FK, backup script + pm2, realm per-subcommand split (`features/realm/handlers/`), typing consolidation, smoke pipeline (10 suites), doc-drift guard (`audit-docs.js`). Still open: 5-LLM stack per mention (analyzer now cost-gated, not removed), sleep mode still gates only slash commands (mentions ungated), RAG index pairing (fixed 2026-08-08), `err.message` leak, Tetris canvas-per-press, search handler duplication, reminders/giveaways missing indexes, `vault.js` was fixed 2026-08-08. Read this report as the audit it was — CONTEXT.md §9/§12/§13 is the current-state record.

- **Date:** 2026-08-02
- **Scope:** Full-codebase audit (79 JS files, ~16.5k LOC) across five axes + data layer + ops
- **Method:** 4 parallel subagent deep-dives (architecture/docs, core code, data layer, ops/integrations), consolidated here
- **Status:** Audit only — no code changes. Upgrade decisions follow in a separate plan.

---

## 1. What skarn-bot is

Skarn is a Discord.js v14 bot playing **"Skarn, the Warmaster of the Abyss"** — an LLM-driven conversational AI with 77 slash commands across 8 `/help` themes, games, leveling, server admin/moderation, and a persistent RPG ("Realm of Skarn"). Interaction modes: slash commands, `@mention` replies, text activation phrases ("skarn weather"), and passive behaviors (reactions, interjections, sleep mode).

**Stack:** Node.js ≥18, CommonJS, no build step. discord.js ^14.16.3, better-sqlite3 ^12.11.1 (single `data/skarn.db`), openai ^6.48.0, sentiment, duck-duck-scrape, canvas, discord-rpc, dotenv.

**Architecture:** `bot.js` is a 10-step `messageCreate` pipeline; `features/` = 33 vertical slices (each owns handler + data); `commands/` = thin wrappers; `ai/client.js` = OpenAI singleton with a central `moderatedChatCompletion()` gate; `persona/` = identity + 37 roles; `db/database.js` = data layer.

**What's healthy:** vertical-slice layout, a genuinely good atomic rate-limit design (`lib/rateLimit.js`), centralized moderation gate, parameterized SQL everywhere, `.env` properly gitignored, idempotent command deployment.

---

## 2. Findings by severity

### Critical

- **Item-duplication exploit in Realm trade** (`features/realm/economy.js:159-170`). `addToTrade` (60-103) never dedups an item already in the offer; `executeTrade` re-reads inventory per iteration while ignoring `removeItem()`'s return value. Adding the same item twice yields 2 copies on the recipient's side.
- **Live crash bug in data layer** (`features/relationshipTracker.js:75`). `applyBaselineFamiliarity()` queries the dropped `user_memory` table — crashes on every call.

### Important

**Correctness / feature health**

1. **Realm trade is functionally dead** (`economy.js:30-56`, `realmCommand.js:657-679`). `startTrade()` inserts into an in-memory Map; `addToTrade`/`confirmTrade`/`executeTrade`/`sellToMerchant`/`getTradeState`/`cancelTrade` have **zero callers** — partner never prompted, items never transfer. ~80% of `economy.js` is unreachable.
2. **Mojibake in user-facing strings** — corrupted double-encoded UTF-8 across embeds/buttons/status: `bot.js:79,100` (`âœ“`, `ðŸ’¤`), `commands/tetris.js`, `commands/history.js`, `commands/search.js`, `features/search/search.handler.js`. Users literally see `â€”` instead of `—`. Likely from a prior code-gen pass.
3. **10 modules bypass `moderatedChatCompletion`** — direct `openai.chat.completions.create` calls skip moderation, `isSilenced`, and central rate limiting: `features/realm/aiDriver.js:33`, `features/serverMemory/omen/omenJob.js:20,37`, `features/serverMemory/chronicle/chronicleJob.js:34`, `features/intelligence/toneAnalyzer.js`, `features/conversation/topicExtractor.js:14`, `features/conversation/summarizer.js`, `features/wisdom/storyEngine.js:71`, `features/discordNative/attentionGate.js:70`, `lib/weatherScheduler.js:57`, `features/intelligence/embeddings.js`. A silenced hostile user can still trigger unmoderated AI via `/realm` and via per-message tone/topic extraction.
4. **Up to 6 OpenAI calls per mention** — tone analysis, preprocessing analyzer (gpt-4.1-mini), 2 embedding calls, topic extraction, plus the main call. Four bypass moderation and burn the shared 50/10min rate-limit bucket → ~16 interactions exhaust it. Biggest cost risk.
5. **N+1 embeddings in omen job** (`omenJob.js:83-99`) — re-embeds every signal for every omen (O×S API calls, no caching): 10 omens × 20 signals = 200 embedding calls per daily run.
6. **`buildContext()` runs ~25 sync SQLite queries per AI call** (`promptContext.js:36-223`) + a 60-row embedding fetch — per-reply DB amplification.
7. **"All state in SQLite" claim is false** — in-memory Maps remain: `combat.js:9 activeCombats`, `economy.js:5 activeTrades`, `games/tetris.js:233 activeGames`, `comedyTiming.js:3-4 banterChains/setups`. All game/trade/combat state lost on restart. CONTEXT.md's "zero in-memory Maps" claim is stale.
8. **Search handler duplicated** — `commands/search.js:23-108` re-implements `features/search/search.handler.js:17-111` with a *different* cooldown mechanism (`getFlag('search_cd:…')` vs `checkCooldown('search:…')`).
9. **`db/database.js` is a 1029-line god-file with dead exports** — `getRecentMessages`, `getOlderSummaries`, `getThreadMessages`, `searchConversations` unused; same query duplicated as raw SQL in `promptContext.js:76-100`.
10. **No versioned migrations** — schema re-executed on startup with `IF NOT EXISTS`; column adds via try/catch ALTERs; `PRAGMA user_version=0`.
11. **Foreign keys declared but unenforced** — `PRAGMA foreign_keys` never set (verified `foreign_keys=0`). No triggers; FTS synced manually; `pruneOldMessages` deletes messages without purging FTS rows → orphans.
12. **Transaction-light hot paths** — `saveCharacter` (`realmStore.js:11-27`) is read-modify-write with no transaction/CAS; two concurrent combat events for one character can lose deltas. Only 3 transactions in the whole codebase.
13. **Zero backup strategy** — no `.backup()`, no export scripts; `data/` is gitignored → single local copy of the only database.

### Suggestion

14. **Sleep mode doesn't gate mentions** — `isAsleep` checked only in the slash handler (`bot.js:113`); @mention path (`bot.js:291`) and text-activation path still trigger AI during sleep. Sleep logic also duplicated with different semantics (`bot.js:63-69` UTC+offset vs `296-307` local `getHours()`).
15. **RAG index misalignment** (`promptContext.js:157-166`) — `parsedEmbeds` filtered (`filter(Boolean)`) but indexed against unfiltered `msgTexts[i]`/`msgIds[i]` → wrong text can pair with an embedding.
16. **Internal errors leaked to users** (`bot.js:191`, `bot.js:272-274`) — replies with raw `err.message`.
17. **Per-message write amplification** (`bot.js:206-222`) — ~10 sync better-sqlite3 writes per message on the event loop; `Promise.allSettled` doesn't make sync SQL async.
18. **Canvas render per Tetris press** (`commands/tetris.js:135-156`) — 320×600 PNG rendered 2-3× per button press, blocking the event loop.
19. **`realmCommand.js` is a 797-line god-file** mixing 10 subcommand routers, combat, inventory, quest UI. `history.js` duplicates its own logic (slash `execute` 84-188 vs activation `getHistoryResponse` 7-71).
20. **Missing indexes** — `reminders` (remind_at/delivered) and `giveaways` (ends_at/ended) have none despite scheduled scans.
21. **Silent-failure style** — `bot.js:206-222`, `bot.js:309,364` swallow all errors with empty catches; failures undiagnosable.
22. **No crash recovery for the main bot** — `unhandledRejection`/`uncaughtException` handlers log only, no exit/restart. pm2 documented only for rich-presence.js, not bot.js. No CI, no tests (deliberate — `tests/` removed, "verified manually" per CONTEXT.md §11.2).

### Nit / FYI

23. **Dead code:** `bot.js:32-42` unused `loadJSON`/`saveJSON`; empty placeholder logging block at `bot.js:354-360`.
24. **`searchFriends` LIKE wildcards unescaped** (`db/database.js:760`); FTS5 sanitizer misses `-`/operator words (`database.js:319,411`).
25. **Docs drift:** CONTEXT.md says `OPENAI_API_KEY` "not present in .env.example" — it IS present. README project tree lists removed JSON files (`data/config.json`, `levels.json`, `friends.json` — now SQLite). Confidant Mode spec exists but has no table/module. `roleTokenBudgets.consult`=600 vs spec 900; `realm_npc` possibly missing from `ROLE_NATURE`.
26. **Secrets healthy** — `.env` untracked + gitignored; no hardcoded tokens; `.env.example` omits commented `AI_MODEL`/`AI_MODEL_COMPLEX` (minor).
27. **Live DB uses `journal_mode=delete`** — no WAL (better concurrency for a multi-process future).

---

## 3. Top priorities for upgrades

1. **AI cost/moderation consolidation** (#3, #4, #5) — route all 10 direct OpenAI call sites through the central gate; cache embeddings (omen job); the biggest cost + safety win.
2. **Realm trade: fix or remove** (Critical #1, #2) — dead flow plus a live duplication exploit. If it stays, make it stateful (SQLite), deduped, and transactional; if not, delete ~80% of `economy.js`.
3. **Persistence honesty** (#7) — move combat/trade/tetris state to SQLite or document in-memory ephemerality; update CONTEXT.md.
4. **Data layer hardening** (#10, #11, #12, #13) — versioned migrations (`user_version`), `PRAGMA foreign_keys=ON` + WAL, transactions on hot state paths, add a backup script.
5. **Mojibake cleanup** (#2) — fast, high-visibility fix across ~6 files.
6. **Ops baseline** (#22) — process supervisor for bot.js, minimal smoke test, crash bug #2 in relationshipTracker.

---

## 4. Next steps

- Pick a workstream (suggest: **critical fixes first** — duplication exploit + crash bug — then cost/moderation consolidation).
- Write an implementation plan under `skarn-bot/docs/plans/2026-08-02/` for the chosen scope.
