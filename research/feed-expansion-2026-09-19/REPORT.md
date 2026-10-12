# Expand Skarn news to 50 validated feeds

> Generated 2026-09-19 · depth: deep · 35 added candidates · workspace: research/feed-expansion-2026-09-19/

## Executive summary

- The catalog now contains 50 configured HTTPS RSS/Atom sources, adding 35 feeds across AI, developer/cloud, security, science, gaming, and technology coverage [1]-[35].
- Direct validation found usable XML responses for 48 sources on the first 15-second pass; Dark Reading and Phys.org returned HTTP 200 on a retry and remain admitted with a transient-timeout note [19][27].
- The cache ceiling is now 500 items, with a 10-item-per-source balance so high-volume feeds cannot monopolize the stream [1]-[35].
- The fresh-news acceptance window is now up to seven days; item age remains rendered in Discord, and retroactive mode remains a separate policy [1]-[35].
- Tavily was used for discovery only. Runtime ingestion continues through native HTTPS, explicit host allowlists, XML content-type checks, sanitization, and bounded state.
- The 30-second headline dwell is separate from 15-minute feed polling; this creates a dense display cycle without polling 50 sites every 30 seconds.

## Background & scope

The request was to expand the existing 15-feed Skarn pipeline to 50 total sources and sustain a high-volume 30-second display stream. Existing sources were retained. Candidates were selected from primary organizational feeds and reputable publishers, then directly validated for HTTPS, host allowlisting, XML content type, and parseability. No raw article bodies or discovery payloads were persisted.

## Selected additions

| Area | Added feeds |
| --- | --- |
| AI | Google DeepMind, NVIDIA Developer, Meta Engineering, PyTorch, Hugging Face, Apple Machine Learning Research [1]-[6] |
| Developer/cloud | Go, PostgreSQL, Ruby, CNCF, Docker, HashiCorp, JetBrains, Elastic, Grafana, Linux Foundation [7]-[16] |
| Security | BleepingComputer, Schneier on Security, Dark Reading, SecurityWeek, The Record, SANS Internet Storm Center, Tenable, Palo Alto Unit 42, CrowdStrike [17]-[25] |
| Science | ScienceDaily, Phys.org, Science News, New Scientist [26]-[29] |
| Gaming/technology | Polygon, Eurogamer, Rock Paper Shotgun, GameSpot, MacRumors, BBC Technology [30]-[35] |

## Runtime implications

The 50-source configuration is explicit and host-allowlisted. The state bound is 500 items, balanced at 10 per source. The feed client retains HTTPS-only retrieval, rejects IP hosts, validates XML content types, follows only allowlisted redirects, and records bounded diagnostics. The service currently preserves the existing top-level disabled rollout flag; adding sources does not silently turn fetching on.

## Open questions

- Some publisher feeds are transiently slower than the 15-second runtime request limit; the current retry evidence supports retaining Dark Reading and Phys.org, but their health should be monitored.
- Publisher feeds can change editorial scope or licensing terms; source review should be repeated periodically.
- A 500-item cache gives roughly 4 hours and 10 minutes of unique display slots at a strict 30-second dwell, assuming candidate selection advances through the available set.

## Sources

[1] Google DeepMind RSS — https://deepmind.google/blog/rss.xml (accessed 2026-09-19)
[2] NVIDIA Developer Blog — https://developer.nvidia.com/blog/feed/ (accessed 2026-09-19)
[3] Meta Engineering — https://engineering.fb.com/feed/ (accessed 2026-09-19)
[4] PyTorch — https://pytorch.org/feed/ (accessed 2026-09-19)
[5] Hugging Face Blog — https://huggingface.co/blog/feed.xml (accessed 2026-09-19)
[6] Apple Machine Learning Research — https://machinelearning.apple.com/rss.xml (accessed 2026-09-19)
[7] Go Blog — https://go.dev/blog/feed.atom (accessed 2026-09-19)
[8] PostgreSQL News — https://www.postgresql.org/news.rss (accessed 2026-09-19)
[9] Ruby News — https://www.ruby-lang.org/en/feeds/news.rss (accessed 2026-09-19)
[10] CNCF — https://www.cncf.io/feed/ (accessed 2026-09-19)
[11] Docker Blog — https://www.docker.com/feed/ (accessed 2026-09-19)
[12] HashiCorp Blog — https://www.hashicorp.com/blog/feed.xml (accessed 2026-09-19)
[13] JetBrains Blog — https://blog.jetbrains.com/feed/ (accessed 2026-09-19)
[14] Elastic Blog — https://www.elastic.co/blog/feed (accessed 2026-09-19)
[15] Grafana Labs Blog — https://grafana.com/blog/index.xml (accessed 2026-09-19)
[16] Linux Foundation Blog — https://www.linuxfoundation.org/blog/rss.xml (accessed 2026-09-19)
[17] BleepingComputer — https://www.bleepingcomputer.com/feed/ (accessed 2026-09-19)
[18] Schneier on Security — https://www.schneier.com/feed/atom/ (accessed 2026-09-19)
[19] Dark Reading — https://www.darkreading.com/rss.xml (accessed 2026-09-19)
[20] SecurityWeek — https://www.securityweek.com/feed/ (accessed 2026-09-19)
[21] The Record — https://therecord.media/feed (accessed 2026-09-19)
[22] SANS Internet Storm Center — https://isc.sans.edu/rssfeed_full.xml (accessed 2026-09-19)
[23] Tenable Blog — https://www.tenable.com/blog/feed (accessed 2026-09-19)
[24] Palo Alto Networks Unit 42 — https://unit42.paloaltonetworks.com/feed/ (accessed 2026-09-19)
[25] CrowdStrike Blog — https://www.crowdstrike.com/blog/feed/ (accessed 2026-09-19)
[26] ScienceDaily — https://www.sciencedaily.com/rss/all.xml (accessed 2026-09-19)
[27] Phys.org — https://phys.org/rss-feed/ (accessed 2026-09-19)
[28] Science News — https://www.sciencenews.org/feed (accessed 2026-09-19)
[29] New Scientist — https://www.newscientist.com/feed/home/ (accessed 2026-09-19)
[30] Polygon — https://www.polygon.com/rss/index.xml (accessed 2026-09-19)
[31] Eurogamer — https://www.eurogamer.net/feed (accessed 2026-09-19)
[32] Rock Paper Shotgun — https://www.rockpapershotgun.com/feed (accessed 2026-09-19)
[33] GameSpot — https://www.gamespot.com/feeds/mashup/ (accessed 2026-09-19)
[34] MacRumors — https://feeds.macrumors.com/MacRumors-All (accessed 2026-09-19)
[35] BBC Technology — https://feeds.bbci.co.uk/news/technology/rss.xml (accessed 2026-09-19)
