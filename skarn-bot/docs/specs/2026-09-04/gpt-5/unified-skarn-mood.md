# Unified Skarn Presence Mood

**Status:** Proposed
**Date:** 2026-09-04
**Scope:** Railway Discord bot and local desktop Rich Presence

## Summary

Skarn remains two separate processes with separate failure domains:

- Railway runs the Discord bot and owns the canonical cross-process presence mood.
- The local desktop process runs rich-presence.js, polls the canonical mood, and reports a liveness heartbeat.
- Each process owns an independent JSON phrase dataset, generator, retention policy, and rotation cursor. Phrase text is never synchronized.
- Railway's bot presence cycles a mood-appropriate phrase every 10 seconds. The local Rich Presence continues its existing 10-second activity rotation.

The shared object is the mood state and its time window, not the phrase corpus.

## Goals

1. Give Railway and local Rich Presence one canonical mood vocabulary and active mood window.
2. Apply 10-second, mood-filtered phrase cycling to the Railway bot.
3. Keep Railway and local phrase datasets independent.
4. Let the local process continue operating when Railway or the network is unavailable.
5. Make local-process liveness, mood freshness, phrase-pool health, and fallback state inspectable remotely.
6. Preserve the existing Railway per-guild emotional system and channel-state machine.
7. Keep phrase stores bounded and reject unclassified or malformed entries.

## Non-goals

- Synchronizing phrase text, phrase IDs, icons, or generation history.
- Replacing the Railway guild_mood system used to tune conversational responses.
- Replacing the Railway channel_state machine.
- Making the local RPC depend on Railway in order to display any presence.
- Adding Game Invites, party data, or join secrets.
- Making the local RPC a second writer of the canonical mood.

## Current system

| System | Scope | Current vocabulary | Storage | Current behavior |
|---|---|---|---|---|
| Railway guild mood | One state per guild | refreshed, neutral, tired, amused, focused, wrath | SQLite guild_mood | Evaluated from recent guild activity and injected into AI context |
| Railway channel state | One state per channel | Dormant, Attentive, Charged, Weathering | SQLite channel_state | Tracks conversation energy and decay |
| Railway presence cycler | Bot-wide | No mood tag today | SQLite app_state as a JSON string array | Watching phrase every 2 minutes, sleeping-aware |
| Local RPC mood | Process-wide | dormant, observing, pondering, displeased | In-memory mood window plus local JSON phrase/classification files | Mood dwell of 10 minutes and phrase rotation every 10 seconds |

The existing Railway and local mood vocabularies describe different things. guild_mood describes a server's interaction climate; the new presence mood describes Skarn's public ambient disposition. They must not be merged by renaming or directly mapping one guild's state to the global state.

## Language

**Presence mood**

The single global Skarn disposition shared by the Railway bot presence and local Rich Presence: dormant, observing, pondering, or displeased.

_Avoid_: guild mood, channel mood, emotional state when referring to this global state.

**Guild mood**

The existing per-guild activity-derived conversational context stored in guild_mood. It remains independent from presence mood.

**Phrase dataset**

A process-owned JSON collection of candidate presence phrases. Railway and local RPC datasets are deliberately independent.

**Mood window**

The interval beginning at moodStartedAt and ending at moodUntil. A mood cannot change during a valid window.

**Mood authority**

The Railway presence-mood coordinator. It is the only process allowed to create a new canonical mood revision.

**Heartbeat**

A small, authenticated liveness record written by the local RPC. It reports what the local process last observed; it does not change canonical mood.

## Design alternatives considered

### A. Shared vocabulary, independent mood computation

Both processes use the four IDs and the same probabilities but roll independently.

**Advantages:** no network dependency and minimal implementation work.

**Rejected for this goal:** the two surfaces can display different moods at the same time, so this unifies terminology but not Skarn's state.

### B. Deterministic schedule or shared random seed

Both processes derive the same mood from the clock and a seed without communicating.

**Advantages:** no API, no token, and no heartbeat transport required.

