# News Feed Security Review Baseline

Date: 2026-09-20

Scope: the current uncommitted `skarn-rpc/data/news-sources.json` configuration.

Baseline facts:

- 150 configured HTTPS RSS/Atom feed URLs.
- News mode is enabled in the current worktree.
- Freshness window is seven days; per-source retention is capped at 10 items.
- Runtime state capacity is 1,500 normalized items.
- The service uses an explicit host allowlist, HTTPS-only retrieval, redirect revalidation, response-size limits, content-type checks, conditional requests, title sanitization, and owner-only local state.

This baseline records configuration only. It does not yet make claims about endpoint availability, TLS behavior, redirect chains, publisher security posture, or feed-content quality.
