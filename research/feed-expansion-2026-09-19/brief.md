# Research brief: expand Skarn news to 50 validated feeds

Generated 2026-09-19 · depth: deep

## Question

Which 35 additional RSS/Atom feeds should be added to the existing 15-feed Skarn news pipeline so the catalog reaches 50 total sources and can sustain a dense 30-second headline cycle with roughly 500 retained candidates?

## Scope and assumptions

- Prefer primary official organizational feeds and reputable publishers with stable HTTPS RSS/Atom endpoints.
- Cover AI and technology, cybersecurity, developer/open-source/cloud, science/space/environment, gaming, and general technology/news.
- Discovery may use Tavily; runtime ingestion must use only explicit HTTPS host allowlists and native feed retrieval.
- Validate candidate endpoints directly before production configuration; do not persist raw article bodies or Tavily payloads.
- The cache target is 500 items total, capped at 10 per source, preserving source diversity.
- Existing 15 sources are retained; the task is to identify 35 additions.
- The fresh-news acceptance window is up to seven days; the feed item age remains visible in Discord.

## Angles

1. F1 — Identify 8 additional official AI and technology organization feeds.
2. F2 — Identify 8 additional official cybersecurity, CERT, and security research feeds.
3. F3 — Identify 8 additional official developer, open-source, and cloud platform feeds.
4. F4 — Identify 6 additional official science, space, climate, and environment feeds.
5. F5 — Identify 5 additional reputable gaming, consumer technology, and general technology feeds.

## Evidence standard

Each candidate needs a primary source page or direct feed URL, a clear publisher identity, and direct HTTPS/XML validation before it is admitted to the runtime configuration. Search aggregators are discovery aids only, not runtime sources.
