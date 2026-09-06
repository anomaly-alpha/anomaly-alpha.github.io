# Skarn Status Presence Parity

Status: Implemented locally; Railway canary pending
Date: 2026-09-06
Service: skarn-bot/
Specification: ../../../specs/2026-09-06/gpt-5/skarn-status-presence-parity.md
Railway handoff: ../../../../../docs/handoffs/2026-09-06/gpt-5/railway-skarn-database.md

This plan replaces the earlier SQLite-backed plan. It intentionally contains no phrase database, migration, archive, replenishment worker, runtime snapshot, database status command, hot reload, or PRESENCE_MOOD_V2 flag.

## 1. Delivery target

Deliver one tracked JSON catalog consumed by both skarn-bot and skarn-rpc:

    skarn-bot/presence-assets/presence-phrases.json

The catalog contains exactly 5,000 entries and at least 500 entries for each mood. The Railway bot loads it at startup and writes one global Watching activity approximately every ten seconds. The local RPC reads the same file through a compatibility adapter and keeps its existing visible behavior.

The bot and RPC keep independent mood state, timers, and renderers. They share content and the mood/timing contract only.

## 2. Fixed decisions from the grill

- Use skarn-bot/presence-assets/presence-phrases.json as the single tracked catalog.
- Use the canonical shared contract at skarn-bot/presence-assets/presence-mood-contract.json and remove the old data copy.
- Consume the catalog from both skarn-bot and skarn-rpc.
- Catalog entries contain id, text, mood, optional symbol, rpcDetails, rpcState, and required rpcIconKey.
- Import current RPC active and archived phrase data first, then generate replacements until the catalog reaches 5,000 entries.
- Map legacy details to bot text and rpcDetails; preserve legacy state and icon metadata where valid.
- Reject incomplete legacy mood/icon metadata and generate replacements rather than guessing.
- Direct provider moderation is allowed only in the local operator-run generator; the running bot and RPC make no provider calls for presence.
- Local provider limits are operator-managed with no non-bypassable global spend ceiling; this is an explicit accepted risk.
- Any provider/moderation failure rejects the complete generated file and leaves the previous file unchanged.
- Future updates are complete-file reconciliations, not incremental database batches.
- The catalog is deployed through normal Git deployment and loaded after restart; no remote volume upload or hot reload.
- Make JSON cycling the default bot path and remove the old app_state phrase pool/AI regeneration path.
- Bot symbols are optional and are rendered only when present.
- Keep one in-flight Discord update, a five-second timeout, 30-second first-rejection suppression, 120-second repeated-pressure/disconnect suppression, and no overlapping fire-and-forget calls.
- One bot instance runs on Railway.
- A focused local smoke suite plus a 15-minute Railway canary is the launch gate.

## 3. Existing implementation points

- skarn-bot/features/presence/presenceContract.js currently reads the contract from skarn-bot/data; point it to presence-assets.
- skarn-bot/features/presence/railwayPresenceDataset.js currently reads a missing Railway JSON dataset with 300-entry defaults; repurpose it as the shared catalog loader/validator.
- skarn-bot/features/presence/presenceMoodCoordinator.js already persists skarn_presence_mood in app_state; retain that small existing mood-state behavior.
- skarn-bot/features/presence/presenceMoodCycler.js already filters by mood and writes activity type 3; add shuffled in-memory decks, formatting, rejection gating, and promise handling.
- skarn-bot/features/presence/presenceCycler.js currently owns legacy app_state generation and flag-gated mood-v2; replace it with the JSON-default owner.
- skarn-bot/bot.js currently has a second sleep activity writer; remove only those ambient activity writes and preserve command sleep state/logging.
- skarn-rpc/rich-presence.js currently loads rpc-phrases.json and rpc-phrase-moods.json, maintains its current timers/artwork, and expects details/state/icon fields; adapt its loader without changing visible operation.
- skarn-rpc/features/presence/presenceContract.js currently points to skarn-bot/data; update it to the canonical contract path.

## 4. File changes

Create:

- skarn-bot/presence-assets/presence-phrases.json — generated and tracked 5,000-entry catalog.
- skarn-bot/presence-assets/presence-mood-contract.json — canonical shared contract.
- skarn-bot/presence-assets/railway-symbol-palette.json — fixed 16–32-symbol bot palette.
- skarn-bot/scripts/generate-presence-phrases.js — local initial generator and complete-file updater.
- skarn-bot/features/presence/presenceUpdateGate.js — fake-clock-testable one-in-flight/rejection gate.
- skarn-rpc/features/presence/sharedCatalogAdapter.js — maps shared entries to the existing RPC internal shape.
- skarn-rpc/scripts/verify-shared-catalog.js — read-only RPC catalog compatibility check.

Modify:

