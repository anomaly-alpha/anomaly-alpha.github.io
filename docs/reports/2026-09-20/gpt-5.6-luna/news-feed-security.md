# News Feed URL Security Review

Date: 2026-09-20

## Answer

At the feed-endpoint level, the current configuration is mostly secure but not uniformly reliable. Of 150 configured HTTPS RSS/Atom URLs, 137 passed the strict baseline, two use same-host redirects, one returned a 403 HTML response, and ten timed out. No responding endpoint failed TLS certificate verification, and no observed remote IP was private or link-local.

This is an endpoint and publisher-posture review, not a guarantee that any publisher website or organization is free of vulnerabilities. The complete per-URL evidence is in `news-feed-security-sources.tsv`.

## Baseline and method

- Reviewed the current uncommitted `skarn-rpc/data/news-sources.json` configuration.
- Tested each URL once over HTTPS with redirect following, a five-second connection limit, a twelve-second total limit, and no response-body retention.
- Recorded HTTP status, final URL, redirect count, TLS verification result, content type, resolved IP, latency, and response size.
- Compared every observed endpoint against the declared host and the runtime configuration validator.
- Classified sources using the configuration's `trustClass`: 129 official and 21 publisher-class. That classification is not an independent reputation or vulnerability verdict.

## Findings

### Transport and content

137 feeds were clean under the strict endpoint policy: verified HTTPS/TLS, 2xx response, accepted XML content type, no redirect, and a final host matching the declared host (C1). All 139 HTTP 200 responses returned an accepted XML feed content type. The runtime configuration validator accepted all 150 configured sources (C6).

CrowdStrike redirects twice to another path on the same declared host, and Slack Engineering redirects once to a trailing-slash URL (C2). These are not cross-host security failures, but canonicalizing the feed URLs would reduce dependency on redirect behavior.

CISA returned HTTP 403 with `text/html`, so the endpoint was protected or denied to this client and was not verified as a usable feed (C3). Ten feeds timed out with curl exit 28 (C4); those results establish an availability gap, not a TLS weakness.

Every responding endpoint reported a successful TLS verification result, and no observed remote IP was private or link-local (C5). This supports the service's HTTPS and allowlist boundary, but DNS, certificates, and availability can change over time.

### Publisher posture

The 129 official sources are first-party organizational, project, or release feeds according to the configuration. The 21 publisher-class sources are reputable-looking external publications or specialist publishers, but they should be treated as content sources rather than trusted authorities for every claim (C7). The feed parser correctly treats titles as untrusted text; publisher classification must not bypass sanitization or allow arbitrary redirects.

### Configuration risk

The current worktree enables news mode for all 150 feeds. This materially expands outbound requests and untrusted-content exposure compared with the earlier 15-feed configuration. The seven-day freshness window and 1,500-item bounded state are safe from unbounded growth, but they increase stale-content and review burden. The current implementation's fixed host allowlist, HTTPS-only client, redirect revalidation, response limits, XML content-type checks, title sanitization, and owner-only state are the right controls for this design.

## Recommended disposition

1. Keep the immutable host allowlist and fail closed on any cross-host redirect.
2. Canonicalize the CrowdStrike and Slack feed URLs to their final same-host paths.
3. Quarantine or retest the ten timeout feeds and the CISA 403 before treating them as production-ready.
4. Consider leaving the 150-feed rollout disabled until the timeout/403 set is resolved; 150 sources is a large attack and reliability surface for a single Discord presence.
5. If the threat model includes hostile DNS or local resolver compromise, add DNS-resolution checks that reject private/link-local destinations; this probe only observed public IPs and did not pin future DNS answers.
6. Repeat this check periodically because TLS, redirects, WAF policy, feed content type, and publisher ownership can change.

## Limitations

- One probe per URL is a snapshot, not an uptime or certificate-history measurement.
- DNS rebinding and future resolver changes were not tested; the runtime currently validates hostnames and literal IP URLs, not the eventual address selected for every DNS lookup.
- No penetration testing, exploit attempts, credential testing, or intrusive scanning was performed.
- Publisher trust was assessed from configured source metadata and domain identity, not from a full organizational security audit.