**Rejected for v1:** clock drift, restarts, sleep-window differences, and missed transitions eventually produce divergence. It also cannot expose whether the local process is alive.

### C. Railway-authoritative state with local polling and heartbeat — chosen

Railway creates and persists the canonical mood window. Local RPC polls it and reports its observed state separately.

**Advantages:** true shared mood, one writer, explicit stale-state behavior, and remote monitoring.

**Tradeoff:** exact synchronization needs network access; local fallback is therefore required.

### D. Discord-channel relay

The bot posts mood state to a private Discord channel and the local process reads it.

**Rejected:** it adds Discord message traffic and permissions to a control-plane concern, exposes more operational data than necessary, and makes stale detection less precise.

## Chosen architecture

~~~text
                         owns and persists
                 +-----------------------------+
                 | Railway presence coordinator |
                 | canonical mood + revision    |
                 +-------------+---------------+
                               |
                  authenticated HTTPS GET
                               |
                 +-------------v---------------+
                 | local RPC mood synchronizer  |
                 | poll + local fallback        |
                 +-------------+---------------+
                               |
                  authenticated HTTPS POST
                               |
                 +-------------v---------------+
                 | Railway heartbeat record     |
                 | stale/healthy remote status   |
                 +-------------------------------+

  Railway bot: own JSON dataset -> mood filter -> setActivity every 10s
  Local RPC:   own JSON dataset -> mood filter -> IPC Rich Presence every 10s
~~~

The Railway bot remains the authority even when the local RPC is offline. The local RPC remains functional when the Railway endpoint is unavailable by using its existing local mood calculation.

### Proposed module boundaries and lifecycle

The implementation must make the following boundaries explicit rather than embedding all state transitions in the existing cycler callback:

- Railway mood coordinator: features/presence/presenceMoodCoordinator.js. It exposes createPresenceMoodCoordinator(dependencies), getState(), ensureCurrentMood(now), getCanonicalState(), start(), and stop(). It owns selection, dwell, sleep-window transitions, revision increments, and persistence of skarn_presence_mood.
- Railway status server: features/presence/presenceStatusServer.js. It exposes createPresenceStatusServer(dependencies), start(), and close(). It owns HTTP parsing, authentication, body limits, readiness responses, and status serialization; it does not choose moods.
- Local synchronizer: lib/rpcMoodSync.js. It exposes createRpcMoodSync(options), start(onMood), stop(), getState(), and getStatus(). It owns polling, server-clock offset, heartbeat requests, stale detection, and fallback classification; rich-presence.js remains responsible for phrase selection and Discord IPC.
- Railway bot lifecycle: bot.js initializes the database and coordinator from clientReady, starts the cycler with the coordinator, and sets HTTP readiness only after those dependencies are ready. No other bot callback may call client.user.setActivity.
- Local lifecycle: rich-presence.js starts the synchronizer without waiting for the network. The first successful remote state may replace the local fallback on the next activity update.

The coordinator and synchronizer APIs must accept an injected clock and random source in tests. Production code may use Date.now and Math.random; tests must not depend on wall-clock waiting or probabilistic outcomes.

## Canonical presence mood contract

### IDs

Only these four IDs are valid:

| ID | Meaning | Default phrase style |
|---|---|---|
| dormant | Scheduled quiet hours; Skarn is unavailable for normal interaction | Sleep, stillness, old silence |
| observing | Default alert ambient state | Dry observation, restrained amusement |
| pondering | Reflective state | Questions, memory, philosophical pause |
| displeased | Controlled irritation, never abuse or harassment | Sharper edges, weary judgment |

### State document

The Railway state is a small JSON document stored under the bot's existing persistent state mechanism using the key skarn_presence_mood:

~~~json
{
  "schemaVersion": 1,
  "mood": "observing",
  "moodStartedAt": 1788040000000,
  "moodUntil": 1788040600000,
  "revision": 42,
  "updatedAt": 1788040000000,
  "source": "railway-coordinator"
}
~~~

Rules:

- mood must be one of the four canonical IDs.
- All timestamps are Unix milliseconds from the Railway process clock.
- revision increases monotonically whenever the mood changes.
- moodUntil is authoritative; clients do not recalculate the end of a remote mood window.
- The state is stored as one JSON value under app_state. SQLite row replacement is atomic, but the helper is not a compare-and-swap operation; the Railway coordinator is the sole writer and v1 requires one active Railway replica.
- Every successful mood read calls ensureCurrentMood(now) before serialization, so the endpoint never serves an expired state when the coordinator is healthy.
- Mood reads return both the state and serverNow. The local synchronizer estimates clock offset from the midpoint of the request and response, then evaluates freshness with the adjusted Railway clock. If the estimated offset exceeds 5 minutes, it rejects the remote state as unsafe and uses fallback mode.
- Missing, malformed, or unsupported state initializes to observing, unless the shared sleep window requires dormant.

### Selection and dwell

1. The Railway coordinator checks the shared sleep window before normal selection.
2. During sleep, the canonical mood is dormant until the configured wake boundary. It is not repeatedly re-rolled every 10 minutes.
3. Outside sleep, a valid mood window is retained until moodUntil.
4. At a non-dormant transition, choose from the existing distribution: observing 85%, pondering 10%, displeased 5%.
5. The coordinator should avoid selecting the same non-dormant mood twice consecutively when another valid mood is available.
6. The default mood dwell is 10 minutes.
7. Sleep boundaries use the existing SLEEP_TIMEZONE integer UTC offset, not each process's machine-local timezone. Railway and local configuration must set the same SLEEP_START, SLEEP_END, and SLEEP_TIMEZONE values. No IANA timezone-string parsing is introduced by this feature.

The 85/10/5 transition weights describe how often a mood window is selected; they do not describe the composition of either phrase dataset. In particular, the local 8,890-entry classification archive has its own observed label distribution, which is intentionally not treated as a target selection distribution.

The existing Railway guild_mood values may be retained as future inputs to this selection algorithm, but v1 must not map wrath directly to displeased or tired directly to pondering. There is no principled global mapping when multiple guilds disagree.

## Independent phrase datasets

### Local RPC dataset

The local process keeps using:

- data/rpc-phrases.json for the bounded active/archive cache.
- data/rpc-phrase-moods.json for the verified 8,890-entry classification archive.
- data/icon-registry.json for local asset metadata.

The local entry shape remains compatible with its Rich Presence card:

~~~json
{
  "key": "skarn_eye",
  "details": "Watching from shadows",
  "state": "Silence says enough",
  "mood": "observing"
}
~~~

### Railway dataset

Create an independent data/railway-presence-phrases.json document containing single-line Gateway presence entries:

~~~json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-04T00:00:00.000Z",
  "phrases": [
    { "id": "railway-0001", "text": "the mortals squabble", "mood": "observing" }
  ]
}
~~~

Railway entries require:

- A stable local ID, non-empty text, and exactly one canonical mood.
- One line and a short length suitable for client.user.setActivity(text, { type: 3 }).
- Case-insensitive deduplication by normalized text.
- A bounded maximum, defaulting to the existing PRESENCE_POOL_SIZE of 300.
- Minimum coverage for all four moods before mood-aware mode is enabled.

The old app_state string-array pool is a migration fallback only. On first migration, existing entries must be classified or explicitly reviewed; they must not silently become observing. Invalid or unclassified entries stay out of the active pool and are reported in validation output.

Migration is performed by scripts/migrate-railway-presence-phrases.js:

1. Back up the Railway database and read the legacy presence_phrases value without modifying it.
2. Convert each string to the new object shape and classify it with a resumable checkpointed classifier or an explicit review file.
3. Write the new JSON document through a temporary file and rename only after schema, mood, line-length, deduplication, and coverage validation passes.
4. Leave the legacy app_state key untouched during the rollback window; the feature flag can immediately return to the old cycler if validation or runtime checks fail.
5. Mark the legacy key as migrated only after a successful production observation period. Do not delete the old value as part of the first migration.