- skarn-bot/features/presence/presenceContract.js — canonical contract path.
- skarn-bot/features/presence/railwayPresenceDataset.js — shared catalog path and full schema validator.
- skarn-bot/features/presence/presenceMoodCycler.js — in-memory mood decks, optional-symbol formatting, one-in-flight gate, five-second timeout, and static fallback.
- skarn-bot/features/presence/presenceCycler.js — JSON-default startup; remove legacy app_state pool, AI regeneration, and PRESENCE_MOOD_V2 branching.
- skarn-bot/features/presence/presenceMoodCoordinator.js — retain only current mood-window persistence and restart behavior.
- skarn-bot/bot.js — remove sleep-mode setActivity calls; retain isAsleep command admission and logs.
- skarn-bot/features/scheduler/index.js — keep one presence startup and add no maintenance worker.
- skarn-rpc/features/presence/presenceContract.js — canonical contract path.
- skarn-rpc/rich-presence.js — load the shared catalog through the adapter while preserving current IPC/timer/artwork behavior.
- skarn-bot/package.json — generator, validator, and smoke commands.
- skarn-rpc/package.json — shared-catalog verification command.
- skarn-bot/README.md, skarn-bot/docs/ARCHITECTURE.md, and skarn-bot/docs/DATABASE.md — document static JSON ownership and state that no presence database tables are added.

Update or retire:

- skarn-bot/scripts/smokes/15-railway-presence.js — test the shared JSON catalog and bot cycler instead of the obsolete migration manifest.
- skarn-bot/scripts/migrate-railway-presence-phrases.js — retire after its legacy review output is no longer needed.
- skarn-bot/data/presence-mood-contract.json — remove after both loaders use presence-assets.
- skarn-rpc/data/rpc-phrases.json and skarn-rpc/data/rpc-phrase-moods.json — use only as initial-generation input, then remove from runtime use.

Do not modify db/skarn-schema.sql, db/migrations.js, scripts/backup-db.js, or add presence app_state snapshots. Existing general bot database behavior is outside this feature.

## 5. Catalog schema and generator

The root envelope is:

    {
      "schemaVersion": 1,
      "generatedAt": "2026-09-06T00:00:00.000Z",
      "generatorVersion": "presence-generator-1",
      "phrases": []
    }

Each entry has:

    {
      "id": "railway-0001",
      "text": "mortals invent urgency",
      "mood": "observing",
      "symbol": "👁",
      "rpcDetails": "mortals invent urgency",
      "rpcState": "Will bends, never breaks",
      "rpcIconKey": "skarn_eye"
    }

Validation must enforce exactly 5,000 entries, 500 per mood minimum, unique IDs/text, normalized one-line strings, text length including optional bot symbol within the activity limit, valid four-mood IDs, optional symbols from the fixed palette, required RPC fields, valid icon keys from skarn-rpc/data/icon-registry.json, and absence of user/guild/message/prompt/search/memory/secrets.

The generator workflow is:

1. Load current skarn-rpc/data/rpc-phrases.json active entries and archive plus skarn-rpc/data/rpc-phrase-moods.json.
2. Preserve valid legacy details, state, mood, and icon values using the agreed field mapping.
3. Reject legacy entries with incomplete mood/icon metadata.
4. Generate only the missing entries needed to reach 5,000, using local direct provider calls and no user-derived context.
5. Assign new rpcIconKey values deterministically from the real RPC icon registry; the provider never invents asset names.
6. Run schema, deduplication, palette, icon, and direct moderation gates over the complete result.
7. On any failure, leave the existing JSON file untouched and return non-zero.
8. Write the result through a temporary file and atomic rename.

The generator may expose operator-selected batch/count/token settings, but there is no hard global spend ceiling by explicit decision. It must display progress and errors without logging credentials or unnecessary phrase payloads.

Recommended commands from skarn-bot/:

    node scripts/generate-presence-phrases.js --import-rpc --count=5000 --write
    node scripts/generate-presence-phrases.js --check

The exact argument parser may vary, but write mode must be explicit and check mode must never call the provider or modify files.

## 6. Bot runtime behavior

At clientReady, start exactly one JSON-backed presence cycler. It loads the contract and catalog once, initializes the coordinator from skarn_presence_mood, selects the current mood, writes an initial Watching activity, and schedules a ten-second interval.

Each cycle performs only local selection and, when permitted, one Discord activity attempt. It must not call AI, read URLs, query a database for phrases, or perform file reload work. Build one shuffled deck per mood at startup, reshuffle after exhaustion, and avoid immediate repeats when a mood has more than one entry.

Format output as symbol plus text when symbol is present and text otherwise. Call client.user.setActivity(formatted, { type: 3 }). The bot ignores rpcDetails, rpcState, and rpcIconKey.

The writer has one in-flight promise. A pending attempt times out after five seconds. A first rejection starts 30 seconds of outbound suppression; repeated rejection or correlated disconnect starts 120 seconds. The scheduler continues ticking while suppressed and sends one probe after the window. One healthy 15-minute interval clears one suppression level. Rejected promises and synchronous errors update counters/logs without causing a retry loop.

