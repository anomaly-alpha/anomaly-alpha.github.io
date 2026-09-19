# Skarn Warmaster Discord Rich Presence implementation plan

> Status: Ready for implementation
> Date: 2026-09-19
> Source specification: [docs/specs/2026-09-19/gpt-5.6-luna/skarn-warmaster-presence.md](../../specs/2026-09-19/gpt-5.6-luna/skarn-warmaster-presence.md)
> Research: internal research notes (not included in this repository)

> Owner decisions recorded: Toronto timezone applies to local skarn-rpc only; news renders as headline / reaction · age · source; high-salience promotion uses explicit source/topic/title rules; rss-parser is approved as an exact-pinned dependency; rollout is staged reliability → phrases/icons → news.

## Goal

Upgrade the local Skarn Discord Rich Presence into a reliable, compact signal engine that combines authored ambient phrases, semantic icons, and cached news from 15 approved official feeds. The service must publish truthful, readable two-line activities, avoid duplicate or overlapping IPC updates, degrade safely when Discord or feeds fail, and remain easy to tune through data files.

## Scope guard

This plan covers the local service at skarn-rpc and a local timezone override. It does not change the shared Railway bot contract or Railway runtime behavior. It does not change Discord application assets, the website, or unrelated modified files under .mimocode/. It does not add buttons, clickable links, Tavily runtime search, GDELT runtime search, party data, or user/guild/channel/message context in the first release.

## Current baseline

- The renderer is concentrated in skarn-rpc/rich-presence.js.
- The current rotation calls setActivity without awaiting its Promise and rotates every 10 seconds.
- The payload uses a fixed startTimestamp of 1000.
- Runtime catalog loading validates content but does not pass local icon keys into the validator; unknown icons are silently filtered after validation.
- Catalog verification is a separate script and currently passes with 5,000 phrases and 130 icons.
- The shared mood contract uses a fixed UTC offset for Railway; local skarn-rpc needs a separate America/Toronto override with daylight-saving handling.
- Logging appends indefinitely to skarn-rpc/data/rpc.log.
- package.json contains only discord-rpc and dotenv; there is no test framework or RSS/Atom parser.
- systemd runs one Node process from the repository's skarn-rpc directory and retries after process failure.
- skarn-bot also loads the shared mood contract and currently asserts the UTC-offset schema in its presence smoke tests; those consumers must remain unchanged and continue passing.

## Delivery strategy

| Phase | Outcome | Main files |
|---|---|---|
| P0 | Reproducible baseline and test seams | skarn-rpc/scripts, package.json |
| P1 | Reliable single-flight presence publisher | rich-presence.js, features/presence/activityPublisher.js |
| P2 | Runtime validation and Toronto sleep policy | presenceContract.js, sharedCatalogAdapter.js, contract JSON |
| P3 | Semantic icon and phrase policy | icon-registry.json, news-reactions.json, presence data |
| P4 | Cached RSS/Atom news pipeline | features/news, news-sources.json, news-state.json |
| P5 | Candidate arbitration and renderer integration | rich-presence.js, features/presence/candidateSelector.js |
| P6 | Verification and manual Discord QA | scripts, README, systemd unit checks |
| P7 | Controlled rollout and rollback | systemd user service, journal/log policy |

## P0 — Establish the baseline

### Tasks

1. Record the current service state and recent journal evidence without exposing environment files or credentials.
2. Run and preserve baseline results for:
   - node syntax checks on the current JavaScript files;
   - npm run verify:shared-catalog;
   - systemd-analyze verify on the user unit;
   - a mandatory short local fake-RPC smoke test through the new test seam.
3. Add a test command convention using Node's built-in assert module rather than introducing a framework.
4. Add deterministic fixtures under skarn-rpc/test-fixtures/ for valid activity payloads, malformed catalog entries, duplicate news items, future dates, redirects, and stale state.
5. Make the fake-RPC smoke test mandatory, not conditional, and add a test-only fixture injection path through SKARN_NEWS_FIXTURE_DIR; production startup must ignore that variable unless an explicit test mode is active.
6. Preflight the systemd IPC path and service user before rollout: verify /run/user/1000/snap.discord exists, is writable by the service, and still exposes a Discord IPC socket. If it fails, stop the rollout and do not broaden socket exposure.

### Exit criteria

- Baseline commands are documented in the plan handoff or README.
- Existing catalog verification still passes before feature work begins.
- The current Railway presence smoke tests remain unchanged and pass; local RPC smoke tests cover the new override.
- No production behavior changes in this phase.

