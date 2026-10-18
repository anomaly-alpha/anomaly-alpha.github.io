# Skarn RPC

The local desktop Rich Presence publisher. This is a separate service from the Railway Discord bot.

## Runtime

Run from this directory with `npm install` followed by `npm start`. The RPC reads the tracked shared catalog at `../skarn-bot/presence-assets/presence-phrases.json` through `features/presence/sharedCatalogAdapter.js`. The adapter is read-only and maps shared RPC details, state, icon key, mood, and ID into the existing renderer shape.

The RPC retains local Discord IPC, artwork, timers, and mood state. Its elapsed Discord activity timer intentionally starts 43 calendar years before each RPC process start and continues advancing. Its local `data/icon-registry.json`, `data/rpc-mood-state.json`, and log remain RPC-owned; the shared phrase catalog is not copied into `data/`, uploaded to Railway, or stored in the bot database. The bot's Gateway Watching activity uses only shared text and cannot display the RPC artwork fields.

The local policy in config/presence-local.json overlays only sleep timing onto the shared mood contract. It uses America/Toronto wall-clock time with DST-aware wake calculation and a policy revision. When that revision or the state schema changes, the loader discards the persisted local mood window and starts a fresh one; the Railway bot continues to consume the unchanged UTC contract.

Commands:

    npm start                    # publish the local Rich Presence
    npm run verify:shared-catalog # validate shared fields and icon compatibility
    npm run test:all              # focused local tests plus the unchanged Railway presence smoke suite
    npm run check                 # syntax-check changed service and test modules
    npm run news:report            # read-only cache cleanup/quality report
    npm run news:health:report     # bounded endpoint health revalidation report
    npm audit --omit=dev          # audit production dependencies

The shared catalog is generated and checked from `skarn-bot/` with `npm run generate:presence` and `npm run check:presence`. Legacy RPC phrase files are not the source of truth.

## News and rollback

Candidate arbitration and rendering live in `features/presence/candidateSelector.js` and `features/presence/activityRenderer.js`. News is restricted to 167 approved HTTPS RSS/Atom feeds in `data/news-sources.json`. The top-level `mode` is either `ambient` or `news`; `newsDwellMs` controls headline rotation and is currently 10 seconds. Selection is weighted-random and avoids the last 20 item IDs and last 8 sources when enough alternatives exist. `freshnessMode` is normally `fresh` with an acceptance window of up to 24 hours, while the local backfill mode uses `retroactive` to retain whatever the approved feeds expose. The cache is bounded at 1,500 items and source-balanced at up to 10 per source, and every rendered item keeps its real publication age. Feed polling remains a separate 15-minute operation. News mode remains news-only when no item exists, showing a bounded status instead of silently falling back to ambient phrases. Tests use only `test-fixtures/` and never query live feeds.

When explicitly enabled for rollout, the poller keeps bounded state in the ignored owner-only `data/news-state.json`. Fresh news interrupts ambient presence for the configured 30-second dwell, then ambient content resumes when no fresher candidate remains. No buttons, party data, or URLs are emitted.

News presence uses two factual lines: a deterministic 48-grapheme source headline, followed by `topic · publisher · age` within a 42-grapheme target and the 128-byte Discord field ceiling. It does not emit an authored reaction or AI summary. The local read-only preview is available from MiMoCode as `/presence-preview`; it invokes `node scripts/preview-news.js` against the same cache and renderer. Optional filters are `--limit N`, `--topic NAME`, `--source TEXT`, `--links`, and `--quality`. The preview never polls feeds or rewrites `data/news-state.json`.

The feed security boundary is HTTPS-only with an immutable approved-host allowlist, same-host redirect enforcement, XML content-type and response-size limits, sanitization, and resolved-DNS rejection for private, loopback, link-local, metadata, or otherwise non-public destinations. The original endpoint evidence covered 150 configured feeds; the registry now has 167 feeds after seven earlier and ten new sources passed validation. Original endpoint evidence details: 137 passed the strict baseline, CrowdStrike and Slack Engineering were canonicalized to same-host final paths, CISA is quarantined for HTTP 403/WAF, and ten timeout sources are quarantined. The original enabled set was 139; the current enabled set is 156; quarantine is evidence-based and does not automatically re-enable a source. While connected, the local service schedules a bounded health revalidation at least every 24 hours and writes only owner-only endpoint evidence. The current 129 official / 38 publisher labels affect content confidence only, not security assurance.

To review or clean the local cache, run `npm run news:report` first. `node scripts/clean-news-cache.js --apply` removes stale/invalid entries while retaining valid fresh ones. To start with an empty cache and force an unconditional feed refresh, use `node scripts/clean-news-cache.js --clear`: it stops the user service, verifies the cache did not change, creates an owner-only backup, atomically clears article and source-validator state, then restarts only if it was active before the operation. A failed operation leaves the service stopped for review. Follow the cleanup runbook for manual restore; never use recursive deletion or Git reset/clean.

To return to normal freshness, set `freshnessMode` to `"fresh"`; to return to ambient presence as well, set `mode` to `"ambient"`; to disable polling as well, set `enabled` to `false`; then restart the user service. Keep the local cache and bounded log for diagnosis; do not copy them outside the owner-only runtime directory. Re-run `npm run verify:shared-catalog`, `npm run test:all`, and `npm run check` after changing rollout settings.

## Logging and publisher reliability

Presence updates pass through `features/presence/activityPublisher.js`, which awaits one RPC request at a time, keeps only the latest pending candidate, suppresses identical payloads, times out stalled calls, and detaches/destroys stale clients before reconnecting. The publisher emits no buttons, party data, secrets, or URL fields.

`data/rpc.log` is structured JSONL with redacted fields. The logger keeps at most one backup (`data/rpc.log.1`); each file is capped at 5 MiB, keeping the combined active log and backup at or below 10 MiB. Startup trims oversized existing files, and the runtime data directory and log files are owner-only where the filesystem permits. Log records contain event metadata and bounded diagnostics, not credentials, environment values, article bodies, or raw feed content.