During 01:00–07:00 UTC, the coordinator selects dormant phrases and command handling remains asleep. bot.js no longer writes a competing sleep activity. If the catalog is missing or invalid, log one configuration error and use a static Watching fallback without crashing the bot.

Manual catalog changes require a Git deploy and process restart. Hot reload is explicitly deferred.

## 7. RPC compatibility behavior

The adapter reads the shared entries and exposes the fields the current RPC renderer expects:

- rpcDetails becomes details;
- rpcState becomes state;
- rpcIconKey becomes the existing small-image key;
- mood and id retain their current selection/identity roles.

Do not change the RPC’s IPC connection, artwork, timers, mood state, or visible layout. The RPC keeps its existing large image and asset behavior. If an icon key is missing at runtime, the RPC skips that entry or uses its existing fallback; the bot continues using text.

The old RPC phrase files are migration input only. Once the shared catalog is committed and verified, they are removed from runtime use. icon-registry.json, rpc-mood-state.json, and rpc.log remain local RPC-owned files.

## 8. Railway deployment

The Railway handoff identifies project cozy-miracle, production environment, service anomaly-alpha.github.io, service root /skarn-bot, volume mount /app/data, and one running bot instance.

Before the canary:

1. Run railway whoami and confirm the intended authenticated account.
2. Run read-only service status and log commands for anomaly-alpha.github.io in production.
3. Confirm the service root is /skarn-bot and exactly one bot instance is running.
4. Confirm presence-assets is outside /app/data and is included in the deployed service.
5. Deploy only through the normal Git path; do not use railway up or copy the JSON into the volume.
6. Restart the bot if the deployment does not restart it automatically.

The public Railway domain may return HTTP 502 because this Discord-only worker does not listen on port 8080. This is not a presence failure and does not justify adding an HTTP server.

## 9. Verification

Automated checks:

- contract and catalog schema validation;
- exact 5,000 count and 500-per-mood floors;
- invalid field, duplicate, symbol, icon, and forbidden-content rejection;
- import of existing RPC active/archive entries and replacement generation for incomplete metadata;
- atomic-write failure preservation;
- fake-clock mood selection, shuffle/no-repeat behavior, optional-symbol formatting, and static fallback;
- one-in-flight update, five-second timeout, 30/120-second suppression, probe, healthy recovery, and rejected-promise handling;
- no provider call from runtime rotation;
- no bot sleep-timer activity writer;
- RPC adapter mapping and icon-key compatibility;
- both runtimes reading the same file with independent runtime state.

Run from skarn-bot/ after dependencies are installed:

    node --check features/presence/presenceContract.js
    node --check features/presence/railwayPresenceDataset.js
    node --check features/presence/presenceUpdateGate.js
    node --check features/presence/presenceMoodCycler.js
    node --check features/presence/presenceCycler.js
    node --check ../skarn-rpc/features/presence/sharedCatalogAdapter.js
    node scripts/smokes/15-railway-presence.js
    npm run smoke
    npm run audit:gate
    npm run audit:docs

Run from skarn-rpc/:

    node --check features/presence/presenceContract.js
    node --check features/presence/sharedCatalogAdapter.js
    node scripts/verify-shared-catalog.js

Manual canary:

- observe at least 15 minutes of Railway status changes;
- confirm approximate ten-second updates when not suppressed;
- confirm no duplicate writer and stable Discord connection;
- test dormant sleep behavior and command sleep gate;
- start local Discord and confirm unchanged RPC artwork/details/state behavior;
- inspect startup summaries, one-minute counters, errors, and IDs without logging full phrase payloads.

## 10. Rollback

Rollback is a normal Git redeploy:

1. Redeploy the previous known-good commit or revert the catalog/code commit.
2. Restart the Railway bot if required.
3. Confirm the previous status behavior in logs and Discord.

No database restore, volume mutation, or feature-flag change is needed because this feature does not change database state. Git history provides prior complete catalog versions.

## 11. Release blockers and explicit risks

- The shared assets must not live under /app/data.
- The bot must have exactly one ambient activity writer and one Railway bot instance.
- Runtime rotation must never call the provider or overlap outbound activity promises.
- Invalid catalog/provider results must leave the prior tracked file unchanged and use static fallback at runtime.
- Direct provider moderation is local-only and has no hard global spend ceiling by explicit operator decision.
- There is no phrase archive or production database backup gate by explicit scope decision.
- The RPC must not be changed to claim Gateway support for application Rich Presence asset fields.

## 12. Definition of done

Done means the shared 5,000-entry JSON catalog is validated, tracked, consumed by both runtimes, deployed through Git, and observed in a 15-minute Railway canary. The bot cycles mood-valid Watching text every ten seconds on a best-effort basis, sleeps correctly, falls back safely, has one writer, and makes no runtime provider calls. The RPC retains its existing visible behavior through the adapter. No database presence artifacts or discarded SQLite architecture remain in the implementation or documentation.
