# Skarn news cache quality and mobile Rich Presence

Status: approved for gated implementation — security evidence incorporated; implementation preflight passed; cache apply and iOS acceptance remain

## 1. Decision summary

The local Skarn news pipeline will be upgraded in five coordinated layers:

1. Reject low-signal feed titles at ingestion.
2. Derive deterministic, mobile-sized display headlines without AI summaries.
3. Balance source volume so prolific feeds do not dominate the cache or rotation.
4. Provide a dry-run-first surgical cache cleanup and migration path.
5. Extend `/presence-preview` with a read-only quality audit.

The cache will not be blindly wiped. Original source titles and URLs remain available for traceability; only presence eligibility and display representation change.

## 2. Context and current evidence

The local publisher is `skarn-rpc/rich-presence.js`. It polls approved RSS/Atom feeds into the owner-only JSON cache `skarn-rpc/data/news-state.json`, selects a candidate, renders Discord `details` and `state`, and publishes through local Discord IPC. The Railway bot, its `daily_news` table, and the Hush chronicle database are separate systems and are out of scope.

The current 157-feed expansion and enabled fresh polling are included in this feature boundary. The implementation must validate the full approved HTTPS allowlist and must not add further external sources without a separate decision.

The current cache is one accepted feed item per record, identified primarily by feed ID and canonical URL. It stores the source title, source, topic, URL, publication/update/fetch times, salience, and safety decision. It does not store an AI summary.

### 2.1 Security evidence and rollout boundary

The existing endpoint review is part of this specification's implementation evidence:

- 150 configured HTTPS RSS/Atom feeds were reviewed.
- 137 passed the strict endpoint baseline: verified TLS, 2xx response, accepted XML content type, no redirect, and matching final host.
- CrowdStrike and Slack Engineering use same-host redirects; their feed URLs must be canonicalized to the observed final same-host paths before admission.
- CISA returned HTTP 403 with HTML and is not a verified feed. NVIDIA, Polygon, New Scientist, Rock Paper Shotgun, MacRumors, LWN, Kernel.org, Drupal, WordPress, and Overreacted timed out and are not verified feeds.
- No responding endpoint failed TLS verification, and no observed remote IP was private or link-local. This does not prove future DNS answers are safe.
- Configuration metadata classifies 129 sources as `official` and 21 as `publisher`; this is a content/source classification, not a security assurance or publisher audit.
- News is enabled with a 24-hour freshness window and bounded 1,500-item state. The rollout target is at least 500 accepted stories inside that window; the target must be measured after a clean rebuild and must not be met by retaining older records.
- A separately authorized Tavily-assisted discovery pass added seven publisher-class feeds after the production fetch client and parser accepted them: The Verge (8 fresh items), Engadget (20), Interesting Engineering (10), gHacks (4), Ars Technica (3), WIRED (9), and Security Affairs (4). The registry now contains 157 feeds, 146 enabled and 11 quarantined. Candidate URLs, failures, and yield evidence are recorded in `docs/research/2026-09-20/gpt-5.6-luna/skarn-feed-discovery.tsv`.

The runtime security boundary is mandatory: HTTPS-only requests, an immutable process-lifetime host allowlist, fail-closed cross-host redirect handling, same-host redirect canonicalization, response and XML content-type limits, title sanitization, and resolved-destination rejection for loopback, link-local, private, metadata, and other non-public addresses. A URL or feed payload cannot expand the allowlist. DNS rebinding is treated as a runtime destination risk; the implementation must validate the address selected for each request and fail closed when it cannot establish a safe public destination.

The 11 unresolved feeds are quarantined from ingestion and presence selection until explicit reviewed revalidation. Quarantine does not delete their configuration or evidence, and no probe may automatically re-enable a source. The initial rollout gate is the 137 clean sources plus the two canonicalized same-host redirects, yielding 139 eligible sources only after a fresh bounded revalidation. The healthy set may proceed independently; a 403, timeout, invalid content type, unsafe redirect, or unsafe destination does not become an enabled source merely because the configured source is marked official.

Periodic endpoint revalidation is required for enabled sources and quarantined sources. Health evidence must be bounded and must not retain response bodies, credentials, or secrets. The endpoint report is a point-in-time snapshot, not a full publisher security audit: it does not establish uptime, certificate history, organizational security, absence of vulnerabilities, or resistance to future DNS changes.

