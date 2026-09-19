# Skarn Warmaster Discord Rich Presence

> Status: Draft — product and operational decisions recorded; ready for implementation planning
> Date: 2026-09-19
> Designer identity: Information Designer with a Product UI overlay
> Research: internal research notes (not included in this repository)

## Grounding

I am treating Warmaster as a compact editorial companion: a presence that gives profile viewers a brief, legible glimpse of what Skarn is watching, thinking, or judging. It is not a game lobby, a private-activity tracker, or a substitute for a news reader. The design preserves the ancient, dryly theatrical voice while making state changes meaningful.

Owner decisions recorded for this draft: focused technology/science/space/games/AI/release news; factual headline plus a short Skarn reaction; fresh news interrupts ambient presence and dwells; sleep follows America/Toronto local time; no links or buttons in the first release; news state lives inside skarn-rpc with balanced retention; feed shortlist is selected from evidence-based official endpoints; publication is latest-wins single-flight; one trusted allowlisted source is sufficient for high-salience news.

## 1. Objective

Make Skarn's Discord presence feel alive, intentional, and worth glancing at without becoming a noisy ticker. A viewer should understand the current signal in one quick read: what Skarn is presenting in the first line, and why it matters or how fresh it is in the second. The quality bar is a polished companion experience with deterministic safety and graceful degradation, not merely a process that calls Discord IPC.

## 2. Product context

Skarn is a local Node service supervised by a user-level systemd unit. It publishes Discord Rich Presence through local IPC. The current renderer rotates a details line and a state line every 10 seconds, selects a mood for roughly 10 minutes, reads a validated shared catalog of 5,000 phrases, and maps entries to 130 uploaded small-image icons.

Primary audience: people who encounter the owner's profile and want a brief, distinctive signal. Secondary audience: the owner, who should be able to tune the presence without editing renderer logic.

Adjacent references: Navidrome's lifecycle-aware media presence, Obsidian-Presence's semantic modes and privacy controls, Cord.nvim's event-driven and icon-rich architecture, and JSON-configured rotating RPC managers. Distant reference: generic custom-status scripts that maximize arbitrary churn without semantic state.

## 3. Visual foundations

This is not a web page; the design system is the Discord activity card's information hierarchy.

### 3.1 Information hierarchy

1. App name: stable Discord application identity.
2. Large image: stable Skarn/Warmaster identity; do not churn it with every phrase.
3. Details: current signal, subject, or scene. It must be understandable alone.
4. State: consequence, mood, freshness, source, or availability. It must add information.
5. Small image: one semantic visual classification for the current signal.
6. Tooltips: source, topic, icon meaning, or secondary metadata.
7. Timestamp/buttons: optional enhancements only when their meaning is honest and the installed RPC wrapper supports them.

### 3.2 Content geometry

- Details and state are one-line snippets, not prose paragraphs.
- Target 2–96 UTF-8 bytes; enforce the hard 128-byte legacy IPC limit.
- Enforce a 32-byte hard limit for image keys and 128 bytes for hover text.
- Prefer compact grammar such as 'News · short headline' and 'Topic · age · source'.
- Do not depend on emoji characters in the text lines for meaning; the uploaded small image is the primary icon channel.

### 3.3 Icon language

Keep the large image stable as Skarn's identity. Assign the 130 small-image assets to semantic roles:

| Role | Example icon families | Meaning |
|---|---|---|
| Attention | eye, warning, exclamation, flag | urgent or high-salience signal |
| Knowledge | book, file, graph, info, piechart | analysis, research, evidence |
| Movement | forward, arrow, motion, refresh | change, release, transition |
| Time | clock, pause, sleep, rewind | freshness, stale state, dormancy |
| Mood | heart, dislike, mug, ghost, sun | ambient personality |
| World | earth, star, rain, wind, tree | science, environment, world context |

An icon is chosen for semantic recognition at compact size, not decorative variety. Each icon needs a human-readable tooltip label and a stable catalog role.

## 4. Accessibility and legibility

- Text must fit on one line in Discord's compact profile view where reasonably possible.
- Content must remain understandable if the small image fails to load or is unfamiliar.
- Do not use the icon as the only indicator of urgency, freshness, or system health.
- Use plain punctuation in fallback templates when Unicode rendering is uncertain.
- Test representative activities in Discord desktop and mobile/profile-popout views.
- Review icons at compact size for recognizability and distinction from their nearest semantic neighbor.
- Avoid needless update churn; the card cannot be made accessible by relying on animation settings.

