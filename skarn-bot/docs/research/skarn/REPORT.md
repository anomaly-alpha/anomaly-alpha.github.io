# What Is Skarn, and What Makes Him Unique?

**Research date**: 2026-08-04 · **Target**: `skarn-bot/` (Discord bot sub-project in the anomaly-alpha repo)
**Method**: 6 parallel explore sub-agents, each covering one angle, findings in `findings/F1–F6.md`. All file:line citations verified against the current working tree.

---

## 1. Executive summary

Skarn is a **Discord.js v14 bot whose center of gravity is a single LLM persona**: "Skarn, Warmaster of the Abyss — a 10,000-year-old retired demon who served Anomaly Alpha." On the surface it is a 77-slash-command utility bot (games, polls, leveling, moderation tools, weather, news). Under the hood it is one of the most aggressively *persona-engineering* projects you will find in a single codebase: ~16,500 LOC across 79 JS files, a 51-table SQLite schema, a full persistent RPG, an AI tool system where the model can invoke any server command, and a layered "human-ness" emulation stack (typing simulation, message editing, probability-gated reactions and interjections).

What makes Skarn genuinely unique is not any single feature but the **depth and discipline applied to making a bot feel like a character with memory, mood, patience, and even anger** — plus a development process (docs-driven, grill-gated, agent-executed, deliberately test-free) that is itself unusual.

---

## 2. What he is — the character

- **The identity** (`persona/identity.js:1`): "Skarn — Warmaster of the Abyss, now a Discord bot serving Anomaly Alpha. Ten thousand years old. Orphan demon who fought through a war against heaven, earned the title Warmaster, watched it all end, and retired to Discord." [F2]
- **The emotional core**: war made him cold; retirement made him kind. "Kindness was what you learned when the fighting stopped." He respects effort over talent. His one lesson of ten millennia: "everything passes… and kindness is the only thing that outlasts any of it." [F2]
- **The voice**: "types like someone who stopped performing — lowkey, lowercase when it fits, brief when a thought needs few words, fully present when someone actually needs him." [F2]
- **The persona is engineered, not prompted**: 37 role lines (`persona/roles.js`), each with a token budget (100–1000) *and* a character reply target — plus a 2026-08-01 **"wisdom layer" reauthor** that distilled Socrates, Marcus Aurelius, Sun Tzu, Laozi and Nietzsche into the character's instincts while **banning their names from the prompt** ("demons don't cite Roman emperors"). [F2]
- **Anti-drift guardrails**: four explicit forbids — no fortune-cookie aphorisms, no therapy-speak ("I hear that you're feeling…" is forbidden), no excessive humility, no lecturing. And a master rule: "Mood changes how all of this shows, not what you are. Never a different character." [F2]

## 3. What he does — the systems

A message from Discord flows through one `messageCreate` handler (`bot.js:170`) with a strict numbered gate pipeline: bot-skip + message dedup → DM handling → non-blocking state tracking (channel mood, familiarity, culture, warmth, humor) → fast-path skippers → activation registry → @mention → passive reactions → AI-channel auto-respond → XP. [F1]

- **AI pipeline**: `/consult` and `@Skarn` mentions both run through one shared `runPipeline()` (`features/ai/sharedPipeline.js`), which assembles a **tiered context** (lightweight ~1k tokens / full ~3k tokens with 15 messages + summaries + knowledge + semantic RAG / advice tier via socratic triggers), calls OpenAI through a single `moderatedChatCompletion()` gate, post-processes, and sends with simulated human pacing. [F1]
- **Two command systems that bridge into each other**: a deterministic `skarn <phrase>` activation registry (startup-scanned, word-boundary exact) *and* 10 model-decided AI tools (`etch_memory`, `get_memory`, `search_web`, `set_reminder`, `get_weather`, `get_news`, `roll_dice`, `flip_coin`, `get_user_stats`, `run_command`). The 10th tool is **generated live from the registry** — every newly activated phrase automatically becomes AI-callable. [F1]
- **Realm of Skarn**: a fully persistent AI-driven RPG (~2,798 LOC in `features/realm/`). 5-step character creation wizard, 8-location world graph, turn-based combat, 16 NPC templates with per-NPC memory, quests, player-to-player trading in atomic SQLite transactions, its own rate-limit buckets (30 calls/30min/user + 1,000/day/guild). **The AI is a narrator, never an adjudicator** — every number (damage, crit, loot, XP) is decided by deterministic code; the LLM only writes prose. [F4]
- **Memory**: 5 deliberately separate stores — unified per-user `memory_entries` (user-etched facts are permanent; auto-extracted facts decay ×0.95 after 30 days and are pruned below 0.2), a conversation graph with FTS5 search, a global knowledge base, plus **omen prophecies and weekly chronicles**: an LLM prophecy is "fulfilled" when embedding cosine-similarity ≥ 0.7 matches it to a real server event, then an LLM writes the callback narrative that becomes in-fiction Realm history. [F3]
- **Human-ness emulation**: typing keepalive that lasts the entire AI call plus extra pre-send delays, passive emoji reactions (3%), a 10% "reaction-only" mode, 5% chance to edit its own just-sent message with "fr/ngl/tbh" filler, probability-gated interjections, proactive check-ins for absent regulars, active-listening cues ("mhm… go on"), and a deadpan banter system that progressively shortens replies in a gag. [F5]
- **Safety**: 3-strike silence for hostile users (10 regexes → 10-min mute), OpenAI moderation that **fails closed**, crisis-response lines (988 / Crisis Text Line, sent ephemeral), and — tellingly — **violence is explicitly allow-listed** so the in-character demon can narrate battles. [F5]