Read-only audit snapshot from 2026-09-20:

- 792 cached items.
- 54 low-signal items, mostly version-only release titles such as `44.103.7`, `2.5.1`, and `v9.9.0-M2`.
- 502 titles longer than the current 56-visible-character headline target.
- 46 titles longer than the 128-byte Discord field ceiling before rendering.
- Only 36.6% of raw titles fit within 56 visible characters.
- Long-title volume is concentrated in ScienceDaily, Eurogamer, Rock Paper Shotgun, AWS What's New, Phys.org, and Phoronix.

These numbers are diagnostic evidence, not fixed acceptance criteria; the quality audit must be rerun immediately before migration because the cache changes every 15 minutes.

## 3. User-facing presence contract

News activities use both Discord text fields:

```text
<compact source headline>
<topic> · <publisher> · <age>
```

Example:

```text
Kojima Productions Confirms The Studio Is…
Games · Polygon · 6m
```

Rules:

- Line 1 contains source-derived headline text only.
- Line 2 contains canonical topic, publisher, and publication age.
- No authored Skarn reaction, AI summary, or invented claim is emitted.
- Line 1 has a 48-grapheme-cluster mobile-first target; line 2 remains limited to 42 grapheme clusters.
- Both fields retain the hard Discord ceiling of 128 UTF-8 bytes.
- Topic icons and tooltips remain semantic context.
- The original title and URL remain available in cache records and optional preview output.

The grapheme-cluster target is a conservative product policy, not a universal Discord pixel guarantee. Node's `Intl.Segmenter` with `granularity: "grapheme"` is the measurement authority. Manual verification on the Discord iOS profile/activity surface remains required.

## 4. Quality model

Every accepted feed item receives a deterministic quality classification before it can enter the presence candidate pool:

### 4.1 Reject

Reject from Rich Presence eligibility when any rule matches:

- version-only, numeric-only, build-number, hash-like, date-only, or URL-only title unless an explicit source/title rule allowlists it;
- no meaningful alphabetic token of at least three characters;
- title is empty, control-character contaminated, instruction-like, malformed, future-dated, or stale;
- source-specific release feed supplies no product/project context beyond a version string.

Rejected records are not admitted by new polling and are removed from the existing cache only through the reviewed, backed-up cleanup operation. They are not silently discarded during ordinary polling. The cleanup report must retain bounded counts and reason categories even after records are removed.

Short-title exceptions must be explicit source configuration, tested by source ID and rule, and limited to titles that become meaningful when the trusted source/project name is included. The default allowlist is empty until named exceptions are reviewed.

### 4.2 Compact

Keep the item eligible but derive `displayTitle` from the source title using generic deterministic transformations:

1. Normalize Unicode and whitespace.
2. Remove leading boilerplate labels such as `Breaking:`, `Video:`, or `New:` only when they add no subject information.
3. Remove redundant parenthetical material when the remaining headline is still meaningful.
4. Prefer a complete leading clause or sentence over a mid-word cut.
5. Remove low-value trailing attribution clauses such as `according to...` only under source-tested rules.
6. Apply a word-boundary ellipsis only as the final fallback.

The first implementation uses generic rules for every source; source-specific compaction profiles are deferred until preview evidence shows a concrete failure pattern. The original `title` remains unchanged for surviving records. `displayTitle` is computed at render time, avoiding a schema migration and allowing rule changes without rewriting the cache. No LLM or article body is used to create it.

### 4.3 Eligible

An item is eligible only when its final display title and metadata line satisfy the visible-character and byte budgets. The quality classifier, cleanup tool, preview command, and live renderer must share the same implementation so they cannot disagree.

## 5. Source balancing

The current configuration declares `maxItemsPerSource: 10`, but the poller applies that cap only in retroactive mode. Fresh mode can therefore retain many items from prolific feeds.

The proposed policy:

- apply a source cap to the fresh active candidate pool;
- preserve recency while enforcing the cap;
- keep existing recent-source cooldowns in candidate selection;
- optionally assign a lower presence priority to release-only sources;
- expose source counts and concentration in `/presence-preview --quality`.