Future Railway generation must use a named generator, scripts/generate-railway-presence.js, which emits the same validated JSON shape. A generated replacement is staged and validated before it replaces the active dataset; generation never runs inside the 10-second cycle callback.

The two files may have different counts, IDs, wording, generation dates, and mood distributions. A change to one dataset does not trigger a write to the other.

## Railway 10-second cycling

Update features/presence/presenceCycler.js to:

- Load and validate the Railway JSON dataset.
- Read the canonical presence mood before each cycle.
- Filter only entries matching that mood.
- Advance through a process-local shuffled deck or bounded no-repeat cursor.
- Call client.user.setActivity(text, { type: 3 }) at most once per 10-second interval.
- Log the mood revision, selected phrase ID, candidate count, and update result without logging secrets.
- Use a safe fallback phrase when a mood pool is empty, while marking the process status as degraded.

The Railway dataset must contain at least 10 valid entries for each canonical mood before mood-aware mode is enabled. The local active dataset must contain at least one valid entry for each mood; missing local coverage is allowed only with an explicit degraded heartbeat and an observing fallback. A mood read must not silently make an unclassified phrase eligible.

The bot's current direct sleep writes in bot.js must be removed from the visible-activity path in the same release that enables the new cycler. The implementation must retain isAsleep and the command rejection behavior, but move sleep-entry and wake transitions into the single presence owner. On entering sleep, the owner immediately selects a dormant phrase and continues the 10-second dormant cycle; on waking, it immediately selects a non-dormant mood window and phrase. This preserves the cost-saving command gate without creating a last-writer-wins race or a blank sleep presence.

Discord Gateway presence updates are small and the requested rate is six updates per minute. The official Gateway ceiling is an upper bound for all sent events, not a presence-specific guarantee; the implementation must budget presence updates alongside other Gateway traffic and measure failures. A failed setActivity call or client error marks the cycle as failed, skips queued retries, and retries on the next scheduled interval with a capped cooldown. It must never enqueue an unbounded backlog. The acceptance test must assert no more than one presence update attempt per 10-second slot.

Before enabling the flag, record the bot's Discord user ID and the Discord user identity receiving the local RPC. If they are the same identity, the two transports require an explicit mutual-exclusion policy because last-writer-wins activity updates can overwrite one another. The recommended deployment assumes they are different identities; the rollout must verify this rather than infer it from application IDs.

## HTTP status and synchronization contract

Add a small built-in Node http server to the Railway bot; do not add Express for four small routes. Bind it to 0.0.0.0 and process.env.PORT. Start the listener early with readiness=false, return 503 from /health until the database, mood coordinator, and Discord client are ready, then set readiness=true from the existing clientReady path. Add these routes:

### GET /health

- No authentication.
- Returns HTTP 200 only after the bot has initialized its required database and presence coordinator.
- Used for deployment readiness only.
- Does not claim that the local RPC is alive.

### GET /internal/skarn/presence-mood

- Requires a dedicated read bearer token.
- Calls ensureCurrentMood before returning the canonical state document plus Railway server time.
- Must not include phrase text, guild IDs, user IDs, or environment variables.
- Sends Cache-Control: no-store.

### POST /internal/skarn/rpc-heartbeat

- Requires a separate heartbeat-write bearer token.
- Accepts only a small JSON body, with a strict size limit.
- Upserts the latest local RPC heartbeat under skarn_rpc_heartbeat.
- Returns 204 on success.

### GET /internal/skarn/status

- Requires the read bearer token.
- Returns the canonical mood and heartbeat freshness, suitable for a private operator check.
- Reports healthy, degraded, or stale without exposing secrets or user data.

Railway's healthcheck is a deployment readiness check, not continuous monitoring. Heartbeat freshness is the continuous liveness signal for the local RPC.

## Heartbeat document

The local RPC sends at most one bounded document per heartbeat interval using the existing Node HTTPS client:

~~~json
{
  "schemaVersion": 1,
  "process": "skarn-rpc",
  "instanceId": "local-rpc-opaque-id",
  "sentAt": 1788040030000,
  "status": "healthy",
  "observedMood": "observing",
  "moodSource": "remote",
  "remoteRevision": 42,
  "moodUntil": 1788040600000,
  "lastMoodPollAt": 1788040030000,
  "lastPhraseAt": 1788040020000,
  "lastPhraseKey": "skarn_eye",
  "activePoolSize": 500,
  "activeClassifiedCount": 500,
  "classificationArchiveCount": 8890
}
~~~

Rules:

- Send every 60 seconds by default; do not send on every 10-second phrase rotation.
- instanceId contains no account or machine-identifying data and may be regenerated after restart.
- moodSource is remote when the latest valid Railway state is in use and fallback otherwise.
- status becomes degraded for a local fallback, missing mood pool, classification mismatch, or excessive clock skew.
- classificationArchiveCount means the total valid entries in the on-disk classification archive; activeClassifiedCount means valid mood-tagged entries loaded in the active pool. They must not be conflated.
- The server marks the record stale after 180 seconds without a successful heartbeat POST. Mood-poll failures affect the local moodSource and local status, but do not change the server-side heartbeat freshness.
- Heartbeat failures never stop local phrase rotation.
- Heartbeat payloads never contain phrase text, message content, guild IDs, user IDs, API keys, or tokens.

Recommended local configuration:

| Variable | Default | Purpose |
|---|---:|---|
| SKARN_PRESENCE_MOOD_URL | unset | Railway HTTPS base URL; unset preserves local-only mode |
| SKARN_PRESENCE_MOOD_READ_TOKEN | unset | Token for mood/status reads |
| SKARN_RPC_HEARTBEAT_TOKEN | unset | Token for heartbeat writes |
| SKARN_MOOD_POLL_MS | 30000 | Remote mood poll interval |
| SKARN_RPC_HEARTBEAT_MS | 60000 | Heartbeat interval |
| SKARN_MOOD_STALE_MS | 180000 | Remote mood freshness threshold |
| SLEEP_TIMEZONE | 0 | Integer UTC offset shared by Railway and local fallback sleep-window calculations |

When the URL or tokens are absent, the local RPC remains fully local and logs that remote synchronization is disabled rather than treating it as an error.

## Failure behavior

| Failure | Railway bot | Local RPC | Operator signal |
|---|---|---|---|
| Railway mood state missing | Initialize observing or dormant from schedule | Use local fallback | state_initialized warning |
| Railway endpoint unavailable | Continue current canonical state and cycling | Keep last valid state until stale, then local fallback | heartbeat moodSource=fallback |
| Local RPC offline | Continue Railway mood and cycling | None | heartbeat becomes stale |
| Invalid mood ID | Reject state; retain last valid state | Reject response; retain/fallback | invalid_state error |
| Empty Railway mood pool | Use bounded safe fallback; do not generate in the cycle callback | Unaffected | degraded, candidate count 0 |
| Railway redeploy | Load state/dataset from persistent storage or safe defaults | Reconnect and poll | revision/heartbeat timestamps |
| Discord presence update failure | Log and retry on the next scheduled interval with backoff | Existing reconnect behavior | update error count |
| Network outage at local startup | Start immediately using local mood logic | Continue 10-second rotation | remote_sync=offline |

## Persistence and Railway requirements

The Railway SQLite database and runtime JSON dataset must be on an attached Railway volume mounted at the path the application actually reads. Verify this before rollout; a deployment image alone is not a durable source for generated state.

If the volume is mounted at /app/data, it can hide data files shipped inside the image. The first boot must therefore create or copy the Railway JSON dataset into the mounted directory before the cycler requires it. Phase 0 verification uses railway ssh ... -- ls -la /app/data and expects the database plus the validated Railway dataset after bootstrap. An empty mounted directory is a migration state, not a valid active deployment.

The implementation must:

- Write JSON datasets atomically through a temporary file and rename.
- Keep the Railway phrase dataset bounded.
- Keep only the latest heartbeat record, not an unbounded heartbeat history.
- Preserve the existing database backup procedure before schema or state changes.
- Work with one Railway replica; do not assume multiple writers or replicas.
- Store tokens only in Railway/local secret configuration; never commit them to JSON, .env files, fixtures, or documentation.

