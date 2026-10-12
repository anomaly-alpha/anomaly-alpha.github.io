# Triple Skarn news feeds and cache

> Generated 2026-09-19 · depth: deep · 100 additions · workspace: research/feed-expansion-150-2026-09-19/

## Executive summary

- Skarn now has 150 configured HTTPS RSS/Atom feeds and a 1,500-item bounded cache.
- The 100 additions are led by 73 validated GitHub release feeds from the package-manager OPML, plus 27 validated developer, security, technology, and science feeds.
- The live poll completed with no errors and produced 699 accepted items from 88 contributing sources under the seven-day freshness gate.
- The cache is a ceiling, not a guaranteed count: quiet or stale feeds do not create placeholder items.
- Eight-feed bounded concurrency makes the 150-source poll practical without turning the 30-second display cycle into a 150-site request storm.
- Weighted random selection and a 20-item recent-ID history now make the headline stream less deterministic and reduce immediate repeats.

## Evidence and sources

Discovery used Tavily and curated OPML sources; direct validation used the runtime feed client and parser.

- Package-manager OPML: https://raw.githubusercontent.com/ecosyste-ms/package-managers-opml/main/package-manager.opml
- Technology OPML: https://raw.githubusercontent.com/tuan3w/awesome-tech-rss/main/feeds.opml
- Security OPML: https://raw.githubusercontent.com/phretor/infosec-opml/main/feeds.xml

## Operational limits

The service remains active with zero restarts. Feed polling runs every 15 minutes, with up to eight requests in flight. Headline dwell remains 30 seconds. The seven-day fresh-news gate and explicit HTTPS host allowlist remain enabled.
