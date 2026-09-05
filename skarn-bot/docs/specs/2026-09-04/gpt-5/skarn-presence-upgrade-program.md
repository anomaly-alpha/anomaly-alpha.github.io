# Skarn Presence Upgrade Program

**Status:** Proposed v1 after design grilling
**Date:** 2026-09-04
**Scope:** Independent Railway Discord bot, local desktop Rich Presence process, shared mood rules, phrase maintenance, SSH diagnostics, and future presentation work
**Relationship:** This is the umbrella specification for the five upgrade workstreams. It supersedes the v1 synchronization assumptions in unified-skarn-mood.md while preserving the four-state vocabulary and independent phrase-dataset decision.

## Decision summary

Skarn remains two separate processes:

- Railway owns and persists the bot's own presence mood.
- The local desktop process owns and persists the local RPC's own presence mood.
- Both processes load one committed presence-mood contract containing the same four IDs, sleep window, dwell, weights, and phrase cadence.
- They choose moods independently. A matching mood at the same instant is not expected or required.
- Railway cycles its own mood-tagged phrase dataset every 10 seconds, including dormant phrases during command-sleep hours.
- The local RPC continues its own 10-second IPC rotation using its own active/archive data.
- There is no live local-to-Railway synchronization, heartbeat, or status HTTP API in v1.
- Operators inspect Railway through railway ssh and inspect the local process through PM2/logs.
- Railway persists a compact runtime snapshot every 60 seconds so a separate SSH command can report recent cycler health without reading another process's memory.
- Phrase maintenance runs inside each long-running process through a bounded asynchronous worker with a lock and timeout.
- The first presentation release is text-first. Existing missing/stale asset references are documented as a known limitation and are not a release gate.

This is a shared behavioral contract, not a shared live state. The phrase files, mood windows, revisions, random choices, generation history, and asset decisions remain process-owned.

## Goals

1. Give Railway and local RPC one stable four-state presence vocabulary and timing policy.
2. Apply reliable 10-second, mood-filtered phrase cycling to the Railway bot.
3. Keep Railway and local phrase datasets independent.
4. Preserve a valid mood window across restarts in each process.
5. Bound phrase generation, classification, pruning, archives, and runtime snapshots.
6. Make Railway status inspectable through SSH and local health inspectable through PM2/logs.
7. Keep maintenance failures from blocking or multiplying 10-second presence updates.
8. Preserve the existing per-guild guild_mood and per-channel channel_state systems.
9. Provide a safe phased rollout and rollback path.

## Non-goals

- Making Railway and local display the same mood at the same time.
- Synchronizing phrase text, phrase IDs, generation history, or rotation order.
- Adding remote mood polling or local heartbeats in v1.
- Adding a Railway HTTP listener or health/status endpoint in v1.
- Replacing guild_mood or channel_state.
- Deriving global presence mood from one guild or from an aggregate of guilds.
- Fixing Discord assets, adding buttons, adding timestamps, or adding party/invite behavior in the text-first release.
- Switching from discord-rpc or discord.js to the Discord Social SDK solely because its guide documents additional activity fields.

## Current baseline and evidence

| Area | Observed baseline | v1 consequence |
|---|---|---|
| Local RPC | rich-presence.js; 500 active entries; 2,000 archive entries; 8,890 verified mood classifications; 10-minute mood dwell; 10-second IPC rotation | Preserve the bounded cache and add persistence/tests around it. |
| Local mood | dormant, observing, pondering, displeased; local selection already uses the 01:00–07:00 window and weighted non-dormant rolls | Move constants into the shared contract while keeping local state independent. |
| Railway presence | features/presence/presenceCycler.js uses the legacy string pool and slower cycle; bot.js sleep logic also writes activity | Add a Railway coordinator and make it the only bot activity writer. |
| Railway guild mood | features/mood/moodManager.js stores refreshed, neutral, tired, amused, focused, and wrath per guild | Keep it separate; no direct mapping to presence mood. |
| Railway runtime | Railway SSH can run one-off commands; the repository has no tracked Railway deployment descriptor | Use SSH for operations and make topology verification a Phase 0 gate. |
| Local transport | discord-rpc 4.0.1 over Discord IPC | Keep the current text/activity path in v1. |
| Railway transport | discord.js 14.16.3 through the bot Gateway | Use the proven text/type subset for v1. |
| Shared application | The bot and local RPC use application ID 982308134871765022 but update different user contexts | Retain one application and separate bot/local activity writers. |
| Assets | skarn_logo is absent from the verified Portal inventory; stale icon references remain in the old cache | Accept as a documented presentation limitation until the later asset phase. |

