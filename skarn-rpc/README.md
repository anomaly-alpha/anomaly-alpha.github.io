# Skarn RPC

The local desktop Rich Presence publisher. This is a separate service from the Railway Discord bot.

## Runtime

Run from this directory with `npm install` followed by `npm start`. The RPC reads the tracked shared catalog at `../skarn-bot/presence-assets/presence-phrases.json` through `features/presence/sharedCatalogAdapter.js`. The adapter is read-only and maps shared RPC details, state, icon key, mood, and ID into the existing renderer shape.

The RPC retains local Discord IPC, artwork, timers, and mood state. Its local `data/icon-registry.json`, `data/rpc-mood-state.json`, and log remain RPC-owned; the shared phrase catalog is not copied into `data/`, uploaded to Railway, or stored in the bot database. The bot's Gateway Watching activity uses only shared text and cannot display the RPC artwork fields.

The local policy in config/presence-local.json overlays only sleep timing onto the shared mood contract. It uses America/Toronto wall-clock time with DST-aware wake calculation and a policy revision. When that revision or the state schema changes, the loader discards the persisted local mood window and starts a fresh one; the Railway bot continues to consume the unchanged UTC contract.

Commands:

    npm start                    # publish the local Rich Presence
    npm run verify:shared-catalog # validate shared fields and icon compatibility
    npm run test:all              # focused local tests plus the unchanged Railway presence smoke suite
    npm run check                 # syntax-check changed service and test modules
    npm audit --omit=dev          # audit production dependencies

The shared catalog is generated and checked from `skarn-bot/` with `npm run generate:presence` and `npm run check:presence`. Legacy RPC phrase files are not the source of truth.

## News and rollback

Candidate arbitration and rendering live in `features/presence/candidateSelector.js` and `features/presence/activityRenderer.js`. News is restricted to the five tracked official feeds in `data/news-sources.json`. The top-level `mode` is either `ambient` or `news`; `freshnessMode` is normally `fresh` (six hours), while the current local backfill uses `retroactive` to retain whatever the approved feeds expose. The cache remains bounded at 50 items, with the retroactive rollout capped at 10 items per source, and every rendered item keeps its real publication age. News mode remains news-only when no item exists, showing a bounded status instead of silently falling back to ambient phrases. Tests use only `test-fixtures/` and never query live feeds.

When explicitly enabled for rollout, the poller keeps bounded state in the ignored owner-only `data/news-state.json`. Fresh news interrupts ambient presence for a three-minute dwell, then ambient content resumes when no fresher candidate remains. No buttons, party data, or URLs are emitted.

To return to normal freshness, set `freshnessMode` to `"fresh"`; to return to ambient presence as well, set `mode` to `"ambient"`; to disable polling as well, set `enabled` to `false`; then restart the user service. Keep the local cache and bounded log for diagnosis; do not copy them outside the owner-only runtime directory. Re-run `npm run verify:shared-catalog`, `npm run test:all`, and `npm run check` after changing rollout settings.

## Logging and publisher reliability

Presence updates pass through `features/presence/activityPublisher.js`, which awaits one RPC request at a time, keeps only the latest pending candidate, suppresses identical payloads, times out stalled calls, and detaches/destroys stale clients before reconnecting. The publisher emits no buttons, party data, secrets, or URL fields.

`data/rpc.log` is structured JSONL with redacted fields. The logger keeps at most one backup (`data/rpc.log.1`); each file is capped at 5 MiB, keeping the combined active log and backup at or below 10 MiB. Startup trims oversized existing files, and the runtime data directory and log files are owner-only where the filesystem permits. Log records contain event metadata and bounded diagnostics, not credentials, environment values, article bodies, or raw feed content.