## P1 — Make presence publication reliable

### P1.1 Extract a single-flight publisher

Create skarn-rpc/features/presence/activityPublisher.js with a small interface:

- publish(candidate): enqueue a candidate using latest-wins semantics;
- clear(): request a clear activity when a connected RPC client exists;
- setClient(rpc): attach or detach the connected client;
- disconnectClient(): detach and destroy the previous RPC client before retrying;
- getStatus(): expose connected, pending, lastPublishedHash, lastError, and lastPublishedAt.

Implementation rules:

- Await the Promise returned by discord-rpc setActivity.
- Permit only one in-flight request.
- Keep only the highest-priority/latest pending candidate while busy.
- Skip a candidate whose stable serialized payload hash equals the last published hash.
- Apply a bounded timeout to each request and record rejection without creating an unhandled Promise.
- Use a connection generation token so late resolutions from a timed-out or detached client cannot mutate current publisher state.
- Never publish buttons, party, secrets, or URL fields.

### P1.2 Refactor the renderer around the publisher

Update rich-presence.js so connection callbacks hand candidates to the publisher rather than calling setActivity directly. Preserve the current fallback phrases and shared-catalog loading behavior while the new publisher is introduced.

Keep internal connection state separate from visible Discord state. When IPC is disconnected, stop rotation, detach and destroy the old client, and record diagnostics; after reconnecting, publish a recovery or fallback candidate. Do not claim that Discord is absent in the Discord activity while the IPC channel itself is unavailable.

### P1.3 Correct timestamp handling

Add an integration fixture against the installed discord-rpc 4.0.1 wrapper. Verify the serialized value produced by a Date object and by a numeric timestamp. Use the wrapper-verified representation, or omit timestamps until the test passes. Replace the fixed epoch-like value only after this test exists.

### P1.4 Bound logging

Move logging into a small module or extend log with:

- structured event names and redacted fields;
- no raw article bodies, tokens, environment values, or credentials;
- a total log budget of 10 MB across the active file and one backup, or an equivalent journald-only policy;
- retention behavior documented in README.

### P1 tests

Add scripts/test-activity-publisher.js covering:

- latest-wins replacement while busy;
- identical payload suppression;
- one in-flight request at a time;
- timeout and rejection recovery;
- clear behavior when connected;
- no visible disconnect activity while disconnected;
- timestamp conversion fixture;
- structured log redaction and rotation boundary.
- detached-client late-response suppression and client-destroy behavior.

## P2 — Enforce runtime data correctness and Toronto sleep

### P2.1 Add a local Toronto policy without touching Railway

Leave skarn-bot/presence-assets/presence-mood-contract.json, the Railway presence loaders, and their UTC smoke tests unchanged. Add tracked skarn-rpc/config/presence-local.json with a local policy revision and timeZone: America/Toronto. The local loader merges only the local timezone/sleep override onto the shared mood weights and dwell values.

Update skarn-rpc/features/presence/presenceContract.js:

- preserve the canonical shared mood IDs, weights, dwell, and schema version;
- validate the local timeZone and policy revision;
- compute local hour with Intl.DateTimeFormat;
- calculate the next wake boundary across daylight-saving transitions with a bounded, DST-safe helper;
- keep the shared UTC contract path available for Railway and existing smoke tests.

Do not assume the old 01:00–07:00 UTC behavior is equivalent to Toronto time. Add fixtures around both DST transition directions and a regression test proving the Railway contract remains unchanged.

Invalidate persisted local mood state when the local policy revision changes. A revision mismatch must create a fresh mood window rather than reusing a state calculated under the old UTC-offset policy. Record the local migration in the skarn-rpc README and test it explicitly.

### P2.2 Make catalog validation authoritative at runtime

Update sharedCatalogAdapter.js and verify-shared-catalog.js:

- pass local icon keys into runtime validation;
- validate details, state, tooltips, and IDs by UTF-8 byte length using Buffer.byteLength;
- reject or quarantine unknown icon keys before candidate construction;
- preserve the safe fallback when the catalog is unavailable or produces no compatible entries;
- report validation counts without dumping phrase bodies.

Keep the build-time verifier strict at exactly 5,000 phrases and at least 500 entries per mood. Runtime behavior may degrade to fallback but must never emit an unvalidated icon or text payload.

### P2 tests

Add scripts/test-presence-contract.js covering:

- Toronto winter and summer offsets;
- DST spring-forward and fall-back boundaries;
- dormant and waking transitions;
- multibyte text at byte limits;
- unknown icon rejection;
- malformed, missing, and expired mood state;
- fallback selection when all catalog entries are incompatible.
- local policy-revision invalidation;
- unchanged shared UTC contract behavior for Railway consumers.

## P3 — Build the semantic content layer

### P3.1 Extend icon metadata

Extend data/icon-registry.json or add a companion data/icon-role-overrides.json with:

- role: attention, knowledge, movement, time, mood, or world;
- topic families such as science, space, AI, release, games, and general;
- news eligibility;
- human-readable tooltip label;
- ambiguity or tooltip-only flag where compact recognition is weak.

Use the existing theme values as the first classification pass, then manually review all 130 icons at compact size. Keep every asset eligible until explicitly demoted; do not silently lose icons.

### P3.2 Add deterministic reaction templates

Add a tracked data/news-reactions.json containing short, curated Skarn reactions by topic and salience. Do not call a model for first-release rendering. The factual headline remains source-derived; the reaction is selected from a bounded authored template set.

Define the news card before implementation: details is News plus a shortened factual headline; state is a shortened Skarn reaction plus age plus source. Preserve age and source over reaction wording when the 128-byte limit is reached, then preserve the reaction over the headline only after the headline has been reduced to a safe minimum. Store the full reaction and source label in candidate metadata for tests, but emit only the bounded two-line payload.

### P3.3 Add cooldown and similarity policy

Create features/presence/repetitionPolicy.js that tracks:

- recent phrase hashes;
- recent icon-topic pairs;
- recent normalized details/state strings;
- per-topic and per-icon cooldowns;
- a bounded in-memory history that resets safely on restart.

Use deterministic normalization and a simple similarity threshold before adding a dependency. The policy must reject near-duplicates while allowing a new story or system transition to override ambient cooldowns.

Define salience and confidence deterministically. Each source record supplies trust class and base priority; title/topic rules may promote a candidate to high salience. Confidence is the source trust plus parser/safety validity, and the selector compares salience first, then source priority, then publication freshness. No model score or opaque external ranking is required in the first release.

### P3 tests

Add scripts/test-content-policy.js covering:

- stable role-to-icon mapping;
- topic and salience selection;
- template length and byte validation;
- near-duplicate suppression;
- cooldown expiration;
- fallback when no eligible icon or reaction exists.

## P4 — Add the owner-only RSS/Atom news pipeline

### P4.1 Source configuration

Add tracked data/news-sources.json containing schemaVersion, enabled: false by default, pollIntervalMs, maxAgeMs, and exactly these initial feeds:

- NASA Breaking News: https://www.nasa.gov/news-release/feed/
- GitHub Changelog: https://github.blog/changelog/feed/
- OpenAI News: https://openai.com/news/rss.xml
- Rust Blog: https://blog.rust-lang.org/feed.xml
- PlayStation Blog: https://blog.playstation.com/feed

The current registry extends this initial five-feed canon with ten additional approved official sources; the tracked source file is authoritative.