## Observability

Add a read-only scripts/report-presence-state.js command and expose it as npm run status:presence. It should print:

- canonical mood, revision, start, and end;
- Railway cycler status, dataset count, current mood candidate count, and last update result;
- local RPC heartbeat status, age, observed mood, source, pool count, and classification count;
- explicit stale/degraded reasons.

The command must redact tokens and avoid printing phrase text or identifiers that are not needed for diagnosis. It should work inside Railway SSH:

~~~powershell
railway ssh --project=PROJECT_ID --environment=ENVIRONMENT_ID --service=SERVICE_ID -- npm run status:presence
~~~

The existing direct SQLite query remains a fallback operator tool, not the primary interface.

## Security

- Use HTTPS for all local-to-Railway requests.
- Use separate read and heartbeat-write secrets.
- Compare bearer tokens with a constant-time comparison and never log them.
- Reject unexpected methods, content types, oversized bodies, and unsupported schema versions.
- Rate-limit heartbeat writes by token/process identity so a bad local loop cannot create database pressure.
- Never expose the bot token, OpenAI key, phrase corpus, guild IDs, user IDs, or message data through status routes.
- Treat the local RPC as untrusted input at the heartbeat boundary; validate every field and clamp numeric values.

## Implementation sequence

### Phase 0 — Preconditions

- Confirm the local 8,890-entry classification is active and the local process has restarted successfully.
- Confirm the Railway volume and the actual /app/data persistence path.
- Decide the configured shared timezone and the Railway public HTTPS domain.

### Phase 1 — Contract without behavior change

- Add canonical mood constants and validators.
- Add JSON validators for both independent datasets.
- Add state/heartbeat serialization helpers.
- Add unit tests for mood IDs, time windows, stale detection, malformed payloads, and injected clock/random behavior. Add scripts/smokes/14-presence-mood.js to the existing smoke runner for the coordinator, cycler, synchronizer, and status routes.

### Phase 2 — Railway coordinator and dataset

- Create and validate data/railway-presence-phrases.json.
- Migrate existing Railway phrases without silently labeling them observing.
- Add the Railway mood coordinator and persistent state key.
- Add scripts/migrate-railway-presence-phrases.js and scripts/generate-railway-presence.js with checkpoint, staging, validation, and rollback behavior.
- Add the built-in node:http status server, readiness sequencing, exact module APIs, and status:presence package script behind feature flags.
- Add storage bootstrap and verify the mounted /app/data path before enabling runtime JSON reads.

### Phase 3 — Railway 10-second cycling

- Change the effective cycle to 10 seconds only when PRESENCE_MOOD_V2=true.
- Make the presence coordinator/cycler the sole writer of bot activity; remove the bot.js setActivity calls used by sleep entry and wake, while retaining the isAsleep command gate.
- Resolve sleep behavior explicitly: command sleep remains active; the dormant phrase pool cycles immediately and continuously without invoking AI.
- Add update error/backoff handling, the one-attempt-per-slot invariant, candidate coverage metrics, identity verification, and a rollback flag.

### Phase 4 — Local synchronization

- Add and test the focused CommonJS module at lib/rpcMoodSync.js for remote polling, heartbeat serialization, token handling, server-clock offset, stale detection, and local fallback. Keep rich-presence.js responsible for activity selection and IPC only.
- Use remote mood revisions when fresh; preserve local fallback when not.
- Restart the local process with the two tokens and verify moodSource=remote.

### Phase 5 — Remove transitional paths

- Remove the old Railway string-array cycler only after the JSON dataset has passed validation and rollback evidence exists.
- Keep the local fallback and the read-only status command permanently.

## Verification and acceptance criteria

### Automated