## 5. Voice and tone

Register: concise, observant, ancient, dryly dramatic. The voice should feel authored, not randomly sarcastic.

Use concrete nouns, short verdicts, restrained in-character reactions, and source/age labels for news. Avoid generic motivational language, alarmist certainty, fake personal activity, repetitive use of 'mortal', 'ancient', or 'patience', and empty phrases such as 'unlock', 'seamless', or 'next level'.

Template examples, not live headlines:

- 'News · Solar storm watch expanded' / 'Space · 12m · NOAA'
- 'Watching the northern front' / 'Patterns remain ugly'
- 'Release detected · Rust 1.92' / 'Tools · 31m · official feed'
- 'Catalog gone feral' / 'Fallback phrases only'
- 'Discord absent' / 'Presence waits in silence'

## 6. Implementation practices

### 6.1 Signal classes

Represent every publishable activity as a candidate with class, details, state, assets, tooltips, source ID, timestamps, mood, topic, confidence, safety decision, content hash, and recent-use keys.

Candidate priority:

1. system failure or recovery;
2. high-confidence fresh news;
3. ordinary fresh news;
4. ambient phrase;
5. quiet/clear policy.

The scheduler publishes only when the activity hash changes or a meaningful state transition occurs. The existing 10-second loop may remain as a local scheduler tick, but it must not force identical Discord updates. Publication must be single-flight: await the setActivity Promise, serialize the next candidate behind the current response, apply a timeout, record rejection, and never allow overlapping updates or unhandled Promise failures.

### 6.2 News pipeline

Start with these five manually allowlisted official RSS/Atom sources in the focused canon; the current tracked registry extends the set to 15 approved sources:

- NASA Breaking News: https://www.nasa.gov/news-release/feed/ — science and space.
- GitHub Changelog: https://github.blog/changelog/feed/ — developer tooling and releases.
- OpenAI News: https://openai.com/news/rss.xml — AI releases and research/company news.
- Rust Blog: https://blog.rust-lang.org/feed.xml — language and developer releases.
- PlayStation Blog: https://blog.playstation.com/feed — games and platform news.

Use stable Atom IDs or RSS guids for deduplication, canonical URLs as fallback, and published/updated timestamps for age. Persist ETag and Last-Modified values for conditional polling.

Tavily or GDELT may assist with discovery and enrichment, but neither should be queried on every display tick. GDELT is a discovery layer with approximately 15-minute freshness; RSS/Atom publisher feeds remain canonical for an emitted story.

Every candidate must pass source allowlisting, redirect revalidation, valid non-future timestamp, maximum age, deduplication, HTML/control-character stripping, instruction-like-text removal, byte-length checks, topic/icon mapping, source/age labeling, and safe fallback handling.

Article text is untrusted data. It must never be interpreted as configuration, executable instructions, or a request to expose private information.

### 6.3 Rotation and cooldowns

- News interrupts ambient mode and remains visible for the configured dwell or until superseded by a higher-confidence story; it is not forced out after one 10-second tick.
- Ambient phrases rotate only after their dwell time.
- Reject the last N phrase hashes, icon-topic pairs, and near-duplicate strings.
- Apply per-topic and per-icon cooldowns.
- Prefer meaningful transitions over random changes.
- Log selection reason, source class, age bucket, and rejection reason without raw article bodies or secrets.

### 6.4 Discord payload

- Set a stable large image and tooltip.
- Set a semantic small image and tooltip from the icon registry.
- Use an honest elapsed timer or omit the timestamp. The installed discord-rpc 4.0.1 wrapper converts Date values to milliseconds and passes numeric values through, so timestamp representation must be verified with an integration test before rollout. Never use a fixed epoch-like value.
- Do not add party data unless the product has real party semantics.
- The installed wrapper supports buttons, but it does not expose newer details/state/asset URL fields; first release uses no buttons or clickable links.
- Clear or downgrade the activity when Discord disconnects, content becomes stale, or the service enters quiet mode.

### 6.5 Configuration ownership

