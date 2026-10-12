# Skarn news cache cleanup and feed health

## Scope

This runbook covers the local `skarn-rpc` news cache and its approved feed boundary. It does not touch the Railway bot, Hush chronicle database, mail, credentials, or Git state. The feed review is an endpoint snapshot, not a full publisher security audit.

The current rollout has 150 configured HTTPS feeds, 139 enabled after revalidation gating, and 11 quarantined: CISA (`HTTP_403_WAF`) plus ten timeout sources. CrowdStrike and Slack Engineering use canonical same-host URLs. `official` and `publisher` are source/content classifications, not security certifications.

## Preconditions

- Work from `/home/prime/anomaly-alpha.github.io/skarn-rpc`.
- Confirm the owner-only cache directory and file permissions: directory `0700`, `data/news-state.json` `0600`.
- Confirm the user unit is `skarn-rpc.service`; do not use the system service manager.
- Do not read or print `.env`, credentials, raw article bodies, or response payloads.

## Read-only gates

Run these in order:

```sh
npm run check
npm run test:all
npm run news:report
npm run news:health:report
node scripts/preview-news.js --quality
```

The health report may make bounded HTTPS requests to all 150 configured endpoints. It does not ingest feed content or write `news-state.json`; it writes only bounded owner-only endpoint evidence to ignored `data/news-health.json`. It never retains response bodies. Investigate any new `HTTP_403_WAF`, `TIMEOUT`, `INVALID_CONTENT_TYPE`, `UNSAFE_REDIRECT`, or `UNSAFE_DNS_DESTINATION` result before changing a source disposition.

The preview command is read-only and uses the live renderer. It accepts only `--limit N`, `--topic NAME`, `--source TEXT`, `--links`, and `--quality`.

## Apply cleanup

Review the dry-run output and obtain explicit operator authorization for the local cache mutation. Then run:

```sh
node scripts/clean-news-cache.js --apply
```

The command validates the exact non-symlink target and owner-only permissions, stops `systemctl --user skarn-rpc.service`, confirms the cache did not change while stopping, creates one timestamped same-directory owner-only backup, writes a validated temporary file, and atomically renames it into place. It restarts the user service only if it was active before apply.

If any gate fails, the original cache remains unchanged where possible and the service remains stopped. Do not retry blindly; record the diagnostic and inspect the backup path.

## Manual restore

1. Stop the user service: `systemctl --user stop skarn-rpc.service`.
2. Verify the target and selected `.backup-YYYYMMDDHHMMSS` file are regular files owned by the current user; retain `0700`/`0600` permissions.
3. Validate the backup JSON/schema with the repository state validator before replacement.
4. Move the current cache aside to a controlled, same-directory diagnostic filename if needed; do not recursively delete files.
5. Atomically replace `data/news-state.json` with the validated backup and restore `0600` permissions.
6. Validate the replacement path, owner, permissions, schema, bounded item count, timestamps, and accepted safety decisions.
7. Restart only after validation: `systemctl --user start skarn-rpc.service`.
8. Run `node scripts/preview-news.js --quality` and inspect service logs without exposing secrets or article bodies.

If restore validation fails, leave the service stopped and escalate for review. A preview is useful after restore but is not itself the restore gate.

## Feed disposition changes

A quarantined source may be re-enabled only through a reviewed configuration change after two clean, evidence-recorded rechecks. The runtime must keep the host allowlist immutable, enforce same-host redirects, validate every resolved DNS destination as public, and apply identical controls to official and publisher-class sources. Never use trust labels to bypass transport, DNS, redirect, XML, sanitization, or title-quality checks.
