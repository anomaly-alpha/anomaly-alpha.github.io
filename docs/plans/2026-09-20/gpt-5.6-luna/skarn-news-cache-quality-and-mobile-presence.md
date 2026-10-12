# Implementation plan: Skarn news cache quality and mobile Rich Presence

Status: implementation complete through gated preflight — cache apply and manual Discord iOS acceptance remain explicit rollout gates

Spec: `docs/specs/2026-09-20/gpt-5.6-luna/skarn-news-rich-presence-preview.md`

## Outcome

Implement the five approved quality changes without a blind cache wipe:

1. Reject low-signal/version-only titles with a strict, explicitly allowlisted exception path.
2. Compute a deterministic 48-grapheme `displayTitle` at render time, preserving the original source title.
3. Cap the active candidate pool at 10 items per source while retaining valid persisted records.
4. Add a dry-run-first transactional cache cleaner with service lifecycle control, one owner-only backup, atomic replacement, and a manual restore runbook.
5. Add `/presence-preview --quality` with bounded quality metrics and ten problematic-title examples.

The 157-source feed expansion is now part of this rollout boundary; the four added feeds were separately discovered and validated with the existing security gates.

## Security evidence baseline

The existing security evidence is authoritative for the rollout baseline and must be preserved with the implementation record:

- 150 configured HTTPS RSS/Atom feeds were reviewed.
- 137 passed the strict endpoint baseline: verified TLS, 2xx response, accepted XML content type, no redirect, and matching final host.
- CrowdStrike and Slack Engineering used same-host redirects; these are canonicalization work, not cross-host failures.
- CISA returned HTTP 403 with HTML and was not verified as a usable feed.
- Ten endpoints timed out: NVIDIA, Polygon, New Scientist, Rock Paper Shotgun, MacRumors, LWN, Kernel.org, Drupal, WordPress, and Overreacted.
- No responding endpoint failed TLS verification, and no observed remote IP was private or link-local.
- Configuration metadata classifies 129 sources as `official` and 21 as `publisher`; this is a content/trust classification, not a security certification.
- News is enabled with a 24-hour freshness window and bounded 1,500-item state. The operational rollout target is at least 500 accepted stories inside that window.

Evidence files:

- Report: `docs/reports/2026-09-20/gpt-5.6-luna/news-feed-security.md`
- Per-URL evidence: `docs/reports/2026-09-20/gpt-5.6-luna/news-feed-security-sources.tsv`
- Claims: `docs/reports/2026-09-20/gpt-5.6-luna/news-feed-security-claims.tsv`

This is an endpoint snapshot, not a full publisher security audit. It does not establish uptime, certificate history, organizational security, absence of vulnerabilities, or resistance to future DNS rebinding.

Implementation evidence after the gated preflight includes the shared quality evaluator, same-host redirect enforcement, resolved-DNS destination guard, 139-source configured enabled boundary, 11-source quarantine metadata, fail-closed cache loading, quality preview, periodic health evidence writer, and transactional cleanup tooling. The latest bounded health run on 2026-09-20 reached all 150 configured endpoints and observed 138 `GOOD`, three invalid content types, two same-host redirects, and seven timeouts. This variable endpoint snapshot is not a clean rollout approval and does not automatically change any reviewed quarantine disposition; configuration changes remain operator-reviewed and require repeated evidence.

### Recommendation levels

- **Mandatory:** immutable host allowlisting; fail-closed cross-host redirect handling; same-host URL canonicalization; resolved-DNS private/link-local/loopback/metadata rejection; quarantine of unverified feeds before all-150 rollout; no trust-class bypass of sanitization; periodic endpoint revalidation; evidence-based health dispositions.
- **Recommended:** use trust class only as a bounded selection/tie-break signal; retain bounded per-source health evidence; require two clean rechecks before an operator re-enables a quarantined source.
- **Follow-up:** independent publisher security/reputation review, uptime/certificate-history monitoring, and any stronger DNS pinning or resolver-hardening work beyond the runtime destination guard.

## Constraints and invariants