Keep policy in validated data files:

- presence contract: mood windows, weights, dwell, rotation cadence;
- icon registry: key, label, role, topic families;
- phrase catalog: phrase ID, mood, details, state, icon role;
- news sources: domain, feed URL, topic, trust class, poll cadence, maximum age;
- content policy: blocked patterns, length limits, and fallback behavior.

Confirmed ownership: keep the news poller in the skarn-rpc process, poll on a slow independent timer, and store bounded owner-only cache/validator state under skarn-rpc/data/. If polling grows beyond one process or needs independent scheduling, move it to a separate user service without changing the renderer contract.

Initial retention: show stories for at most 6 hours, retain up to 50 normalized candidates, and retain runtime logs for 7 days or 10 MB, whichever comes first.

Runtime validation must use UTF-8 byte length through Buffer.byteLength, validate icon keys before candidate construction, and treat the verifier as a build-time check rather than the only runtime guard. Prefer journald with configured retention or a bounded rotating file; do not append to an unbounded log forever.

## 7. Anti-patterns

- No 10-second news ticker. It is too fast for reading and encourages unnecessary IPC traffic.
- No arbitrary feed URLs. The presence must not become a redirect or content-injection tunnel.
- No raw headlines without length, age, source, and safety handling.
- No phrase churn that leaves details and state semantically unrelated.
- No icon roulette. Every icon needs a role and a reason for appearing.
- No fake party size, join state, private-message reference, or user-specific claim.
- No fixed timestamp that implies an ancient session when the activity just changed.
- No unbounded local log growth.
- No model-generated copy emitted directly without deterministic validation and fallback.

## 8. Decision-making

1. Safety and privacy outrank freshness.
2. Legibility outranks cleverness.
3. Truthful state outranks theatrical state.
4. Meaningful change outranks random change.
5. Stable identity outranks visual novelty.
6. Owner-approved editorial voice outranks generic news style, while source labels and age remain mandatory for news.
7. Degrade to a safe ambient phrase when an external dependency is stale, unavailable, or ambiguous.

## 9. Workflow

1. Choose candidate class: system, news, ambient, or quiet.
2. Load it from the validated contract, catalog, or source cache.
3. Sanitize and validate source, freshness, text bytes, icon key, and tooltip lengths.
4. Score novelty, cooldowns, mood fit, topic fit, and priority.
5. Build the complete payload with stable large and semantic small assets.
6. Compare its content hash with the last published activity and skip identical payloads.
7. Publish through Discord IPC and handle the response before another command.
8. Record bounded structured diagnostics without secrets or raw untrusted content.
9. Run desktop/mobile rendering checks and deterministic snapshot tests for every state class.

## Experience structure

### Default ambient state

Large image: stable Skarn logo. Details: concise observation or scene. State: short verdict or mood consequence. Small image: mood/topic icon. Tooltip: icon label and optional mood label.

### News state

Large image: stable Skarn logo. Details: 'News · short canonical headline'. State: 'Topic · age · source'. Small image: topic or urgency icon. Tooltip: source name, story ID, or canonical URL only if link policy is approved.

### System state

- connecting: 'Discord absent' / 'Retrying quietly'
- fallback: 'Catalog unavailable' / 'Static phrases only'
- stale news: 'No fresh signal' / 'Watching the old world'
- dormant: 'Warmaster dormant' / 'Wake window pending'

## Acceptance criteria

- Every emitted details/state pair is one line and within hard byte limits.
- Every small image key exists in the local registry and uploaded-asset contract.
- No identical activity payload is sent twice in a row.
- News candidates are allowlisted, timestamped, deduplicated, age-checked, sanitized, and source-labeled.
- Feed failure, Discord absence, invalid catalog, and stale news have deterministic fallbacks.
- Mood, topic, icon, and phrase cooldowns prevent immediate repetition.
- The fixed epoch timestamp is removed or replaced with a wrapper-verified honest elapsed-time value; a Date-versus-number integration test records the chosen unit.
- The presence makes no private user, guild, channel, message, or party claims.
- Logs are structured, bounded/rotated, and free of credentials, tokens, raw secrets, and uncontrolled article bodies.
- Desktop and mobile/profile-popout render checks pass for ambient, news, system, dormant, and fallback states.
- Owner approves the decision set in the review section before implementation begins.