Each source record should contain source ID, domain, feed URL, topic family, trust class, base priority, high-salience title/topic rules, enabled flag, poll interval, and maximum age. Add explicit negation rules to skarn-rpc/.gitignore so news-sources.json, news-reactions.json, and any tracked icon-role override file are not swallowed by data/*.

### P4.2 HTTP retrieval

Create features/news/feedClient.js using Node's built-in HTTPS client rather than fetch. Enforce:

- HTTPS only;
- explicit host allowlist;
- request timeout;
- maximum response bytes;
- content-type check;
- no automatic redirects, or revalidate every redirect destination against the allowlist;
- ETag and Last-Modified conditional requests;
- safe handling of 304, 4xx, 5xx, timeout, malformed XML, and oversized responses.

Do not send feed content to external services in the first release. Tavily and GDELT remain research/discovery tools, not a 10-second runtime dependency.

### P4.3 RSS/Atom parsing and normalization

Add rss-parser as the single RSS/Atom parser dependency with an exact version selected from the current registry after package-integrity checks and npm audit; install with an exact version and commit the resulting package-lock entry. Prefer parsing retrieved text in memory, not giving the parser arbitrary URLs. Do not install or use a second XML parser.

Create features/news/feedParser.js and normalize each item to:

- stable ID from Atom ID, RSS guid, or canonical URL fallback;
- sanitized title;
- canonical URL;
- source ID and display name;
- published and updated timestamps;
- fetched timestamp;
- topic and confidence;
- selected icon role;
- safety decision.

Reject missing/future timestamps, empty titles, invalid URLs, stale items older than six hours, duplicates, control characters, HTML, embedded instruction-like text, and fields over byte limits. Store no full article body.

### P4.4 Bounded state

Create features/news/newsState.js with an owner-only data/news-state.json runtime file, ignored by Git. Store no more than 50 normalized candidates plus validators and last poll outcomes. Write atomically, set owner-only permissions, and prune by age/count on every save. The tracked news-sources.json enabled field is the single feature flag: false is the safe default, and setting it true is the only rollout switch.

Create features/news/newsPoller.js with a slow independent poll loop, initially 15 minutes. The poller must be single-flight with bounded timeout, exponential backoff after failures, and a jittered retry that cannot overlap the next scheduled poll. It must not block Discord IPC connection handling and must expose last-success, last-error, stale, and candidate-count status to the renderer.

Write news-state.json atomically with mode 600 and ensure its parent data directory is mode 700 where the filesystem permits. Store only normalized titles, IDs, source metadata, timestamps, validators, safety decisions, and bounded diagnostics.

### P4 tests

Add scripts/test-news-pipeline.js using local fixture responses, not live feeds, covering:

- RSS and Atom parsing;
- stable ID and canonical URL deduplication;
- revisions through updated timestamps;
- ETag/Last-Modified and 304 behavior;
- future/missing/stale timestamps;
- redirect rejection;
- oversized or malformed responses;
- HTML, control-character, and instruction-like text stripping;
- byte-limit enforcement;
- atomic state writes, pruning to 150 items, and stale fallback.
- feature-disabled behavior and poller backoff/single-flight behavior.

## P5 — Integrate candidate arbitration and rendering

### P5.1 Candidate selector

Create features/presence/candidateSelector.js. Combine system, news, ambient, and quiet candidates using this priority:

1. connection recovery or service failure state;
2. high-salience fresh news from one trusted allowlisted source;
3. ordinary fresh news;
4. ambient mood phrase;
5. dormant/quiet fallback.

Use latest-wins semantics. A new high-priority story may interrupt ambient content. A news candidate receives the configured dwell unless superseded by a higher-confidence story. After dwell expiry, return to ambient content if no fresh candidate remains.

### P5.2 Activity rendering

Create features/presence/activityRenderer.js that maps candidates into the installed wrapper shape:

- stable largeImageKey: skarn_logo;
- largeImageText: Skarn Bot or the approved Warmaster label;
- details: factual short signal or authored ambient phrase;
- state: authored reaction plus age plus source for news, or authored reaction for ambient;
- smallImageKey and smallImageText from the validated icon role;
- verified timestamp representation only;
- no party, secrets, buttons, or URL fields.

Compute a stable hash from the complete emitted payload before passing it to activityPublisher.js.

### P5 tests

Add scripts/test-candidate-selector.js covering:

- news interrupting ambient content;
- configured news dwell;
- higher-confidence supersession;
- latest-wins replacement while publisher is busy;
- system recovery precedence;
- dormant mode using Toronto time;
- stale news returning to ambient fallback;
- feature flag false preventing feed polling and news emission;
- identical payload suppression.

## P6 — Verification and manual QA

### Automated checks

Add exact package scripts: test:activity -> scripts/test-activity-publisher.js; test:contract -> scripts/test-presence-contract.js; test:content -> scripts/test-content-policy.js; test:news -> scripts/test-news-pipeline.js; test:selector -> scripts/test-candidate-selector.js; test:all runs all five plus the Railway presence smoke suite; check runs node --check over every changed JavaScript file. Run:

- npm install with the lockfile updated and dependency audit completed;
- npm run verify:shared-catalog;
- npm run test:all;
- npm run check;
- skarn-bot's unchanged presence smoke tests;
- systemd-analyze verify ~/.config/systemd/user/skarn-rpc.service;
- git diff --check on all tracked changes.

### Manual Discord QA

With Discord Desktop running:

1. Verify ambient activity, stable large image, semantic small icon, and one-line text.
2. Run the test-only fixture mode using SKARN_NEWS_FIXTURE_DIR and verify the news interrupt, three-minute dwell, reaction/age/source state, and topic icon; never point production polling at fixture files.
3. Verify stale news falls back to ambient content.
4. Stop/restart Discord and verify the service reconnects without overlapping updates or stale rotation timers.
5. Test Toronto sleep behavior on both sides of a DST transition using fixture time injection; do not wait for a real overnight window.
6. Confirm no buttons, party badge, URL field, private context, or raw article body appears.
7. Confirm logs contain event metadata but no credentials, tokens, or uncontrolled feed text.

## P7 — Rollout and rollback

### Rollout

1. Implement and test P1–P3 with news-sources.json enabled: false.
2. Run the service in a controlled foreground session or temporary user-service override and confirm the existing Discord presence remains stable.
3. After local timezone tests and the unchanged Railway smoke tests pass, change only news-sources.json enabled to true and retain a versioned copy of the disabled configuration for rollback.
4. Restart the user service once, then monitor journal output and bounded runtime state for at least one full ambient dwell and one news poll cycle.
5. Confirm the service remains active, the news cache remains below 50 candidates, and the combined active log plus one backup remains below 10 MB.
6. Update skarn-rpc/README.md with feed ownership, commands, cache location, validation commands, and rollback instructions.

### Rollback

- Set news-sources.json enabled back to false and restart the service, preserving the reliable publisher and ambient phrase path.
- If the publisher regresses, stop the service, restore the previous renderer/data files from version control or the preserved worktree, and restart the user service.
- Keep the runtime cache and logs for diagnosis; do not expose or copy them externally.
- Re-run catalog verification and the existing service health check before declaring rollback complete.

## Files expected to change

### Existing files

- skarn-rpc/rich-presence.js — compose candidates, connect publisher, and manage lifecycle.
- skarn-rpc/features/presence/presenceContract.js — timezone-aware mood windows and contract validation.
- skarn-rpc/features/presence/presenceState.js — invalidate or migrate schema-version-1 mood state.
- skarn-rpc/features/presence/sharedCatalogAdapter.js — runtime icon and byte validation.
- skarn-rpc/scripts/verify-shared-catalog.js — align build-time and runtime validation assumptions.
- skarn-rpc/data/icon-registry.json or a new role override file — semantic icon metadata.
- skarn-rpc/.gitignore — allow tracked static news/reaction/icon-role data while keeping runtime state ignored.
- skarn-rpc/package.json and package-lock.json — test scripts and the pinned parser dependency, if required.
- skarn-rpc/README.md — runtime, feed, cache, verification, and rollback documentation.

### New files

- skarn-rpc/features/presence/activityPublisher.js
- skarn-rpc/features/presence/activityRenderer.js
- skarn-rpc/features/presence/candidateSelector.js
- skarn-rpc/features/presence/repetitionPolicy.js
- skarn-rpc/features/news/feedClient.js
- skarn-rpc/features/news/feedParser.js
- skarn-rpc/features/news/newsPoller.js
- skarn-rpc/features/news/newsState.js
- skarn-rpc/config/presence-local.json
- skarn-rpc/data/news-sources.json
- skarn-rpc/data/news-reactions.json
- skarn-rpc/test-fixtures/ and scripts/test-*.js files

Runtime-only files under skarn-rpc/data/:

- news-state.json
- bounded rpc.log and its single rotated backup, if file logging remains enabled

## Definition of done

- Ambient, news, system, dormant, and fallback candidates all render through one validated activity path.
- Discord IPC updates are awaited, single-flight, latest-wins, deduplicated, timeout-bounded, and rejection-safe.
- Detached or timed-out RPC clients cannot publish late results into a newer connection generation.
- Toronto timezone and DST behavior are covered by deterministic tests.
- Local timezone override and policy-revision migration pass deterministic tests while the unchanged Railway contract and smoke tests continue to pass.
- Runtime catalog and news validation enforce UTF-8 byte limits and known icon keys.
- Static news configuration is tracked, runtime news state is ignored and owner-only, and enabled: false is a tested safe default.
- The 15 approved feeds are fetched only through an immutable allowlisted, bounded, conditional HTTPS path.
- News state is sanitized, deduplicated, age-limited to six hours, capped at 150 candidates, and stored owner-only.
- High-salience news is determined by explicit source/topic rules, may publish from one trusted source, and always displays reaction, source, and age within the two-line byte limits.
- No buttons, links, party data, secrets, private context, or raw article bodies are emitted.
- Runtime logs are bounded and redacted.
- Existing catalog verification, new tests, syntax checks, and systemd verification pass.
- Manual Discord QA confirms readable one-line fields, semantic icons, configured news dwell, graceful fallback, and recovery after Discord restarts.
- README and rollback instructions are current.