- Every Railway phrase has exactly one canonical mood.
- Every local active phrase has a valid mood lookup; classification archive remains exactly 8,890 entries.
- Both datasets deduplicate independently and stay within their configured limits.
- Mood state rejects unknown IDs, reversed timestamps, oversized revisions, and unsupported schema versions.
- Mood remains unchanged inside its 10-minute window.
- Sleep boundaries produce dormant consistently using the configured offset.
- Railway cycling selects only the current mood's candidates when available.
- Railway calls setActivity no more than once per 10 seconds and does not queue retries indefinitely.
- Heartbeat authentication, body limits, stale thresholds, and redaction are tested.
- Local rotation continues when mood polling and heartbeat requests fail.
- Remote state freshness is tested with injected Railway/local clock skew, including the 5-minute rejection boundary.
- The migration script preserves the legacy app_state key until explicit cutover and can roll back to the old string-array cycler.

### Manual and remote

1. Deploy with PRESENCE_MOOD_V2=false; confirm the existing bot behavior is unchanged.
2. Enable it and run npm run status:presence through Railway SSH.
3. Observe the Railway bot activity changing approximately every 10 seconds.
4. Confirm two successive Railway phrases share the same mood revision during a dwell window.
5. Confirm the local RPC log reports the same mood ID and revision after polling.
6. Stop or block local outbound requests; confirm local cycling continues and status becomes fallback/stale.
7. Restart Railway; confirm canonical state and dataset survive when the volume is attached.
8. Test the 01:00–07:00 window in a staging configuration; confirm both processes enter dormant and wake consistently.
9. Use /vibe only for the existing per-guild emotional climate; do not treat it as the canonical presence-mood check.
10. Verify the Railway bot user ID and local RPC Discord user identity are distinct, or enable the documented mutual-exclusion policy.

## Decision trace

| Decision | Reason |
|---|---|
| One new global presence mood, four IDs | Existing guild mood and channel state are scoped environmental signals, not one global Skarn disposition. |
| Railway is the authority | It is the always-on process and already owns persistent bot-level state. |
| Local polls and heartbeats | This gives true alignment plus remote liveness without making local display unavailable offline. |
| Separate phrase datasets | The user wants independent wording, generation, retention, and JSON ownership; mood is the only shared semantic contract. |
| Railway phrase format is single-line text | Discord.js Gateway bot presence does not provide the local RPC's image/details/state card shape. |
| Heartbeat is not a mood writer | Liveness must not create split-brain mood transitions. |
| Existing guild mood remains | Replacing it would change conversational behavior and incorrectly collapse per-guild states into a global state. |
| Dormant phrases may cycle while commands sleep | It avoids competing presence writers while preserving the bot's interaction/cost sleep gate; bot.js no longer writes a competing activity. |
| Railway timestamps include serverNow | The two machines can have different clocks; the local synchronizer must not compare raw Railway timestamps to an uncorrected local clock. |
| Existing Railway strings migrate through a named staged script | The old pool must remain recoverable and must not be silently relabeled. |

## Sources and evidence

- Discord Gateway documentation: https://docs.discord.com/developers/events/gateway — Gateway payload limits and event rate guidance.
- Discord Gateway Events: https://docs.discord.com/developers/events/gateway-events — Presence Update structure and activity fields.
- discord.js ClientUser: https://discordjs.dev/docs/packages/discord.js/14.19.3/ClientUser:Class — setActivity/setPresence behavior.
- Railway SSH CLI: https://docs.railway.com/cli/ssh — non-interactive railway ssh -- COMMAND support.
- Railway networking troubleshooting: https://docs.railway.com/networking/troubleshooting/application-failed-to-respond — bind HTTP services to 0.0.0.0 and PORT.
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks — healthchecks validate deployment readiness and are not continuous monitoring.
- Railway volumes: https://docs.railway.com/volumes/reference — persistent storage constraints and one-volume/replica considerations.

## Open implementation choices

These do not change the architecture but must be settled during implementation:

- The exact Railway public domain and secret names.
- Whether the Railway JSON dataset is committed as a reviewed baseline, stored only on the attached volume, or both.
- The initial classification/review workflow for the existing 300 Railway strings.
- Whether the operator status is exposed only through SSH or also through a restricted Discord owner command.
