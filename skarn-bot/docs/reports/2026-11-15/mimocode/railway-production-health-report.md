# Skarn Bot — Railway Production Health Report

**Date:** 2026-11-15 23:18 UTC
**Scope:** Live Railway production service + log/metric inspection + code verification of observed behavior
**Method:** Railway CLI (v5.74.0) against the linked project; log windows of 13.6 h and 24 h; findings cross-checked against source

---

## 1. Service identity

| Item | Value |
|---|---|
| Workspace | anomaly-alpha's Projects |
| Project | cozy-miracle (`9cb7ab24-0111-4293-9b30-7fb3551ea9df`) |
| Environment | production (`013fe864-9db6-419f-800b-72afde9e3cc2`) |
| Service | anomaly-alpha.github.io (`de877d7d-06ab-478d-8209-b66f08ff5b77`) |
| Status | ● Online |
| Region | US East |
| Current deployment | `7234da0d-7c90-46ee-a5b4-39e844138b01` — **SUCCESS**, 2026-11-14 20:05:57 UTC |
| Uptime at check | ~27 h, continuous |
| Volume | `anomaly-alpha.github.io-volume` → `/app/data`, 377 MB / 4.88 GB (8%) |
| Public domain | None configured (no HTTP ingress) |
| Build system | Railpack — mise Node, apt `libatomic1`, `npm install`, image push |

### Deploy freshness

Deployed commit matches `HEAD` exactly, no drift:

- `HEAD` = `4c6c436` *fix(a11y): name cards from their visible text and clear the remaining audit defects* (2026-11-14 20:05:41 UTC)
- Deployment created 16 seconds later

No unpushed commits on `main`.

### Health assessment: **stable**

- Zero restarts in the 13.6 h window (the `Logged in as …` boot banner appears only at deployment start)
- 3 error-level lines total in 13.6 h, all explained below
- No crash, no reconnect storm, no rate-limit exhaustion

---

## 2. Runtime footprint (24 h)

| Metric | Current | Avg | Max | Limit |
|---|---|---|---|---|
| CPU | < 0.01 vCPU (0%) | < 0.01 vCPU | < 0.01 vCPU | 8.0 vCPU |
| Memory | 150 MB (2%) | 203 MB | 258 MB | 8.00 GB |
| Egress | 0.01 MB | 0.05 MB | 0.22 MB | — |
| Ingress | 0.00 MB | 0.47 MB | 1.8 MB | — |
| Volume disk | 377 MB (8%) | 377 MB | 377 MB | 4.88 GB |

The service is functionally idle from a resource standpoint. Cost is driven entirely by the always-on replica, not by consumption — there is roughly two orders of magnitude of headroom on every axis.

### Boot sequence (verified from deployment logs)

```
Logged in as Skarn#0821 (68 commands)
Sleep mode: 1:00 - 7:00 (UTC-5)
Search backend: Tavily ✓ ready
[Knowledge] Using cached data (last seed: 19h ago)
[SkarnLore] 20 canonical stories already seeded — skipping
[SkarnLore] Pool prune: 600 → 600 stories (deleted 0)
[SlurFilter] Gate 1 active — safety instruction in system prompt
[activation] Registered 34 activation phrases
[News] Initial fetch: 200 articles
[Lore] Batch: retirement — 600 → 605 stories (+5 new, 0 skipped, cap 600)
[SkarnLore] Pool prune: 605 → 600 stories (deleted 5)
```

### Recurring schedules observed

| Job | Cadence | Evidence |
|---|---|---|
| Presence rotation | every 10 s | `presence-assets/presence-mood-contract.json` → `phraseRotationMs: 10000` |
| Maintenance loop (decay, cooldowns, rate limits, flags, sentiment, banter, callbacks, reaction counters) | every 10 min | `features/scheduler/index.js:79` |
| Message archive + channel context prune | every 5 min | `bot.js:236`, `bot.js:244` |
| Reaction counter prune | hourly | `features/scheduler/index.js:92` |
| Daily maintenance (profiles → summarize → prune messages >90 d) | 24 h | `features/scheduler/index.js:81-88`; fired 2026-11-15 20:06 UTC |
| Lore batch (5 stories + prune) | boot **and** daily | `bot.js:227`, `features/scheduler/index.js` |
| Sleep transition check | every 60 s | `bot.js:254-262` |

### Sleep mode — verified operating correctly

Configured `SLEEP_START=1`, `SLEEP_END=7`, `SLEEP_TIMEZONE=-5` → 01:00–07:00 local = 06:00–12:00 UTC.

Observed transitions, accurate to within ~25 s of the boundary:

```
2026-11-15T06:00:24Z  Sleep mode: going offline
2026-11-15T12:00:25Z  Sleep mode: waking up
```

---

## 3. Log composition — the dominant finding

Sampled 5,000 log lines spanning 2026-11-15 09:35 → 23:13 UTC (13.6 h), all `info` unless noted:

| Category | Lines | Share |
|---|---:|---:|
| `[Presence]` | 4,911 | **98.2 %** |
| `[News]` | 55 | 1.1 % |
| `[Moderation]` | 23 | 0.5 % |
| `[Profile]` | 3 | 0.06 % |
| `[Daily]` | 2 | 0.04 % |
| `[Summarizer]` | 2 (error) | 0.04 % |
| `[Lore]` | 1 | 0.02 % |
| `[SkarnLore]` | 1 | 0.02 % |
| `[Bot]` | 1 (error) | 0.02 % |
| sleep transition | 1 | 0.02 % |

**Rate:** 366 lines/hour → **~8,800 lines/day**. Queryable retention is ~24 h, so the entire inspectable history is ~8,800 lines of which roughly **180 carry signal**.

Only ~6 lines per hour are anything other than presence rotation:

```
[News] Fetched 200 articles
[Moderation] Input blocked for user <id>
[Profile] Updated profile for <id> in <guild>
[Daily] Starting maintenance... / Maintenance complete.
```

Every `[Moderation] Input blocked` line is a distinct, real safety event — 23 of them in 13.6 h — and each is currently surrounded by ~360 presence lines per hour of noise.

---

## 4. Findings

### F1 — Presence logging swamps the log stream · Medium

`features/presence/presenceMoodCycler.js:27` writes one line per rotation cycle, and the cycle interval is 10 s (`phraseRotationMs: 10000`). That is a deliberate, unconditional log on a loop running 8,640 times/day.

```js
result.then(outcome => { lastUpdateResult = outcome.ok ? 'ok' : outcome.reason; if (!outcome.ok && ...) updateErrorCount++; log('Railway presence: ' + state.mood + ' / ' + selected.id + ' (' + lastUpdateResult + ')'); })
```

The code already computes `outcome.ok` and tracks `lastUpdateResult`, and the observed value was `ok` on 4,911 of 4,911 occurrences — i.e. the line is reporting routine success with no diagnostic value.

**Impact:** operational signal (errors, safety blocks, maintenance failures) is buried under a 98 % noise floor, and the 24 h retention window is filled almost entirely by presence records.

**Fix:** log only on state change or non-`ok` outcome — e.g. keep `lastUpdateResult` and emit only when it differs from the previous value, or when `!outcome.ok`. Expected reduction: ~8,600 lines/day → near zero.

---

### F2 — Two threads fail summarization every day, forever · Low–Medium

Daily maintenance at 2026-11-15 20:06:24 UTC produced:

```
[Summarizer] Failed to summarize thread thread_158353000065269760_1460698506489630844_1789598473541: I don't do hate. Try again with something worth saying.
[Summarizer] Failed to summarize thread thread_158353000065269760_1460698506489630844_1790125829880: I don't do hate. Try again with something worth saying.
```

The message is not a model error — it is the safety gate's canned refusal (`features/safety/safeMessages.js:2`, keys `hate` / `hate/threatening`). The summarizer catches it and writes nothing:

```js
} catch (error) {
  console.error(`[Summarizer] Failed to summarize thread ${thread.thread_id}:`, error.message);
}
```

The selection query has no failure escape hatch (`db/conversation.js:102-107`):

```sql
SELECT * FROM conversation_threads
WHERE archived_at IS NOT NULL AND archived_at < ? AND topic_summary IS NULL AND message_count >= 3
```

Because `topic_summary` stays `NULL`, **the same two rows are re-selected on every daily run indefinitely**. There is no attempt counter, no failure marker, no exclusion list.

**Impact:** two wasted AI calls and two error-level lines every day forever; more importantly, a permanent pair of recurring errors trains you to ignore `[Summarizer] Failed` — which will hide the next genuine summarizer failure.

**Fix:** persist a failure signal — add `summary_attempts` / `summary_failed_at` and skip after N attempts, or write a sentinel `topic_summary` (e.g. `'[unsafe—not summarized]'`), or exclude threads whose content triggered the gate from future runs.

**Caveat:** log retention is ~24 h, so recurrence is established by code path rather than by observing multiple days. The query is provably re-entrant for a thread that never receives a summary.

---

### F3 — Lore batch churn is by design, but reads as thrash · Informational

Both at boot and at daily maintenance the sequence is:

```
[Lore] Batch: <era> — 600 → 605 stories (+5 new, 0 skipped, cap 600)
[SkarnLore] Pool prune: 605 → 600 stories (deleted 5)
```

This is specified behavior, not a defect. `features/wisdom/storyEngine.js:61-62` documents the intent — *"A 5-story drip into a bounded pool (STORY_POOL_CAP). The era only colours the prompt — the cap is enforced by pruneStoryPool(), never by the era rotation."* `pruneStoryPool` evicts the 5 **oldest** unused `auto_lore` rows (`db/stories.js:94-98`), so the newly generated stories survive and stale unused lore rotates out.

At steady state (pool already at 600) this means each run spends one model call to rotate 5 of 600 entries and produces no net growth. Called out only so the paired `600 → 605 → 600` lines are not misread as a bug during future log review.

---

### F4 — Sleep mode does not save usage hours, contrary to its comment · Low

`bot.js:191` labels the feature:

```js
// ===== Sleep mode (save usage hours) =====
```