- Do not read, print, or transmit `.env`, tokens, credentials, or private keys.
- Do not use article bodies or an LLM to invent headline text.
- Keep original accepted `title`, canonical URL, publisher, topic, and timestamps unchanged.
- Do not persist generated `displayTitle`; compute it from the original title at render time.
- Do not apply the 10-item source cap to stored cache records.
- Do not let normal polling silently delete existing records; cleanup owns removal of existing rejects.
- `--apply` is the only mutating cleanup mode and must stop `skarn-rpc.service` before replacement.
- Service control uses the user manager explicitly: `systemctl --user`; the plan never targets the system manager.
- On apply failure, leave the service stopped and report the backup/recovery path.
- Do not contact feeds, send mail, mutate Git, or touch `/mnt/hush/.mimocode/chronicle.sqlite3` during cleanup or preview.
- Keep `freshnessMode` as `fresh` and the polling interval at 15 minutes. The current policy amendment sets `maxAgeMs` to 24 hours; the cache must be rebuilt and measured against the 500-story target before rollout is considered complete.
- Preserve all unrelated pre-existing worktree changes.

## Files and responsibilities

### Add

- `skarn-rpc/features/news/newsQuality.js` — shared quality classification, grapheme counting, deterministic compaction, normalized token similarity, and bounded reason codes.
- `skarn-rpc/scripts/clean-news-cache.js` — report, dry-run, apply, and validation workflow.
- `skarn-rpc/scripts/test-news-quality.js` — unit and transactional behavior tests.
- `docs/runbooks/2026-09-20/gpt-5.6-luna/skarn-news-cache-cleanup.md` — manual restore and service lifecycle runbook.

### Modify

- `skarn-rpc/features/news/feedParser.js` — invoke the shared title-quality classifier after sanitization and timestamp validation; reject new low-signal items unless an explicit source rule matches.
- `skarn-rpc/features/news/newsState.js` — keep existing schema fields, preserve valid records, support exact/approved fuzzy deduplication for the cleaner, and retain atomic owner-only file handling.
- `skarn-rpc/features/news/newsPoller.js` — use parser quality rejection and retain the 157-source bounded network policy; do not enable stored per-source pruning in fresh mode.
- `skarn-rpc/features/news/feedClient.js` — verify redirect and resolved DNS destinations remain outside loopback, link-local, private, and metadata ranges.
- `skarn-rpc/scripts/news-feed-health.js` — read-only endpoint revalidation report using the same allowlist, redirect, TLS, DNS-destination, timeout, and content-type policy.
- `skarn-rpc/features/presence/candidateSelector.js` — cap active candidates at 10 per `sourceId`, ordered by freshness with stable tie-breakers.
- `skarn-rpc/features/presence/activityRenderer.js` — use shared grapheme-aware compaction with a 48-grapheme headline limit and 42-grapheme metadata limit, while retaining 128-byte hard guards.
- `skarn-rpc/data/news-sources.json` — validate the 157-source HTTPS allowlist, explicit feed settings, and an initially empty short-title exception list.
- `skarn-rpc/scripts/preview-news.js` — add `--quality` using the shared evaluator and selector projection without writing or polling.
- `/mnt/hush/.mimocode/command/presence-preview.md` — document `--quality` and the ten-example output contract; this is a local MiMoCode workspace file outside the Skarn repository.
- `skarn-rpc/package.json` — add `test:quality` (`node scripts/test-news-quality.js`), `news:report` (`node scripts/clean-news-cache.js --dry-run`), `news:health:report` (`node scripts/news-feed-health.js --report`), and quality/security syntax/check entries without adding dependencies.
- `skarn-rpc/README.md` — document the quality policy, report/apply/restore lifecycle, and preview behavior.

## Phase 0 — Baseline and preflight

1. Confirm the approved spec and this plan are the active design sources.
2. Record current cache audit metrics to a temporary, untracked report: item count, low-signal count, title-length distribution, source counts, duplicate candidates, and 157-source configuration validity.
3. Verify all feed URLs are HTTPS, on the declared approved host, and do not resolve to private/IP hosts under the existing client policy. This phase may make bounded read-only health requests, but may not mutate feed config, cache, service, or Git state.
4. Run a bounded, read-only health audit of all 150 configured feeds using the existing client policy; record status/timeout/content-type failures without rewriting config or cache.
5. Verify redirect handling and resolved destinations cannot reach loopback, link-local, private, or metadata IP ranges; implement the guard in `feedClient.js` if current client verification is insufficient and add stubbed DNS/redirect tests.
6. Run the current focused suite and `npm run check` before implementation.
7. Confirm `skarn-rpc.service` status and current cache permissions without reading service environments or secrets.

