# Skarn Status Presence Parity

Status: Implemented locally; Railway canary pending
Date: 2026-09-06
Scope: Make the Railway Skarn bot visibly cycle like the local Skarn RPC while preserving the RPC's existing behavior.
Related baseline: skarn-bot/docs/specs/2026-09-04/gpt-5/skarn-presence-upgrade-program.md
Implementation plan: ../../../plans/2026-09-06/gpt-5/skarn-status-presence-parity.md
Railway handoff: ../../../../../docs/handoffs/2026-09-06/gpt-5/railway-skarn-database.md

This document supersedes the earlier database-backed parity addendum for launch. SQLite phrase tables, phrase archives, automatic replenishment, runtime snapshots, database status tooling, hot reload, and a rollout feature flag are not part of this version.

## 1. Decision summary

Ship one static, reviewed phrase catalog at skarn-bot/presence-assets/presence-phrases.json.

- skarn-bot and skarn-rpc both read this repository file.
- Each runtime keeps its own mood state, timer, and renderer.
- The bot loads the catalog at startup and cycles one global Watching activity every ten seconds.
- The RPC keeps its current IPC rotation, artwork, and display behavior; only its catalog loader maps shared fields into its existing runtime shape.
- The initial catalog contains exactly 5,000 valid entries, with at least 500 entries per mood.
- Existing RPC active and archived phrase data seeds the initial catalog; the local generator creates the remainder.
- Future updates regenerate the complete file, validate it, commit it to Git, deploy normally, and restart the bot.
- The bot makes no provider call during startup validation, mood selection, or ten-second rotation.
- Missing or invalid catalog data produces one explicit error and a safe static fallback in that process.
- True Discord Rich Presence artwork remains an RPC-only capability. Bot Gateway activity does not receive smallImageKey or largeImageKey.

## 2. What parity means

| Capability | Local RPC | Railway bot target |
|---|---|---|
| Content source | Shared JSON catalog | Same shared JSON catalog |
| Mood vocabulary | dormant, observing, pondering, displeased | Same four moods |
| Mood dwell | Ten minutes | Ten minutes |
| Phrase cadence | Ten seconds | Ten seconds |
| Phrase selection | Existing RPC behavior | Mood-filtered shuffled deck, no immediate repeat when possible |
| Phrase scale | Shared 5,000-entry catalog | Shared 5,000-entry catalog |
| Custom artwork | Existing local application assets | Not supported by Gateway activity |
| Bot visual marker | Not required by RPC | Optional curated Unicode symbol in text |
| Runtime state | Existing local RPC state | Existing bot mood state only; no new presence tables |
| Update behavior | Existing RPC behavior | One in-flight Gateway update with rejection cooldown |

Parity means shared phrase content, mood vocabulary, and timing policy. It does not mean both processes show the same phrase or mood at the same instant.

## 3. Product behavior

During normal hours, users see changing global bot activity such as:

    Watching: 👁 mortals invent urgency
    Watching: old patterns return
    Watching: patience is a finite resource

The bot uses Discord activity type 3, Watching. If an entry has a symbol, the bot prefixes it; if symbol is null, the bot uses text without a symbol. The final one-line activity must remain within the validated length limit.

During the 01:00–07:00 UTC sleep window, the bot selects dormant entries while the existing command sleep gate remains active. The sleep timer may update internal isAsleep state and logs, but must not call setActivity. The presence owner remains the only bot activity writer.

The RPC continues to show its current large image, small image, details, state, and local IPC behavior. The shared file supplies compatible content and icon keys; it does not make the bot an application Rich Presence client.

## 4. Shared catalog

### 4.1 Ownership and location

The single tracked content source is:

    skarn-bot/presence-assets/presence-phrases.json

The shared mood/timing policy remains:

    skarn-bot/presence-assets/presence-mood-contract.json

Both files are immutable deployment inputs. The old skarn-bot/data/presence-mood-contract.json copy is removed, and both loaders read the canonical asset path. The Railway volume at /app/data is reserved for unrelated mutable bot data and must not contain the phrase catalog.

### 4.2 JSON shape

The catalog uses a small metadata envelope. It deliberately has no catalog hash; the Git commit containing the file is the deployment identity.

    {
      "schemaVersion": 1,
      "generatedAt": "2026-09-06T00:00:00.000Z",
      "generatorVersion": "presence-generator-1",
      "phrases": [
        {
          "id": "railway-0001",
          "text": "mortals invent urgency",
          "mood": "observing",
          "symbol": "👁",
          "rpcDetails": "mortals invent urgency",
          "rpcState": "Will bends, never breaks",
          "rpcIconKey": "skarn_eye"
        }
      ]
    }

Required entry rules:

- id is stable, unique, and safe for logs.
- text is normalized, one line, non-empty, and no longer than 128 characters.
- mood is exactly dormant, observing, pondering, or displeased.
- symbol is optional and, when present, belongs to the fixed 16–32-symbol bot palette.
- rpcDetails and rpcState are required, normalized, one-line RPC display strings.
- rpcIconKey is required and must exist in skarn-rpc/data/icon-registry.json at generation time.
- Normalized text and IDs are unique across the complete file.
- No field contains user IDs, guild IDs, channel IDs, message content, prompts, search results, memory, secrets, or deployment identifiers.
- The file contains exactly 5,000 entries at launch and at least 500 entries in each mood, including dormant.
- There is no runtime archive. Previous complete catalog versions are recoverable through Git history.

### 4.3 Initial generation and manual updates

The local generator starts from the current RPC data:

- import eligible entries from skarn-rpc/data/rpc-phrases.json active data and archive;
- use skarn-rpc/data/rpc-phrase-moods.json classification where valid;
- map legacy details to shared text and rpcDetails;
- map legacy state to rpcState;
- map the legacy icon key to rpcIconKey;
- create a stable id when legacy data does not provide one;
- reject legacy entries missing valid mood or icon metadata and generate replacements;
- generate only the remainder needed to reach 5,000 entries;
- enforce the 500-per-mood floors after import and generation.

The generator runs only when an operator invokes it locally. Direct provider calls are allowed only in this generator. It receives persona/style instructions, allowed moods, the symbol palette, the actual RPC icon-key allowlist, and phrase signatures. It never receives Discord or user-derived data.

The operator knowingly accepts no non-bypassable global local provider spend ceiling. The command must display requested count, batch progress, provider errors, and elapsed time; it must never print credentials or unnecessary phrase payloads.

Each generated batch is validated before inclusion. If generation or automated moderation fails, times out, or returns an ambiguous result, the complete new catalog is rejected and the previous JSON file remains unchanged. The final file is written through a temporary file and atomic rename. No partial catalog is allowed.

Automated gates are deterministic schema, length, deduplication, palette, and icon checks plus direct provider moderation. A failed moderation result fails the complete generation run. No human sign-off is required.

## 5. Runtime design

### 5.1 Bot

- presenceContract.js loads presence-assets/presence-mood-contract.json.
- railwayPresenceDataset.js loads and validates presence-assets/presence-phrases.json.
- presenceMoodCoordinator.js continues using the existing skarn_presence_mood app_state value for the current ten-minute mood window. No new table or snapshot key is added.
- presenceMoodCycler.js builds mood-filtered shuffled decks in memory at startup, avoids immediate repeats when possible, and selects locally every ten seconds.
- presenceCycler.js becomes the single default JSON owner and no longer uses the old app_state phrase pool or AI regeneration path.
- bot.js removes the sleep timer's ambient activity writes while preserving command sleep state and logging.

The activity writer formats symbol plus text when a symbol exists and text otherwise, then calls client.user.setActivity(formatted, { type: 3 }). Presence text is not a message body and must not contain mention syntax.

The scheduler continues ticking every ten seconds, but the writer permits only one in-flight Discord attempt. A pending attempt has a fixed five-second timeout. A first rejection suppresses outbound writes for 30 seconds; repeated rejection or disconnect correlation suppresses them for 120 seconds. The scheduler still ticks during suppression and probes once when the window ends. One healthy 15-minute window clears one suppression level. No retry loop or overlapping fire-and-forget calls are permitted.

The bot loads the file at startup. A manual file update requires restart/redeploy; hot reload is deferred. If the file is missing or invalid, the bot logs one explicit configuration error, disables cycling for that process, and uses a safe static Watching fallback. The bot remains available.

The JSON cycler is the default path; PRESENCE_MOOD_V2 is removed. Rollback is a Git redeploy, not an environment toggle.

### 5.2 RPC

The RPC keeps its current activity loop, timers, IPC calls, artwork, local mood state, and fallback behavior. Its loader is adapted to read the shared catalog and map:

- shared rpcDetails to RPC details;
- shared rpcState to RPC state;
- shared rpcIconKey to the RPC small-image key;
- shared mood to existing mood classification/selection;
- shared id to stable internal identity.

After the first shared catalog is generated and verified, rpc-phrases.json and rpc-phrase-moods.json are removed from runtime use. icon-registry.json, rpc-mood-state.json, and the RPC log remain RPC-owned.

If one shared entry references an icon key missing from the local registry, the RPC skips that entry or uses its existing per-entry fallback; the bot continues using the entry text. Generation validation should catch this before deployment.

### 5.3 Process boundary

The shared JSON contains RPC-compatible metadata because one content source is required, but the Railway bot never interprets rpcIconKey as a Gateway asset. No RPC token, filesystem path, process state, or live IPC data is sent to Railway.

