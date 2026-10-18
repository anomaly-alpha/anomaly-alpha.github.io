# News source expansion contract

- Goal: Broaden Skarn Rich Presence news coverage into the user-selected categories: world/politics, business/finance, science/health, gaming/esports, and culture/general.
- Baseline: 157 configured feeds; 146 enabled; 105 enabled developer-topic feeds; no dedicated world/politics, business/finance, health, or culture topic buckets.
- Primary output: Add two verified feed sources per selected category to skarn-rpc/data/news-sources.json, for up to 10 new active feeds, without changing existing feeds or ticker behavior.
- Evidence: Record every candidate and validation result in news-source-sources.tsv; summarize changes and blockers here.
- Acceptance: Candidate must be a credible source, HTTPS, a valid RSS/Atom endpoint, pass existing host/redirect/DNS security constraints and the project's feed parser/health checks, and have an appropriate topic/trust classification.
- Stopping condition: Stop after 10 sources pass all checks (two in each category), or when remaining candidates cannot be verified within the approved scope; report any shortfall.
- Working directory: docs/reports/2026-10-17/gpt-5/.

## Outcome

Added 10 feeds, two for each selected category. All 10 passed project-safe HTTPS/TLS, same-host, XML content-type, and RSS parsing checks. All had at least one item within the configured 24-hour freshness window during the final validation pass. All used zero redirects; source endpoint responses were HTTP 200. Two other candidates were excluded because their feeds had no fresh entries at validation time (Federal Reserve and GamesIndustry.biz). Candidate evidence and dead ends are logged in news-source-sources.tsv.