Gate: baseline results are captured, the config validates, and the worktree diff is understood. No cache or service mutation occurs.

Health gate (**mandatory**): sources with 403s, repeated timeouts, invalid content types, unsafe redirects, or unsafe resolved destinations are quarantined through an explicit reviewed config change with a reason. They are not silently left enabled and do not block the healthy allowlisted set from proceeding.

Initial disposition from the existing evidence: canonicalize and retest CrowdStrike to `https://www.crowdstrike.com/en-us/blog/feed` and Slack Engineering to `https://slack.engineering/feed/`; quarantine CISA (`HTTP_403_WAF`); quarantine NVIDIA, Polygon, New Scientist, Rock Paper Shotgun, MacRumors, LWN, Kernel.org, Drupal, WordPress, and Overreacted (`TIMEOUT`). The 137 clean endpoints plus the two canonicalized same-host redirects form the initial 139-source eligible set only after revalidation.

The 11 quarantined sources remain configured for evidence-based revalidation but are not enabled for ingestion or presence selection. No source is automatically re-enabled from a health probe.

## Phase 1 — Shared quality evaluator

Implement `newsQuality.js` as the only source of truth for parser, cleaner, preview, renderer, and tests.

### Grapheme and byte limits

- Use `Intl.Segmenter` with `granularity: 'grapheme'` for visible-unit counting.
- Define constants for `NEWS_HEADLINE_MAX_GRAPHEMES = 48`, `NEWS_METADATA_MAX_GRAPHEMES = 42`, and the existing 128-byte field ceiling.
- Test combining marks, emoji sequences, CJK text, curly quotes, em dashes, and non-ASCII publisher names.
- Fail clearly if the required grapheme segmenter is unavailable; do not silently downgrade the acceptance rule.

### Classification

Return a bounded result such as `{ eligible, reason, normalizedTitle, displayTitle }` without article bodies. Keep malformed/unreadable cache state distinguishable from a missing cache; never convert parse or permission failures into an empty state:

- `accepted` — meaningful title and valid timestamps/source metadata.
- `version_only` — semver, numeric/build, hash-like, date-only, or URL-only title.
- `no_meaningful_word` — no alphabetic token of at least three characters.
- `unsafe_text` — existing instruction/control/HTML safety rejection.
- `invalid_timestamp` or `stale` — existing temporal rejection.
- `overlong_compaction` — no meaningful compact form fits the 48-grapheme rule.

Short-title exceptions must be explicit source/title rules. Start with an empty exception list and require a fixture for every future exception.

### Deterministic compaction

Apply generic rules in a stable order:

1. Unicode-normalize and collapse whitespace.
2. Remove only approved leading labels (`Breaking:`, `Video:`, `New:`) when the remaining title retains its subject.
3. Remove a parenthetical or trailing attribution only when the remainder still contains a meaningful subject/action pair.
4. Prefer a complete clause at or below 48 graphemes.
5. Use a word-boundary ellipsis only as the last fallback.
6. Reject rather than emit a misleading fragment when no meaningful form remains.

Keep source-specific profiles out of the first implementation; add them only after `--quality` evidence demonstrates a repeatable failure.

### Near-duplicate similarity

Implement normalized token similarity for cleanup only:

- normalize case, Unicode punctuation, and whitespace;
- tokenize into a set of Unicode letter/number runs and use Sørensen–Dice similarity: `2 * intersection / (leftSize + rightSize)`;
- require similarity `>= 0.92`;
- require matching canonical topic;
- require `updatedAt`, falling back to `publishedAt`, within 24 hours;
- keep the newest timestamp, then the highest-trust source, then highest source priority on ties;
- never fuzzy-deduplicate short titles, recurring advisories with materially different URLs, or items across different topics.

Expose the comparison reason in dry-run output without printing raw feed payloads.

Tests use representative fixed fixtures covering version-only noise, Unicode/graphemes, quotes, subtitles, parentheticals, multilingual titles, duplicates, stale/future timestamps, and explicit exceptions. No live network access is allowed during tests.

## Phase 2 — Ingestion and active selection