The active candidate cap is 10 items per source. Valid records remain in the persisted cache; the cap applies only to the active candidate pool used by selection and rotation. Candidate freshness ordering uses the existing updated/published timestamp fallback.

The 157-source allowlist and 15-minute polling cadence are part of this feature and must be tested as one bounded network policy. No source outside the approved 157 may be added by the quality work.

## 6. Surgical cache cleanup

Add `skarn-rpc/scripts/clean-news-cache.js` with these modes:

- default: read-only report;
- `--dry-run`: explicit read-only report with before/after counts;
- `--apply`: explicit local mutation only after validation.

The cleanup must:

1. run a preflight report, then stop `skarn-rpc.service` before `--apply`;
2. load and validate the current schema;
3. classify low-signal titles using the shared quality evaluator;
4. deduplicate by canonical URL and stable item ID, then apply high-confidence fuzzy deduplication only when normalized token similarity is at least 0.92, topic matches, and publication/update timestamps are within 24 hours; keep the newest item, then the highest-trust source on ties;
5. retain valid cache records regardless of the active source cap and report the projected active-pool counts;
6. retain original source fields for survivors;
7. write one same-directory owner-only backup named with the UTC apply timestamp before replacement;
8. atomically replace `news-state.json`;
9. validate the replacement, restart `skarn-rpc.service` on success, and leave it stopped on failure for review;
10. print counts by reason and source, without printing secrets or raw feed payloads.

The operation must never recursively delete the cache, touch `/mnt/hush/.mimocode/chronicle.sqlite3`, contact feeds, send mail, or mutate Git. A failed validation must leave the original cache unchanged. The backup is the single rollback artifact for that apply operation.

Automatic cleanup during ordinary polling is allowed only after the quality rules and rollback behavior are tested. The default rollout should be report-only.

## 7. Preview and quality audit

MiMoCode command:

```text
/presence-preview
```

Existing options remain:

- `--limit N`: show 1–50 rendered items; default 10;
- `--topic NAME`: filter by topic;
- `--source TEXT`: filter by source ID or publisher name;
- `--links`: include canonical URLs.

Add:

- `--quality`: show cache count, eligible/rejected counts, rejection reasons, over-budget counts, source concentration, and at most ten bounded examples of problematic titles. URLs remain opt-in through `--links`.

The command is strictly read-only. It loads the local cache, applies the same in-memory freshness and quality evaluation used by the pipeline, calls the live renderer for normal previews, and never polls feeds or regenerates data. URLs remain opt-in.

## 8. Implementation scope

- `features/news/feedParser.js`: shared title-quality classification and source-derived normalization.
- `features/news/feedClient.js`: immutable allowlist, same-host redirect canonicalization, and resolved-DNS destination safety checks.
- `features/news/newsState.js`: pruning and deduplication without persisting generated display titles.
- `features/news/newsPoller.js`: apply strict title-quality rejection without adding unreviewed sources.
- `scripts/news-feed-health.js`: read-only periodic endpoint revalidation with bounded per-source evidence and explicit quarantine dispositions.
- `features/presence/candidateSelector.js`: enforce the 10-item-per-source active candidate cap and preserve recency ordering.
- `data/news-sources.json`: validate and document the included 157-source network boundary.
- `features/presence/activityRenderer.js`: render `displayTitle` and enforce the final mobile/byte budgets.
- `scripts/clean-news-cache.js`: dry-run/apply migration with service lifecycle control, backup, and atomic replacement.
- `scripts/preview-news.js`: add `--quality` while preserving exact renderer parity.
- `scripts/test-news-quality.js`: test reject/compact/eligible classes, grapheme and byte limits, explicit exceptions, high-confidence deduplication, source caps, dry-run safety, and rollback behavior.
- `scripts/test-news-security.js`: test immutable allowlisting, same-host canonicalization, cross-host redirect rejection, DNS destination rejection, timeout/403 dispositions, and periodic health evidence without response bodies.
- `docs/runbooks/...`: document the manual one-backup restore procedure and service lifecycle steps.
- `package.json`: expose quality cleanup and test commands.
- `README.md`: document policy, preview, cleanup, and rollback.
- `docs/specs/...`: this decision record.