## Five workstreams

| Workstream | Outcome | Priority | Depends on |
|---|---|---:|---|
| 1. Independent mood contract and Railway cycling | Shared rules, independent persisted mood windows, and a Railway 10-second cycler | P0 | Topology preflight and contract validators |
| 2. SSH diagnostics and runtime snapshot | Railway-only operator visibility without HTTP or heartbeat infrastructure | P0 | Railway coordinator state |
| 3. Local RPC hardening | Restart-safe local mood state, deterministic tests, and bounded fallback behavior | P1 | Shared contract |
| 4. Phrase lifecycle | Scheduled, bounded, classified, reviewed, and atomically replaced datasets | P1 | Dataset validators and maintenance worker |
| 5. Presentation upgrade | Later asset repair and optional fields; text-first v1 has no visual gate | P2 | Explicit future asset audit and transport canary |

Recommended dependency order:

~~~text
Topology read-only gate
          |
          v
Shared contract and validators
          |
          +--> Railway coordinator/cycler --> SSH snapshot/status
          |
          +--> Local persisted mood/tests
          |
          +--> Bounded maintenance workers
                                      |
                                      v
                         Later asset/presentation phase
~~~

## Domain contract

### Presence mood

Presence mood is the global concept shared by name and policy across both processes. It has exactly four IDs:

| ID | Meaning | Phrase direction |
|---|---|---|
| dormant | Scheduled quiet hours; Skarn is unavailable for normal interaction | Stillness, sleep, old silence |
| observing | Default alert state | Dry observation and restrained amusement |
| pondering | Reflective state | Questions, memory, philosophical pause |
| displeased | Controlled irritation without harassment | Sharp, weary judgment |

Guild mood describes one server's conversational climate. Channel state describes one conversation's energy. Neither is presence mood.

### Shared contract file

Create data/presence-mood-contract.json as the single repository source for values that must not drift:

~~~json
{
  "schemaVersion": 1,
  "moods": ["dormant", "observing", "pondering", "displeased"],
  "sleepWindow": { "startHour": 1, "endHour": 7, "utcOffset": 0 },
  "moodDwellMs": 600000,
  "phraseRotationMs": 10000,
  "selectionWeights": {
    "observing": 0.85,
    "pondering": 0.10,
    "displeased": 0.05
  },
  "maintenance": {
    "localIntervalMs": 43200000,
    "railwayIntervalMs": 86400000,
    "maxBatchSize": 50
  }
}
~~~

Both processes load and validate this file at startup. Runtime mood state is not shared. A contract change requires a repository change and validation in both process paths.

Rules:

- During the shared 01:00–07:00 window, each process uses dormant without a random roll.
- Outside sleep, each process holds its own mood for 10 minutes.
- Each process independently selects observing 85%, pondering 10%, and displeased 5% at a non-dormant transition.
- Each process may avoid repeating its previous non-dormant mood when alternatives exist.
- Phrase rotation happens every 10 seconds independently of mood dwell.
- utcOffset is an explicit integer configuration value; neither process uses implicit machine-local timezone behavior.

### Independent state documents

Railway stores its own state under the existing application-state mechanism using skarn_presence_mood:

~~~json
{
  "schemaVersion": 1,
  "process": "skarn-railway-bot",
  "mood": "observing",
  "moodStartedAt": 1788040000000,
  "moodUntil": 1788040600000,
  "revision": 42,
  "updatedAt": 1788040000000
}
~~~

The local process stores its own state in data/rpc-mood-state.json using the same fields with process=skarn-rpc. Revisions are process-local and must never be compared as if they were shared sequence numbers.

On restart, a valid unexpired state resumes. An expired, malformed, reversed, or unsupported state is replaced using the shared sleep rule or a new local roll. State replacement is atomic. A missing state must not prevent either process from starting.

