# Research brief: triple Skarn news feeds and cache

Generated 2026-09-19 · depth: deep

## Question

Which 100 additional RSS/Atom feeds can be added to the existing 50-feed Skarn news pipeline so it reaches 150 sources and a balanced 1,500-item cache for the 30-second headline cycle?

## Scope and assumptions

- Retain the existing 50 sources and add 100 new, directly validated HTTPS RSS/Atom feeds.
- Cover AI, technology, developer/open-source/cloud, security, science, space, environment, gaming, consumer technology, and reputable general technology/news.
- Prefer primary organizational feeds; admit reputable publishers only when the feed is stable and materially broadens coverage.
- Discovery may use Tavily; runtime ingestion remains native HTTPS with explicit host allowlists, XML checks, sanitization, bounded diagnostics, and no article bodies.
- Increase the bounded cache from 500 to 1,500 items, capped at 10 per source.
- Keep the seven-day fresh-news gate and 30-second display dwell; feed polling remains on its 15-minute scheduler.

## Angles

1. F1 — AI, machine learning, and technology organizations.
2. F2 — Developer languages, frameworks, open source, and infrastructure.
3. F3 — Cybersecurity, CERT, vulnerability, and threat research.
4. F4 — Science, space, climate, environment, and health.
5. F5 — Gaming, consumer technology, and reputable general technology/news.

## Evidence standard

Every candidate needs a direct HTTPS endpoint, an allowlisted hostname, an accepted XML content type, and at least one parseable item during validation. Search aggregators are discovery aids only; they are not runtime sources.