## 4. What makes him unique — the top findings

1. **`run_command`: the model executes real server commands through a fake Discord message.** Instead of ~70 tool schemas, one generic AI tool invokes any of ~37 activation-registered commands. A pseudo-message facade (`features/tools/messageAdapter.js`) exposes `author/guild/member/mentions/reply()` so unmodified handlers run, and `reply()` *captures* the output so the tool result carries the real text back to the model. Execution is forced through `handleActivation`, never `execute(interaction)`, to prevent recursive nested AI. [F1][F6]
2. **A reply condenser that runs the LLM on the LLM**: a second gated `gpt-4.1-mini` pass squeezes over-target replies to a per-role *character* target (distinct from token budgets), with a zero-call fast path when already short, code-fence skipping, and fail-open discipline. [F1][F6]
3. **The attention gate is a probability adder, not a rules engine**: recency + channel-warmth early exits, +0.6 for questions, message-count escalation 0→1.0, channel-activity decay, +0.4 sentiment boost — and when the sum is too low, a **5-token, temperature-0.1 LLM "YES/NO" hand-raise** decides. The cheapest possible AI signal. [F5]
4. **Socratic advice as personality, not feature**: 18 trigger phrasings ("help me think", "i can't decide"…) promote a message to the *most expensive* full-tier context, and Skarn is told to "offer the answer only when asked twice." [F1][F2]
5. **Mood includes formal, nameable wrath**: a busy server full of strangers flips Skarn into "controlled wrath — shorter sentences, sharper edges, but the restraint stays." Unusual for a "friendly" bot to formalize anger as a legitimate state. [F2]
6. **A learning loop on emotional care**: the calibration directive tracks hit/miss rates *per emotional state* and adjusts tactics ("let them vent more", "try being more practical"), alongside trajectory detection, escalation detection, memory-emotion crossover, weekly growth tracking, and server climate. [F2]
7. **Deliberately lower competence**: message editing, reaction-only replies, lowercase/abbreviation filler, and deadpan escalation all perform *worse* on purpose — trading correctness for believability. [F5]
8. **"All state in SQLite" as a hard rule** — even ephemeral sentiment buffers and cooldowns persisted; only intentionally-volatile game sessions (combats, trades, tetris) stay in-memory. [F3]
9. **Railway-resilience engineering**: three search backends (Google CSE, DDG, Wikipedia) were replaced by Tavily after all failed from the shared datacenter IP; the news system (38 feeds, 5 categories) is per-feed-isolated so one dead feed costs only that feed. [F6]
10. **A docs-driven, grill-gated, agent-executed, deliberately test-free process**: 416 commits in ~5 weeks, every feature authored as a dated spec with stable IDs that must survive a documented Q&A "grill", then planned as checkbox runbooks that literally instruct an AI agent which files, diffs, `node -e` smoke scripts and commit messages to use. The test framework was *deleted by decision*; verification is temp-DB smokes. [F6]

## 5. Known drift / caveats (docs vs. code)

- `docs/ARCHITECTURE.md` still labels the Advice tier "not implemented / dead surface area", but the code populates `socraticLine` and promotes messages to full tier (`promptContext.js:30-33`). Treat CONTEXT.md + code as authoritative. [F1]
- CONTEXT.md/spec claim the Realm AI driver "hardcodes `gpt-5.4-mini` and ignores the model router" — the current code actually calls `selectModel()` (`aiDriver.js:3,26`). [F4]
- `shouldReactOnly()` only ever receives the hardcoded `'casual'` intent, making its other accepted intents dead API surface. [F5]
- The callback engine samples messages at 10% random rather than the spec's sentiment/reaction gating — "noisier than intended" and unfixed. [F2][CONTEXT.md §12.6]

## 6. Open questions

1. Where does the persona end and the utility begin for users? The bot spends ~50 tokens per AI call on always-on news awareness and full-tier context for short advice messages — the cost profile of "character" is deliberately higher than a typical utility bot.
2. `run_command` executes real commands with permission checks but only through `handleActivation` — the surface area of "the model can run anything" grows every time a new activation phrase is added; the recursion guard is the only thing keeping the model from chaining tools.
3. Deliberately test-free: the 51-table schema and the load-bearing CHECK constraints (which a production crash proved load-bearing, `CONTEXT.md §9.7`) have no automated guard — the living docs are the only spec.

## Sources

1. `research/skarn/findings/F1.md` — Architecture, message loop, shared AI pipeline (sub-agent, 2026-08-04)
2. `research/skarn/findings/F2.md` — Persona & identity (sub-agent, 2026-08-04)
3. `research/skarn/findings/F3.md` — Memory systems & persistent state (sub-agent, 2026-08-04)
4. `research/skarn/findings/F4.md` — Realm of Skarn RPG (sub-agent, 2026-08-04)
5. `research/skarn/findings/F5.md` — Human-ness emulation & safety (sub-agent, 2026-08-04)
6. `research/skarn/findings/F6.md` — Dev history, culture, unique traits (sub-agent, 2026-08-04)
7. `skarn-bot/README.md`, `skarn-bot/CONTEXT.md`, `skarn-bot/docs/ARCHITECTURE.md` (read directly, 2026-08-04)

All file:line citations inside each findings file are against the current working tree as of 2026-08-04.