## Review findings and gaps

1. Rollout is a sequencing choice: reliability and phrase improvements first, then news, or one unified change. Default: reliability, phrase/icon layer, then news.
2. Measurement is a tuning choice: owner rating plus local metrics for repetition, freshness, icon reuse, and connection health. Default: collect both without external analytics.
3. Asset review remains a QA task: all 130 icons may enter the catalog, but illegible or semantically ambiguous icons can be demoted to tooltip-only use.
4. Timestamp representation is a compatibility risk: the installed discord-rpc 4.0.1 package supports buttons and timestamps, but Date values are converted to milliseconds while numeric values pass through unchanged. The implementation needs a wrapper-level integration test.
5. Runtime enforcement is underspecified: Buffer.byteLength checks, icon-key validation, and log retention must be implemented at runtime rather than left to the catalog verifier.
6. Disconnect semantics need correction: while IPC is disconnected, Discord cannot display a new 'Discord absent' activity. That state is internal diagnostics until reconnection; the service can publish a recovery/fallback state after reconnecting.
7. The existing 01:00–07:00 UTC sleep contract must be replaced or wrapped with America/Toronto timezone logic and daylight-saving handling.

## Decision trace

1. **Stable large image, semantic small image.** Discord recommends consistent large artwork and per-state small artwork. Alternatives were rotating both assets or using one static icon. Tradeoff: the large image provides less novelty, so icon roles and tooltips must carry more variation.
2. **Details for signal, state for consequence/freshness.** This matches Discord's field semantics and prevents duplicate lines. Alternatives were two halves of one sentence or mood-first fields. Tradeoff: factual content may feel less poetic.
3. **Event-driven publication with slower ambient dwell.** Comparable projects expose meaningful state changes and stale clearing. Alternatives were random 10-second rotation or a fixed global timer. Tradeoff: unchanged output must feel intentional.
4. **RSS/Atom as canonical news, Tavily/GDELT as discovery.** Stable IDs, timestamps, validators, and attribution are easier to govern than uncached search output. Alternatives were Tavily-only, GDELT-only, or phrases-only. Tradeoff: the news layer is less broad and immediate.
5. **Allowlist and deterministic safety gates.** The presence is public and external content is untrusted. Alternatives were trusting all feeds or relying on a model alone. Tradeoff: some legitimate stories will be delayed or rejected.
6. **No party data in the first release.** Skarn has no real party semantics and party data can replace the visible state line. Alternatives were a fake one-person party or a real join system. Tradeoff: no party UI affordance.
7. **Draft-first rollout: reliability, content, then news.** Connection health, timestamps, deduplication, queueing, and bounded logs are prerequisites for judging appeal. Alternatives were launching news first or rewriting everything. Tradeoff: the first visible upgrade is less dramatic.

## Owner decisions required

Product decisions are resolved as follows:

1. News universe: focused technology, science, space, games, AI, and major releases.
2. Editorial stance: factual headline plus a short Skarn reaction.
3. Timing: fresh news interrupts ambient presence and dwells for a readable period.
4. Sleep: America/Toronto local time, including daylight-saving behavior.
5. Interaction: no buttons or clickable links in the first release.

Technical decisions now have defaults:

6. News cache: inside skarn-rpc, owner-only bounded state.
7. Retention: 6-hour story age, 150 candidates, and 7 days or 10 MB of runtime logs.
8. Feed shortlist: 15 approved sources maintained in data/news-sources.json, beginning with NASA Breaking News, GitHub Changelog, OpenAI News, Rust Blog, and PlayStation Blog.
9. Publish queue: latest-wins single-flight with awaited responses, timeout, and rejection handling.

10. News trust: one trusted allowlisted source is sufficient; source and age remain visible in the news state.

## References

- Research report: internal research notes (not included in this repository)
- Discord Rich Presence best practices: https://docs.discord.com/developers/rich-presence/best-practices
- Discord Rich Presence fields and assets: https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence
- Discord Embedded App Rich Presence rendering: https://docs.discord.com/developers/rich-presence/using-with-the-embedded-app-sdk
- Discord legacy IPC limits and lock-step guidance: https://raw.githubusercontent.com/discord/discord-rpc/master/documentation/hard-mode.md