1. Call the evaluator from `feedParser.js` after existing sanitation, URL, and timestamp checks. New low-signal items are rejected before `newsState` merge.
2. Keep the existing cache schema and original title fields; do not persist `displayTitle` or generated quality fields.
3. Change state loading so only a missing cache is treated as empty; malformed JSON, schema errors, unreadable files, and permission failures fail closed instead of becoming an empty state.
4. Remove per-source pruning from `newsState` in every freshness mode; persisted cache records are never source-capped by ordinary load/save.
5. Add a candidate-pool cap in `candidateSelector.js`: group eligible news items by `sourceId`, sort each group by updated/published timestamp with stable priority/confidence tie-breakers, and retain at most 10 per source.
6. Apply the cap before weighted selection and recent-source variation. Do not cap persisted records.
7. Preserve news-only fallback behavior when no eligible candidate remains.
8. Keep the 157-source allowlist and 15-minute polling cadence bounded; reject config drift and unauthorized hosts in validation.

Tests: the representative fixed fixture suite plus selector cases proving active caps, recency, topic coverage, fallback behavior, and no persisted-record deletion; update existing state tests that currently expect persisted per-source pruning.

### Security health state and trust classification

- **Mandatory:** retain bounded per-source health evidence in the existing owner-only source state or an equivalent owner-only status record: last check time, disposition, status/error class, final same-host URL, redirect count, TLS result, and accepted content-type result. Do not retain response bodies or credentials.
- **Mandatory:** revalidate enabled sources on the normal bounded poll cadence and revalidate quarantined sources at least every 24 hours without ingesting them or mutating `enabled` automatically.
- **Mandatory:** keep host allowlisting immutable for the process lifetime; a feed URL, redirect, title, or publisher classification cannot add an allowed host.
- **Mandatory:** for each request/redirect, validate the final hostname and resolved A/AAAA destinations; reject loopback, link-local, private, metadata, and other non-public destinations before connection or follow-up request. Reuse the validated destination for the request where the client permits; otherwise fail closed.
- **Recommended:** use `official` versus `publisher` only as a bounded content-confidence/tie-break signal. Both classes receive identical TLS, host, redirect, DNS, content-type, sanitization, and quality controls.
- **Follow-up:** independent publisher security review and longer-term uptime/certificate-history monitoring are outside this endpoint snapshot rollout.

## Phase 3 — Renderer and preview parity

1. Replace the renderer’s current 56-unit title limit with the shared 48-grapheme compactor.
2. Keep line 2 as topic/publisher/age under 42 graphemes and 128 bytes.
3. Preserve small/large image semantics and the no-summary contract.
4. Make `preview-news.js` call the same `renderNews` path and shared evaluator.
5. Add `--quality` output with cache totals, eligible/rejected counts, reason counts, over-budget counts, source concentration, projected active-cap counts, and at most ten bounded title examples.
6. Keep `--links` opt-in; default output must not print URLs.
7. Update the MiMoCode command instructions with `--quality`.

Tests: exact detail/state parity, grapheme and byte limits, no reaction/summary text, quality counts, ten-example bound, filters, empty/malformed cache behavior, no-write verification, and health-disposition display without response bodies.

## Phase 4 — Transactional cleaner

Implement `clean-news-cache.js` with a strict lifecycle:

### Report/dry-run

- Read and validate the cache and config.
- Apply the evaluator, exact/approved fuzzy deduplication, stale/future pruning, and projected active-cap analysis in memory.
- Print before/after counts, reason/source counts, projected active counts, and bounded examples.
- Make no feed, service, cache, or Git mutation.

### Apply

1. Run the same preflight and dry-run calculations, capturing whether `skarn-rpc.service` was active.
2. Confirm the target is exactly `skarn-rpc/data/news-state.json` and the backup directory is the same owner-only data directory.
3. Run `systemctl --user stop skarn-rpc.service`; account for the unit’s `Restart=always` behavior and verify `systemctl --user is-active skarn-rpc.service` is inactive before touching the cache.
4. Re-read and validate the cache after stopping to prevent applying a stale plan; compare inode, size, mtime, and a content hash against the pre-stop snapshot and abort on change.
5. Write one timestamped owner-only backup.
6. Write the cleaned state to a same-directory temporary file, validate it, set owner-only permissions, and atomically rename it into place.
7. Re-open and validate the replacement and verify directory/file permissions; permission-hardening failure is an abort.
8. Restart with `systemctl --user start skarn-rpc.service` only after replacement validation succeeds and only if it was active before apply.
9. On any failure, preserve the original/backup, leave the service stopped, and print the manual restore path.

