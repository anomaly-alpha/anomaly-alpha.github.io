# Auto-update promo codes daily (GitHub Actions + Gemini web search)

**Status:** implemented
**Date:** 2026-11-19
**Owner:** repo maintainer

## Goal

Keep `data/codes.json` current without manual polling: a scheduled GitHub Actions job
searches the web once a day, stages everything it can verify, publishes only what the
publisher has dated, and leaves the rest in a review queue.

## Constraints

- **Static hosting.** GitHub Pages has no server runtime, so "daily" means a scheduled
  workflow that commits to `main`; Pages rebuilds from the branch.
- **`dateAdded` is the publisher's release date.** Aggregator "added" dates are
  forbidden (they lag 3–10 days and previously made the site trail real drops).
  Therefore a code with no publisher date can never be auto-published, however many
  sites list it.
- **Patch notes carry the code, not the reward.** The Ubisoft help-centre article ends
  with `Reward Code: XXX` and the date lives in the slug; gems/tickets/hero rewards are
  published elsewhere. A verified reward must come from a second source.
- **No auto-expiry.** Nothing publishes expiry dates, so the job flags stale codes but
  never marks them expired.
- **No secrets in the repo.** The Gemini key lives in the `GEMINI_API_KEY` repo secret
  and is never written to a file.

## Architecture

```
GitHub Actions (cron 06:23 UTC, workflow_dispatch)
        │
        ├─ scripts/lib/patch-notes.js   official harvest (authoritative)
        │     section index → articles → "Reward Code: X" + date from slug
        │
        ├─ scripts/lib/gemini.js        Interactions API + google_search tool
        │     returns candidate codes, rewards, source URLs
        │
        ├─ scripts/harvest-codes.js     verify → decide → write
        │     ├─ verify: fetch every cited URL, require the code in the page text,
        │     │          extract the reward from a ±200 char window
        │     ├─ auto-add: official date + gem/ticket reward verified
        │     ├─ auto-fix: wrong dateAdded on an active code
        │     └─ queue: everything else → data/code-candidates.json
        │
        ├─ npm run update-codes        regenerate guide/index/FAQ/sitemap
        ├─ tests                       promo generator + source drift
        └─ commit + push + rolling issue "Promo code review queue"
```

## Decision rules

| Situation | Action |
|---|---|
| Official patch-note code, gem/ticket reward verified on a cited page | **Auto-add** with publisher date, `tier: HIGH` |
| Official patch-note code, reward unknown or item/hero | Review queue |
| Code only found on the web (no publisher date) | Review queue, with evidence |
| Active code whose `dateAdded` differs from the publisher | **Auto-fix** date |
| Code marked expired but shipped within 120 days | Flag only |
| Active code older than 120 days | Flag for expiry review, never auto-expire |
| LLM unavailable / no key | Official-only run, no failure |

Auto-add is deliberately narrow: it fires only when both halves are verifiable, which is
the common case for update codes (most are 500 gems).

## Files

| File | Change |
|---|---|
| `scripts/lib/patch-notes.js` | New. Shared harvest + slug/date parsing, extracted from `check-code-sources.js` |
| `scripts/check-code-sources.js` | Refactor to use the shared lib; behaviour unchanged |
| `scripts/lib/gemini.js` | New. Interactions API client, JSON-schema response, citation parsing, retry |
| `scripts/harvest-codes.js` | New. Orchestrator, verification, merge, report writer |
| `data/code-candidates.json` | New. Review queue with provenance and status |
| `tests/harvest-codes.test.js` | New. Offline tests for parsing, verification, merge rules |
| `.github/workflows/update-codes.yml` | New. Daily schedule, commit/push, issue maintenance |
| `AGENTS.md` | File table + commands + a short "Code automation" section |
| `docs/guides/2026-11-19/deepseek-v4.1-flash-free/code-automation-setup.md` | New. Secret setup, manual runs, troubleshooting |

## Workflow

- `on.schedule` cron `23 6 * * *`, plus `workflow_dispatch` with `dry_run`.
- `permissions: contents: write, issues: write`; `concurrency` group prevents overlap.
- `npm ci` → `node scripts/harvest-codes.js --report "$RUNNER_TEMP/codes.md"` →
  `npm run update-codes` → tests → commit only the generated code files (including all
  guide pages whose `[Mon YYYY]` token the generator syncs) → push with a rebase retry →
  update the rolling issue from the report.
- `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` (grounding-capable, cheapest).
- A failed Gemini call logs a warning and continues with the official source only.

## Verification

1. `npm run check-codes` before and after the refactor → identical output.
2. `node scripts/harvest-codes.js --dry-run --no-llm` → harvests live patch notes, no writes.
3. `node tests/harvest-codes.test.js` → offline unit tests pass.
4. `npm run update-codes` → generator still succeeds; `git diff` limited to expected files.
5. Manual `workflow_dispatch` with `dry_run: true` → report in the job summary, no commit.
6. After the first live run: exactly one commit, Pages rebuild, code page shows the new count.

### Results (2026-11-19)

- `npm run check-codes` → `OK - data/codes.json agrees with every patch note that carries a code.`
- Live dry run → 30 articles scanned, 20 with codes, 0 fetch failures, 0 writes.
- `node tests/harvest-codes.test.js` → passed (slug dates, reward windows, publication rules, URL safety, stubbed verification, model JSON, top-of-list insertion).
- `npm run update-codes` → byte-identical output (idempotent), 37 active / 30 expired.
- End-to-end run with every outbound call stubbed → a publisher-dated code with an
  aggregator-verified 500-gem reward was auto-added, inserted at position 1, and emitted
  by the generator as active code 38; a model-claimed code absent from its cited page was
  queued as `(unverified)`. Data and generated files were restored byte-for-byte afterwards.
- Gemini's live call path is still unexercised locally because no key is available; the
  workflow's `dry_run` dispatch is the first live check.

## Risks

| Risk | Mitigation |
|---|---|
| LLM hallucinates a code | Every candidate must appear verbatim on a fetched page; unverifiable ones are dropped |
| Wrong reward published | Auto-add only accepts gem/ticket rewards confirmed in the source text; items go to review |
| Aggregator date leaks in | Publisher slug date is the only auto-used date |
| Workflow pushes over a human commit | Rebase retry; `concurrency` group; failure is visible in Actions |
| Secret missing | Job runs official-only and says so in the summary |
| Prompt injection from a scraped page | The LLM never executes page content; the verifier only string-matches, and only official-dated codes can auto-publish |

## Rollback

Delete `.github/workflows/update-codes.yml` to stop automation. The site keeps working
because `data/codes.json` stays the hand-editable source of truth; `data/code-candidates.json`
can be deleted without affecting the build.