During Railway migration, the legacy app_state keys presence_phrases and presence_phrases_generated_at may coexist with skarn_presence_mood and skarn_presence_runtime. The new coordinator ignores the legacy keys while the rollback window is open; it does not delete or rewrite them until migration cleanup is explicitly approved.

## Workstream 1 — Independent mood contract and Railway cycling

### Railway module boundaries

Create an explicit Railway presence subsystem:

- features/presence/presenceMoodCoordinator.js owns Railway's mood state, dwell window, sleep transition, revision, persistence, and injected clock/random source.
- features/presence/presenceCycler.js owns Railway dataset loading, mood filtering, deck/cursor rotation, pacing, and update metrics.
- bot.js initializes the coordinator after database readiness and starts the cycler after Discord client readiness.
- Only the Railway presence owner may call client.user.setActivity or client.user.setPresence for ambient activity.

The existing isAsleep boolean remains a bot.js command/cost gate. The coordinator owns presence mood and activity transitions. Both use the shared pure sleep predicate, but neither reads or mutates the other's mutable state. The bot sleep-check timer may update isAsleep; it must not write Discord activity.

### Railway phrase dataset

Create data/railway-presence-phrases.json:

~~~json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-04T00:00:00.000Z",
  "phrases": [
    { "id": "railway-0001", "text": "the mortals squabble", "mood": "observing" }
  ]
}
~~~

Every active entry requires a stable ID, one non-empty single-line text value, exactly one canonical mood, suitable length, normalized-text deduplication, and no guild/user/message/token/deployment data. The default Railway maximum is 300 entries, with at least 10 valid entries per mood before mood-aware mode is enabled.

### Legacy migration

Implement scripts/migrate-railway-presence-phrases.js:

1. Verify the target Railway service, database path, volume, and process root before reading data.
2. Back up the legacy app_state presence_phrases value without modifying it.
3. Convert every legacy string to a candidate and classify it or explicitly review it.
4. Require a sample and edge-case human review for every classifier batch before activation.
5. Stage the new file and validate schema, length, deduplication, mood coverage, limits, and provenance.
6. Replace the active file atomically only after validation passes.
7. Keep the legacy value through the rollback window.

No legacy entry silently becomes observing. Invalid or unreviewed entries remain quarantined and are counted in the operator report.

Implement scripts/generate-railway-presence.js for future batches. It runs only in the maintenance worker, never in the 10-second cycle callback.

### Railway rotation

Every 10-second slot:

1. Read the current Railway mood state.
2. Filter the Railway dataset to that mood.
3. Select from a shuffled deck or bounded no-repeat cursor.
4. Call the single activity writer at most once.
5. Update in-memory metrics and the next runtime snapshot.

During the 01:00–07:00 window, the bot cycles dormant phrases every 10 seconds while retaining its existing command-sleep/cost gate. On wake, it starts a new non-dormant mood window and phrase.

If a mood pool is empty, use a bounded safe fallback and mark degraded. Do not generate synchronously and do not queue retries. Failed activity updates wait for the next scheduled slot with capped cooldown/backoff.

The target is six activity attempts per minute. It must be budgeted with other Gateway traffic and remain below Discord's documented event-payload limit. The implementation must assert no more than one attempt per 10-second slot.

## Workstream 2 — SSH diagnostics and runtime snapshot

### Deliberate absence of HTTP

V1 adds no Railway HTTP listener, /health route, status route, heartbeat route, or local-to-Railway network contract. Railway is treated as a long-running worker service. Deployment confidence comes from clean startup/exit behavior, Railway restart policy, logs, and SSH verification.

The dashboard's HTTP healthcheck must not be configured as a required gate for this worker. If the current service is configured to expect a PORT listener, that configuration must be removed or changed before the new worker behavior is enabled.

The 180-second stale threshold applies only to the diagnostic runtime snapshot. It is not a sleep-window boundary, command gate, or replacement for the bot's isAsleep logic. The implementation must keep these concepts and configuration values separate.

### Runtime snapshot

Because an SSH command launches a separate process, the running bot persists one compact snapshot under skarn_presence_runtime in app_state every 60 seconds:

~~~json
{
  "schemaVersion": 1,
  "process": "skarn-railway-bot",
  "writtenAt": 1788040060000,
  "enabled": true,
  "mood": "observing",
  "moodStartedAt": 1788040000000,
  "moodUntil": 1788040600000,
  "moodRevision": 42,
  "datasetCount": 300,
  "moodCandidateCount": 84,
  "lastPhraseId": "railway-0001",
  "lastUpdateAt": 1788040050000,
  "lastUpdateResult": "ok",
  "updateErrorCount": 0,
  "status": "healthy"
}
~~~

The snapshot contains no phrase text, guild IDs, user IDs, tokens, message content, or credentials. It is replaced as one bounded value, not appended to a history. A snapshot write failure logs degraded but never stops phrase rotation.

### Operator command

Add scripts/report-presence-state.js and expose npm run status:presence. When run through SSH, it reads:

- the Railway mood state;
- the runtime snapshot and its age;
- dataset count and per-mood coverage;
- last update result and error count;
- legacy/migration status;
- stale, degraded, invalid, or missing-state reasons.

The command must distinguish live runtime data from the last persisted snapshot. If snapshot age exceeds 180 seconds, it reports runtime=stale; it must not present the old snapshot as live. It exits nonzero for invalid state or hard dataset-limit violations.

Operator invocation:

~~~text
railway ssh --project=PROJECT_ID --environment=ENVIRONMENT_ID --service=SERVICE_ID -- npm run status:presence
~~~

Local diagnostics remain local: use PM2 status/logs and the local state/cache validation command. No local liveness claim is sent to Railway.

## Workstream 3 — Local RPC hardening

### Local lifecycle

rich-presence.js remains responsible for Discord IPC connection, activity construction, phrase selection, and 10-second rotation. Add a focused local state helper rather than a network synchronizer:

- load data/rpc-mood-state.json;
- validate the shared contract and local state;
- resume an unexpired mood window;
- write state atomically on mood transition;
- fall back locally when the state or data is invalid;
- expose a read-only local diagnostic object for PM2/log inspection.

Do not add lib/rpcMoodSync.js, remote mood polling, heartbeat serialization, server-clock offset, or remoteRevision fields to v1. Those are reserved for a separate future synchronization specification.

### Local data rules

- data/rpc-phrases.json remains capped at 500 active and 2,000 archived entries.
- data/rpc-phrase-moods.json remains the verified 8,890-entry classification archive.
- data/backups/rpc-phrases-pre-prune-2026-09-04.json remains the current recovery source; future backup names use the actual execution date.
- A local active phrase must resolve to exactly one canonical mood.
- A malformed or missing local state file must not prevent IPC rotation.
- The local process must never wait for Railway, SSH, or any network call to display activity.

### Test seams

Inject clock, timers, random source, and filesystem/request abstractions in tests. At minimum test:

- all four mood IDs and rejection of unknown IDs;
- sleep boundaries at 01:00, 06:59, 07:00, and midnight;
- ten-minute dwell and restart resume;
- ten-second activity slots and no immediate repeat when alternatives exist;
- empty mood-pool fallback;
- malformed, reversed, expired, and unsupported local state;
- atomic state replacement and interrupted-write recovery;
- local rotation continuing when files or optional diagnostics fail.

Tests use deterministic time/random values. They do not wait ten minutes or require Discord to be running.

Add scripts/smokes/14-presence-mood.js to the existing scripts/run-smokes.js runner, using fakes rather than live Discord, Railway, SSH, or credentials.

## Workstream 4 — Phrase lifecycle and growth controls

### Common lifecycle

Both processes use the same lifecycle discipline but different data:

~~~text
candidate -> normalize -> deduplicate -> classify/review -> validate -> stage -> atomic replace
                                      \-> quarantine with reason
~~~

Validation covers schema, required fields, canonical mood, one-line/length limits, normalized case-insensitive deduplication, stable process-local IDs, provenance, generation timestamp, and configured size limits. A failed run never replaces the last valid file.

### Maintenance workers

Each long-running process owns an asynchronous bounded maintenance worker:

- local interval: 12 hours;
- Railway interval: 24 hours;
- maximum generated batch: 50;
- one worker lock per process;
- no overlapping runs;
- explicit timeout and cost limit;
- no maintenance work in the 10-second rotation callback;
- atomic replacement only after validation.

The timer schedules the worker; it does not perform a large synchronous generation or prune operation on the rotation path. If OpenAI generation/classification fails, times out, or exceeds budget, abort that run, retain the prior dataset, log a bounded error, release the lock, and wait for the next cadence. Do not immediately retry in a loop.

### Local pruning

Pruning order is deterministic:

1. exact duplicates;
2. normalized case-insensitive duplicates;
3. unsupported or malformed records;
4. invalid asset references only when asset validation is enabled in a later phase;
5. over-limit overflow by documented age/score order.

Quarantine records are counted and reported, not silently destroyed. The full 8,890-entry classification archive is not treated as the active rotation pool.

### Railway maintenance

Railway's independent dataset defaults to 300 entries and requires at least 10 valid entries for every mood before activation. Every classifier batch receives representative sample review, all ambiguous/edge-case review, and review of safety/validation exceptions. The reviewed report is retained with the staged artifact.

### Growth detection

status:presence and local diagnostics report:

- active count over maximum;
- archive count over maximum;
- classification count mismatch;
- unclassified/unknown-mood records;
- duplicate count/rate;
- failed or interrupted generation;
- unexpected file-size growth;
- runtime snapshot age on Railway;
- maintenance worker lock/last-run/error status.

Hard-limit violations block activation of the replacement dataset. The process continues with the previous valid dataset or a bounded safe fallback.

### Railway topology gate

Before Railway migration or activation, read-only checks must verify:

- the bot service root/start command does not accidentally run the root static-site package;
- the bot's SQLite database and JSON dataset are on the attached bot-service volume;
- the public static-site service cannot read or serve the bot volume;
- a mounted empty directory is bootstrapped from an explicit reviewed baseline before runtime reads it;
- one active replica is used while volume-backed SQLite/JSON state is authoritative.

The repository has no tracked railway.json, railway.toml, Dockerfile, or equivalent deployment descriptor. Dashboard configuration is therefore a required fact-finding step. If topology is unsafe or ambiguous, block Railway activation and continue local-only work.

## Workstream 5 — Text-first presence and deferred presentation

### V1 payload

V1 uses the proven text/activity subset:

- Railway: mood-appropriate single-line activity text and activity type through discord.js.
- Local RPC: existing details/state text pair, mood filtering, and current IPC activity fields.
- No new buttons, timestamps, party metadata, secrets, external assets, or Social SDK migration.

The same Discord application ID may remain shared because the Railway bot user and local desktop user are different user contexts. Each process remains a separate activity writer. A shared application does not make their activity state shared.

### Accepted visual limitation

The text-first release deliberately leaves current asset behavior unchanged. The known limitations are recorded and do not block v1:

- rich-presence.js references largeImageKey=skarn_logo, absent from the verified Portal inventory;
- the old cache contains stale small-image references, with the live count to be recomputed by the later audit;
- some cards may therefore show a blank or degraded image.

The later presentation phase will audit the current Portal inventory, repair or replace skarn_logo, quarantine stale active references, and add buttons/timestamps/assets one capability at a time. No v1 acceptance criterion may claim visual asset correctness.

Official Rich Presence documentation remains capability evidence, not an implementation contract. The installed discord-rpc and discord.js behavior must be tested before any later optional field is enabled.

## Security and operations

- V1 has no feature-specific HTTP listener, public status route, private status route, heartbeat route, or local-to-Railway network request.
- Do not add secrets for a synchronization feature that is disabled.
- Keep the bot database and JSON data off the public static-site service.
- Never print bot tokens, OpenAI keys, phrase text, message content, guild IDs, or user IDs in status output.
- Treat SSH commands as operator tools, not application communication.
- Keep Railway and local activity writers separate even though they share an application ID.
- On SIGTERM, stop rotation and maintenance timers, flush the latest bounded state/snapshot when safe, and disconnect cleanly.
- A failed maintenance run or snapshot write must not stop phrase rotation.
- A failed dataset replacement must not destroy the previous valid dataset.

## Implementation sequence

### Phase 0 — Preconditions