No Railway bot command, Hush chronicle workflow, email path, or new network exposure changes. The included 157-source feed boundary is the only external-network scope for this feature.

## 9. Verification and acceptance

The implementation is accepted only when:

- known version-only examples are rejected unless an explicit tested exception matches;
- the 11 feeds identified by the endpoint review remain quarantined until an operator-reviewed revalidation changes their disposition;
- CrowdStrike and Slack Engineering use canonical same-host feed URLs, while cross-host redirects fail closed;
- no feed URL, redirect, DNS answer, title, or trust classification can expand the immutable host allowlist;
- resolved private, loopback, link-local, metadata, or otherwise non-public destinations are rejected before feed content is admitted;
- official and publisher-class sources receive identical transport, DNS, redirect, sanitization, and quality controls;
- health evidence is periodic, bounded, and explicit about endpoint status without claiming a publisher security audit;
- valid long headlines retain their original source title while receiving a deterministic display title;
- no rendered line exceeds its grapheme-cluster target or 128-byte hard ceiling;
- source caps reduce concentration without starving configured topic families;
- cleanup dry-run makes no filesystem changes;
- apply mode creates a recoverable backup and is atomic;
- malformed, invalid, or concurrent-write conditions leave the original cache intact;
- `/presence-preview` and live Discord rendering produce identical details/state pairs;
- tests cover English punctuation, grapheme clusters, Unicode, quoted titles, explicit source exceptions, release versions, duplicate URLs, 0.92 high-confidence near duplicates, missing timestamps, and stale/future records;
- the live RPC service is restarted only after the dry-run and focused tests pass;
- the final 48-grapheme result is manually accepted on the Discord iOS profile/activity surface.

## 10. Rollback

Rollback is target-specific:

- renderer/config change: revert code/config and restart `skarn-rpc.service`;
- cache migration: follow the owner-only manual restore runbook, stop the service, restore the backup, validate it, and restart only after validation;
- source-cap policy: disable the policy flag and restart without deleting records;
- preview quality mode: remove the option while retaining the existing read-only preview.

Rollback must not use recursive deletion, Git reset/clean, or a full cache wipe.

## 11. Gated implementation review

The primary product and security choices are now recorded: the 154-feed expansion is bounded by a 139-source initial rollout gate, 11 reviewed endpoints are quarantined, same-host redirects are canonicalized, cross-host redirects and unsafe DNS destinations fail closed, trust class does not bypass security controls, line 1 targets 48 grapheme clusters, rejected records are removed only by backed-up cleanup, the active source cap is 10, `--apply` controls service stop/restart, generic compaction ships first, fuzzy dedup uses the 0.92 rule, restore is runbook-only, quality preview shows at most ten examples, and iOS is the manual acceptance surface.

Remaining pre-implementation verification items:

- Confirm the 154-feed HTTPS allowlist, canonical redirect policy, resolved-DNS destination guard, and source count before rollout.
- Revalidate the 137 clean endpoints and two same-host redirect endpoints; keep CISA and the ten timeout sources quarantined unless explicit evidence supports a reviewed disposition change.
- Define the initial strict title-quality regex/word rules and keep the short-title exception allowlist empty unless a fixture justifies an entry.
- Add fixtures proving generic compaction preserves meaning for quotes, parentheticals, subtitles, punctuation, and multilingual grapheme clusters.
- Validate the 0.92 fuzzy-dedup rule against recurring advisories and versioned releases to prevent false merges.
- Write and test the manual restore runbook, including owner-only permissions and failure recovery.
- Perform the iOS profile acceptance check after the dry-run and before restarting the live service.
- Run the periodic health report and preserve the endpoint-snapshot limitation in the operational record; do not represent publisher trust metadata as a security certification.

Current gate evidence: syntax checks, the full Skarn/Railway test suite, the read-only cache report, the shared-renderer quality preview, and the bounded 157-source health revalidation command passed as checks. The latest health snapshot observed transient failures, so it is not a clean all-source rollout approval; the original 11-source quarantine remains in force and new failures require repeated evidence. The reviewed cache cleanup was applied atomically from `809` to `752` items, with owner-only backup and permissions validated; the live user service restarted successfully and the quality preview reports zero rejected items. Manual Discord iOS acceptance remains the only presentation check not executable from this host.