## 6. Railway deployment and CLI boundary

The Railway handoff records project cozy-miracle, production environment, service anomaly-alpha.github.io, service root /skarn-bot, persistent volume /app/data, and one bot instance.

Use railway whoami and read-only service status/log commands before a canary. If name-based selection fails, use the recorded project/environment/service UUIDs in the installed CLI. The normal rollout is a Git commit/push containing the tracked JSON and code, followed by a controlled restart if the deployment does not restart automatically.

The public Railway domain may return HTTP 502 because this Discord-only service does not listen on port 8080. Do not add an HTTP health server for this feature. No volume upload, railway up, remote JSON replacement, schema migration, seed apply, or database backup is part of this JSON-only launch.

## 7. Verification plan

### Automated

- Validate the canonical contract and shared JSON envelope.
- Validate exactly 5,000 entries and at least 500 entries per mood.
- Reject duplicate IDs/text, multiline or overlong fields, invalid moods, unsupported symbols, missing RPC fields, unknown icon keys, and forbidden user-derived content.
- Verify the generator imports current RPC active/archive data, rejects incomplete legacy metadata, fills the remainder, and writes atomically.
- Force provider/moderation failure and prove the previous JSON remains unchanged.
- Use a fake clock to prove one ten-second scheduler slot, mood filtering, no immediate repeat when possible, optional-symbol formatting, and no provider call from runtime rotation.
- Prove one in-flight update, five-second timeout, 30/120-second suppression, one probe after suppression, healthy recovery, and rejected-promise handling.
- Prove missing/invalid catalog uses static fallback and does not crash the process.
- Prove bot sleep handling no longer writes ambient activity.
- Prove the RPC adapter maps all shared RPC fields without changing its renderer contract.
- Prove both runtimes load the same tracked file while retaining independent mood/runtime state.

### Manual canary

1. Run railway whoami and confirm the intended account.
2. Confirm the linked service is anomaly-alpha.github.io, root is /skarn-bot, and exactly one bot instance is running.
3. Deploy the Git commit containing the canonical contract, shared catalog, loader changes, and bot writer changes.
4. Restart if necessary and inspect Railway logs for catalog count, mood floors, JSON path, fallback status, and writer initialization.
5. Observe at least 15 minutes of status changes. Confirm approximately ten-second updates when not suppressed, no duplicate writer, and connection stability.
6. Test the sleep window or a fake-clock equivalent: dormant phrases rotate and commands remain asleep.
7. Start Discord and the local RPC separately and confirm existing artwork/details/state behavior remains intact.
8. Inspect startup summaries, periodic counters, errors, and IDs; do not log full phrase payloads.

## 8. Rollback

Because the feature changes tracked code/assets but not database state:

1. Redeploy the previous known-good Git commit or revert the catalog/code commit.
2. Restart the Railway bot if required.
3. Confirm previous status behavior in Railway logs and Discord.
4. If only the catalog is bad, restore the previous JSON from Git and redeploy.

No database restore, feature-flag toggle, or volume mutation is required.

## 9. Risks and explicit exceptions

- Direct provider moderation is an explicit local-only exception; Railway runtime never calls the provider for presence.
- The operator knowingly accepts no hard local provider spend ceiling. Progress/errors are visible and credentials are never logged.
- There is no SQLite phrase archive or production database backup gate because this feature does not change database state. Git history is the rollback mechanism.
- Assets under skarn-bot/data could be hidden by the Railway volume; shared assets remain under presence-assets.
- Unknown RPC icon keys are RPC-entry failures, not bot-catalog failures.
- Ten-second cadence is best effort; the scheduler clock is fixed, but writes may be suppressed after pressure or connection errors.
- The bot must never claim support for RPC application asset fields.

## 10. Acceptance criteria

- presence-phrases.json is tracked under skarn-bot/presence-assets and readable by both runtimes.
- The catalog contains exactly 5,000 valid entries and at least 500 entries in each mood.
- Every entry has valid bot text, mood, required RPC details/state/icon key, and optional approved symbol.
- The bot loads the catalog at startup and shows a global Watching activity every ten seconds under normal conditions.
- The bot has one ambient activity writer and the sleep timer cannot override it.
- The bot selects current-mood phrases, rotates dormant phrases during sleep, and keeps command sleep behavior.
- An invalid catalog produces an explicit error and static fallback without crashing the bot.
- Provider generation/moderation is absent from runtime rotation.
- RPC visible operation remains unchanged through its adapter.
- Manual updates are full-file, automated-gated, atomic, Git-tracked, and restart-based.
- A 15-minute Railway canary confirms connection stability, approximate ten-second updates, and no duplicate writer.
- No presence phrase table, migration, archive, replenishment worker, runtime snapshot, database status command, hot reload, or PRESENCE_MOOD_V2 flag is added.