- Verify Railway service ID, source root/start command, volume mount, database path, replica count, and current healthcheck configuration through read-only dashboard/SSH inspection.
- Remove any required PORT healthcheck expectation if the service is to run with no HTTP listener.
- Confirm the Railway bot user and local RPC update different Discord user contexts.
- Create a reviewed baseline decision for data/railway-presence-phrases.json and its mounted destination.
- Confirm local process state is at 500 active entries, 2,000 archived entries, and 8,890 classifications.
- Record the accepted missing-logo/stale-asset limitation; do not gate text-first work on it.

### Phase 1 — Shared contract and validators

- Add data/presence-mood-contract.json.
- Add pure contract/state/dataset validators.
- Add local state persistence and Railway state helpers.
- Add injected clock/random/filesystem seams.
- Add tests and scripts/smokes/14-presence-mood.js to the existing smoke runner.

### Phase 2 — Railway dataset and coordinator

- Classify or explicitly review every legacy Railway string.
- Run representative and edge-case human review for every classifier batch.
- Stage, validate, and atomically install the independent Railway JSON dataset.
- Add Railway coordinator and single-writer cycler behind PRESENCE_MOOD_V2=false.
- Keep the legacy app_state value for rollback.

### Phase 3 — Railway runtime snapshot and SSH status

- Add the 60-second app_state runtime snapshot.
- Add npm run status:presence, including age/stale/degraded reporting.
- Verify status through the supplied railway ssh command.
- Confirm no HTTP listener is required by the Railway service configuration.

### Phase 4 — Enable Railway cycling

- Enable PRESENCE_MOOD_V2 in a controlled canary.
- Observe at least 12 consecutive 10-second slots.
- Confirm mood dwell, dormant sleep cycling, candidate counts, update failures, and snapshot freshness.
- Remove bot.js sleep activity writes in the same release that activates the single writer.
- Keep rollback flag and legacy pool until the observation window passes.

### Phase 5 — Local hardening and maintenance

- Enable persisted local mood windows.
- Verify restart resume, fallback, deterministic tests, and PM2/log diagnostics.
- Enable local 12-hour/50-entry bounded maintenance.
- Enable Railway 24-hour/50-entry bounded maintenance after its canary.
- Retain the prior dataset after any generation/classification failure.

### Phase 6 — Deferred presentation phase

- Run the asset inventory audit.
- Decide whether to upload/replace skarn_logo and how to handle stale active keys.
- Add one optional field at a time, starting with local verified assets/buttons/timestamps.
- Canary-test every optional Railway field independently.

### Phase 7 — Cleanup

- Remove the legacy Railway string-pool path only after rollback evidence exists.
- Keep the shared contract, validators, bounded maintenance, state files, runtime snapshot, and SSH status command permanently.
- Do not add synchronization modules unless a separate future specification is approved.

## Verification and acceptance criteria

### Contract and state

- Both processes load the same contract file and accept only the four canonical IDs.
- Both use the same sleep window, 10-minute dwell, 85/10/5 weights, and 10-second phrase cadence.
- Railway and local mood windows are independently persisted and independently rolled.
- A valid unexpired window resumes after restart; invalid state falls back safely.
- Different instantaneous moods are considered normal and are not an error.

### Railway cycling

- Railway cycles only the current mood's candidates when available.
- Dormant phrases continue cycling every 10 seconds during the command-sleep window.
- There is no competing bot.js activity writer.
- No more than one activity attempt occurs per 10-second slot.
- Failed updates do not create an unbounded retry queue.
- Railway continues with the previous valid dataset or safe fallback after maintenance failure.

### Local RPC

- Local IPC rotation continues without Railway, SSH, or network access.
- Local mood state is written atomically and remains bounded.
- Active pool never exceeds 500; archive never exceeds 2,000; the classification archive remains 8,890 entries unless separately reviewed.
- PM2/log diagnostics identify state, pool counts, mood, and degraded reasons without phrase text or secrets.

### Maintenance and data