The cleaner must not use recursive deletion, network calls, mail, Git commands, or the unrelated chronicle database.

The cleaner must verify the exact user unit, cache path, owner UID, directory mode 0700, file mode 0600, and non-symlink targets. Permission or identity mismatch is an abort.

## Phase 5 — Operations runbook

Create `docs/runbooks/2026-09-20/gpt-5.6-luna/skarn-news-cache-cleanup.md` with:

- prerequisites and owner-only permission checks;
- report and dry-run commands;
- security health report command, evidence paths, quarantine dispositions, and the endpoint-snapshot limitation;
- canonical same-host redirect URLs and the immutable allowlist/DNS-destination policy;
- apply command and expected service lifecycle;
- backup naming and location;
- manual restore command sequence;
- validation after restore;
- restore must validate path identity, JSON/schema, owner-only permissions, and cache invariants before restart; no preview is required for the restore gate;
- failure state where the service remains stopped;
- rollback and escalation notes;
- explicit warning not to touch Hush chronicle state or Git.

## Phase 6 — Verification and rollout

Run in order:

1. `npm run check`.
2. `npm run test:quality`.
3. `npm run news:report` (read-only cleaner report).
4. `npm run news:health:report`; confirm the original 137 clean endpoints, two same-host redirect dispositions, CISA 403 quarantine, ten timeout quarantines, and any new endpoint failures are represented without treating either snapshot as a security certification.
5. Confirm canonical URLs for CrowdStrike and Slack Engineering and validate the immutable host/DNS-destination policy with redirect/rebinding fixtures.
6. Existing activity, contract, content, news, selector, and shared-catalog tests.
7. `npm run test:all`.
8. `node scripts/preview-news.js --quality` while the service remains untouched.
9. Review the ten examples and source concentration against the approved rules.
10. Run the cleaner report/dry-run and confirm no file mtime/content change.
11. Review and manually accept representative 48-grapheme headlines on the Discord iOS profile/activity surface while the live service remains untouched; record the result in an owner checklist covering ten entries.
12. Obtain the planned apply authorization, run `--apply`, validate service state and cache permissions, and confirm the single backup.
13. Run `/presence-preview --quality`.
14. Confirm the cleaned cache has zero eligible reject-class items and that the projected active pool stays within the 10/source cap with source/topic diversity where available.
15. Observe the live service after restart for connection, poll, publish, and timeout errors without logging secrets or article bodies.
16. Re-run endpoint health evidence periodically; if a source fails, quarantine it through an explicit reviewed config change and do not silently broaden network permissions.

## Rollback

- Before cleanup apply: no rollback required; delete only temporary test fixtures in their controlled temporary directory.
- After renderer/config rollout: revert the targeted code/config change and restart `skarn-rpc.service`.
- After cache apply failure: leave service stopped and follow the restore runbook using the one timestamped owner-only backup.
- After successful cache apply with bad results: stop service, restore backup, validate, restart, and retain the failed output for diagnosis without publishing it.
- Feed security rollback: revert only the affected source disposition/canonical URL change, keep the immutable host allowlist fail-closed, and preserve the health evidence showing why the source was quarantined.

Never use Git reset/clean or recursive deletion as rollback.

## Plan acceptance

The plan is complete when the implementation can be executed from this document without inventing thresholds, touching unrelated state, or requiring an unrecorded user decision. The remaining gates are explicit: canonicalize same-host redirects, quarantine the 403/timeout set, enforce immutable allowlisting and DNS-destination checks, pass the representative fixed-fixture suite, validate-only restore, owner-recorded iOS acceptance, and zero reject-class items plus active source/topic diversity. The security evidence remains an endpoint snapshot, not a full publisher security audit.

Current implementation gate result: syntax, full Skarn/Railway tests, cache dry-run, quality preview, and the health revalidation command passed; the latest health snapshot is not a clean all-source rollout gate. The reviewed cleanup was then applied atomically: `809` records became `752`, removing `56` version-only and `1` no-word item, with an owner-only timestamped backup. Post-apply schema/permission validation passed, the active user service restarted and is running, and the live quality preview reports zero rejected items. Remaining follow-up is repeated health disposition review for transient enabled-source failures and manual Discord iOS acceptance.