Actual behavior: `isAsleep` gates only interaction replies (`bot.js:267-269`, `💤 Skarn is sleeping. Back at 7:00.`). The process, all schedulers, the presence cycler, and news fetching continue uninterrupted — confirmed by a flat 360–367 lines/hour through the entire 06:00–12:00 UTC sleep window.

Railway bills the replica for as long as it runs, so no cost is saved. The feature still works well as *"don't answer during off-hours"*; the comment overstates it. If actual cost reduction is ever the goal, that requires scale-to-zero or an off-hours cron, not an in-process flag — though a Discord gateway bot cannot be disconnected and still receive events, so the current approach is the reasonable one and only the comment needs correcting.

---

### F5 — Generic catch handler discards error context · Low

```
2026-11-15T14:42:01Z  error  [Bot] Caught: Unknown Channel
```

A single occurrence in 13.6 h — a Discord API error, most likely a reference to a deleted channel. The handler is one of four identical `catch (e) { console.error('[Bot] Caught:', e.message); }` blocks (`bot.js:332`, `341`, `641`, `675`) that drop the stack and the target (interaction/command/guild/channel).

**Fix:** log `e.stack` plus the relevant interaction or message identifier. At one occurrence per 13.6 h this is low priority, but the current format makes the event unattributable across the four call sites.

---

## 5. What checks out

- **Deployment integrity** — deployed commit identical to `HEAD`; no drift between repo and production
- **Stability** — no restarts or crashes in the observed window; boot banner appeared only once, at deployment
- **Sleep mode** — transitions fire within ~25 s of the configured boundary
- **Scheduling** — daily maintenance, 10-min loop, 5-min prunes, hourly reaction prune all present in logs at expected cadence
- **Ingress posture** — no public domain, no HTTP port; correct for a gateway-only bot (also means no HTTP healthcheck endpoint exists)
- **Resource headroom** — CPU effectively 0 %, memory 150/8192 MB, disk 377/4880 MB
- **Error density** — 3 error lines in 13.6 h, all accounted for above

---

## 6. Recommended actions, in priority order

1. **Demote the presence log** (`presenceMoodCycler.js:27`) to log-on-change or on `!outcome.ok`. Cuts ~98 % of log volume and makes the 24 h retention window usable. Highest value per line changed.
2. **Give the summarizer a failure escape hatch** (`db/conversation.js:102-107` + `summarizer.js:20-22`) so a gate-refused thread stops being retried daily. Removes a permanent recurring error.
3. **Correct the sleep-mode comment** at `bot.js:191` (or act on the cost intent explicitly). Documentation-only.
4. **Enrich the `[Bot] Caught` handlers** with `e.stack` and a target identifier. Cheap, improves future incident attribution.

---

## 7. Access notes

Railway CLI access required repair before this report could be produced, and one accidental change was made and reverted. Both are recorded here for traceability.

- **CLI binary was missing.** `@railway/cli` 5.74.0 had a truncated `downloaded.tar.gz` (failed with `Unexpected EOF in archive`), so `bin/railway` did not exist and every command exited 127. Re-downloaded the `x86_64-unknown-linux-musl` release v5.74.0 asset and extracted it into place.
- **OAuth had expired**, then the first fresh login code expired before completion. Second attempt succeeded; now authenticated as `pottinger@gmail.com`.
- **Accidental domain creation — reverted.** Running bare `railway domain` (no subcommand) *creates* a Railway service domain rather than listing domains. This created `anomaly-alphagithubio-production.up.railway.app` (id `b796396a-…`) at 23:11:59 UTC. It was deleted immediately; `railway domain list` now reports **no domains**, matching the pre-existing state. The service was never reachable on that host: the domain had no target port configured and the bot opens no HTTP listener.

---

## 8. Data provenance

| Claim | Source |
|---|---|
| Service identity, uptime, volume, deploy status | `railway status` |
| Deployment history | `railway deployment list`, `railway metrics` |
| Resource figures | `railway metrics --since 24h` |
| Log composition, rate, hourly distribution | `railway logs -n 5000 --json` (2026-11-15 09:35–23:13 UTC) |
| Sleep transitions | `railway logs --since 04:00Z --until 14:00Z` |
| Boot sequence | `railway logs --since 20:04Z --until 20:20Z` on 2026-11-14 |
| Build pipeline | `railway logs -b -n 60` |
| Presence log source, rotation interval | `features/presence/presenceMoodCycler.js:27,30`, `presence-assets/presence-mood-contract.json` |
| Summarizer failure path | `features/conversation/summarizer.js:1-22`, `db/conversation.js:102-107`, `features/safety/safeMessages.js:2` |
| Lore cap/eviction semantics | `features/wisdom/storyEngine.js:61-104`, `db/stories.js:87-112` |
| Sleep mode semantics | `bot.js:191-269` |
| Schedules | `bot.js:236,244,254`, `features/scheduler/index.js:62-95` |

Log retention limit worth knowing: `--since 24h` returns data, `--since 30h` returns zero lines. Anything older than ~24 h is not inspectable, which is precisely why F1's noise floor matters — it consumes the whole window.