- Local maintenance runs no more often than every 12 hours and generates no more than 50 entries per run.
- Railway maintenance runs no more often than every 24 hours and generates no more than 50 entries per run.
- Locks prevent overlapping workers.
- Failed generation, classification, validation, or atomic replacement retains the previous valid file.
- Every Railway legacy string is classified or explicitly reviewed before activation.
- Every classifier batch has representative sample and edge-case human review.
- Hard size, duplicate, mood-coverage, and schema violations block replacement.

### Operations

- status:presence runs successfully through Railway SSH and reports snapshot age.
- Runtime snapshot is written approximately every 60 seconds and becomes stale after 180 seconds.
- Snapshot write failure marks degraded but does not stop cycling.
- No feature-specific HTTP listener, status API, heartbeat, or synchronization call exists in v1.
- Unsafe or ambiguous Railway topology blocks Railway activation while local work may continue.
- The static-site service cannot access or serve Railway bot data.

### Presentation

- V1 is judged on text/activity reliability, not image correctness.
- The missing skarn_logo and stale icon references are visible in the known-limitations report.
- Buttons, timestamps, uploaded assets, and optional Railway fields are not required until the deferred presentation phase.

### Manual canary

1. Verify Railway topology and remove any incompatible HTTP healthcheck expectation.
2. Run npm run status:presence through Railway SSH and capture redacted output.
3. Deploy with PRESENCE_MOOD_V2=false and confirm legacy behavior.
4. Enable the flag and observe 12 consecutive activity slots.
5. Confirm phrases change approximately every 10 seconds while one mood window remains active for 10 minutes.
6. Cross-check Railway state through SSH and local state through PM2/logs; accept different instantaneous moods.
7. Enter the sleep window in staging and confirm dormant phrases continue cycling.
8. Stop or fail a maintenance worker and confirm the prior dataset remains active.
9. Restart each process and confirm its own valid mood window resumes.
10. Exercise the rollback flag and confirm legacy Railway activity returns without changing local state.

## Rollback matrix

| Failure | Immediate action | Data action | Follow-up |
|---|---|---|---|
| Railway activity errors or rate pressure | Disable PRESENCE_MOOD_V2 | Preserve staged JSON and legacy app_state | Inspect slot/update metrics before retry. |
| Invalid Railway dataset | Disable mood-aware mode | Restore previous validated dataset | Fix classification/review output and rerun validation. |
| Runtime snapshot failure | Continue cycling in degraded mode | Keep prior snapshot; do not append history | Inspect SQLite/path/volume health. |
| Maintenance worker failure | Abort current worker and release lock | Retain prior valid file | Wait for next cadence or run a reviewed manual retry. |
| Local state failure | Use local safe fallback | Preserve or quarantine invalid state file | Inspect atomic-write/path permissions. |
| Volume/path mismatch | Stop Railway migration/activation | Do not write to image-only path | Correct dashboard mount/bootstrap before retry. |
| Unsafe topology | Block Railway activation | Leave legacy state untouched | Separate/isolate services or document a proven safe configuration. |

## Files and interfaces

Expected implementation surfaces:

- skarn-bot/data/presence-mood-contract.json — shared static mood/timing/maintenance contract.
- skarn-bot/data/rpc-mood-state.json — local persisted mood window.
- skarn-bot/data/rpc-phrases.json — bounded local active/archive cache.
- skarn-bot/data/rpc-phrase-moods.json — local 8,890-entry classification archive.
- skarn-bot/data/railway-presence-phrases.json — independent Railway dataset.
- skarn-bot/features/presence/presenceMoodCoordinator.js — Railway mood state owner.
- skarn-bot/features/presence/presenceCycler.js — Railway 10-second activity writer.
- skarn-bot/rich-presence.js — local IPC activity writer and local phrase rotation.
- skarn-bot/bot.js — lifecycle wiring and removal of competing sleep activity writes.
- skarn-bot/scripts/migrate-railway-presence-phrases.js — full legacy migration.
- skarn-bot/scripts/generate-railway-presence.js — bounded Railway generation.
- skarn-bot/scripts/report-presence-state.js — redacted SSH operator report.
- skarn-bot/scripts/smokes/14-presence-mood.js — fake-based smoke suite.
- skarn-bot/scripts/run-smokes.js — smoke-suite registration.
- skarn-bot/package.json — validation, maintenance, status, and smoke commands.

Explicitly not part of v1:

- features/presence/presenceStatusServer.js;
- lib/rpcMoodSync.js;
- remote mood-read routes;
- heartbeat-write routes;
- server-clock offset and remote revision fields.

## Decision trace

| Decision | Reason |
|---|---|
| Shared contract with independent authorities | No remote sync is desired; claiming one live authority would be inaccurate. |
| One committed contract file | Prevents the two implementations from drifting on IDs, sleep, dwell, weights, or cadence. |
| Independent persisted windows | Restarts should resume each process's own mood without a network dependency. |
| Railway dormant phrase cycling | Preserves the requested 10-second bot cadence while keeping command sleep as a separate gate. |
| SSH-only diagnostics | The user has Railway SSH access and does not want a v1 HTTP/heartbeat surface. |
| 60-second Railway snapshot | A separate SSH process cannot read live in-memory metrics; a bounded snapshot provides recent evidence without per-slot SQLite writes. |
| Async locked maintenance | Generation/classification must not block or multiply the 10-second rotation. |
| Local 12-hour/50 and Railway 24-hour/50 | Preserves local behavior and limits Railway API/cost churn. |
| Full legacy classification/review | Avoids silently biasing the Railway pool toward observing. |
| Text-first presentation | Reliability work is independent of unresolved Portal assets and optional transport fields. |
| Known asset limitation accepted | The user explicitly chose to defer visual work, including skarn_logo and stale-key cleanup. |
| Topology is a read-only gate, not an automatic redesign | The user chose to document current Railway topology while refusing to activate an unsafe or ambiguous deployment. |
| Shared Discord application retained | The same application ID supports one Portal asset registry while bot/local user contexts remain separate. |

## Sources and confirmation notes

The following constraints were checked with Tavily against official documentation on 2026-09-04. They are platform evidence, not substitutes for an installed-library canary:

- Discord Gateway: https://docs.discord.com/developers/events/gateway — Gateway payloads must not exceed 4,096 bytes and sent events are rate-limited.
- Discord Gateway events: https://docs.discord.com/developers/events/gateway-events — presence activities expose details, state, timestamps, assets, party, secrets, and up to two buttons with documented bounds.
- Discord RPC: https://docs.discord.com/developers/topics/rpc — SET_ACTIVITY supports activity types including Playing, Listening, Watching, and Competing.
- Discord Rich Presence: https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence — timestamps, uploaded assets, field URLs, and up to two buttons are documented capabilities; uploaded asset keys are lowercased.
- Discord.js ClientUser: https://discord.js.org/docs/packages/discord.js/main/ClientUser:Class — the bot client exposes setActivity and setPresence; optional-field behavior must be tested on the actual bot path.
- Railway SSH: https://docs.railway.com/cli/ssh — railway ssh supports a single non-interactive command, which is the v1 operator path.
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks — Railway healthchecks use PORT and readiness responses; v1 intentionally chooses worker operation without an HTTP listener, so incompatible healthcheck configuration must be removed.
- Railway volumes: https://docs.railway.com/volumes/reference — volumes are persistent, each service has one volume, and replicas cannot be used with volumes.
- Railway variables: https://docs.railway.com/variables — service variables are the normal deployment configuration/secrets mechanism, though v1 adds no sync secrets.

Internal code/review evidence:

- skarn-bot/rich-presence.js currently owns local mood selection, bounded cache loading, and 10-second IPC rotation.
- skarn-bot/bot.js currently contains sleep/wake activity writes that would compete with a Railway cycler.
- skarn-bot/features/mood/moodManager.js owns per-guild conversational mood and is not presence mood.
- The independent review confirmed the absent Portal key skarn_logo, stale cache asset references, absent tracked Railway deployment descriptor, and the need for explicit migration/status/test seams.

## Implementation facts to record

These are operational values to record during Phase 0, not unresolved architecture decisions:

- actual Railway project, environment, service, and volume identifiers;
- actual bot service source root/start command and database path;
- whether the Railway dashboard currently has an HTTP healthcheck configured;
- actual Railway replica count and restart policy;
- reviewed Railway baseline storage location;
- exact local/railway process versions and current PM2 process name;
- the later Portal asset inventory and chosen logo key when Workstream 5 begins.
