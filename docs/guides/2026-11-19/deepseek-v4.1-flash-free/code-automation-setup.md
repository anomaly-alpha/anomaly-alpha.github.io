# Code automation setup

The daily sync lives in `.github/workflows/update-codes.yml` and runs
`scripts/harvest-codes.js`. It publishes only what the publisher dated, and queues
everything else for review.

## One-time setup

1. **Create a Gemini API key** at <https://aistudio.google.com/apikey>.
2. **Add it as a repository secret:** GitHub → Settings → Secrets and variables →
   Actions → New repository secret → name `GEMINI_API_KEY`.
3. **Optional model override:** add a repository *variable* `GEMINI_MODEL`. The default is
   `gemini-3.5-flash-lite`, which supports Google Search grounding and is the cheapest
   grounded model.
4. **Confirm Pages is branch-deployed:** Settings → Pages → Source should be
   *Deploy from a branch* → `main` → `/ (root)`. The workflow pushes to `main`, which
   triggers the Pages rebuild. If Pages is set to *GitHub Actions*, a push alone will not
   deploy and a deploy workflow is required.
5. **Actions must be enabled** for the repository (they are by default on public repos).

Without the secret the job still runs, harvests the publisher, and reports that the web
search step was skipped. It does not fail.

## Manual runs

- Actions → **Update promo codes** → **Run workflow**.
- Tick `dry_run` to compute everything, write the report to the job summary, and skip
  writing, committing, and the issue update.
- Local dry run:

  ```bash
  GEMINI_API_KEY=... npm run harvest-codes -- --dry-run
  npm run harvest-codes -- --dry-run --no-llm   # publisher only, no key needed
  ```

## What gets committed

`data/codes.json`, `data/code-candidates.json`, and the generated code surfaces
(`data/generated/promo-codes.js`, `guide/code/index.html`, `guide/faq/index.html`,
`index.html`, `sitemap.xml`).

A commit happens only when something changed. The job also updates the rolling
`Promo code review queue` issue and closes it when the queue is empty.

## Resolving a queued code

1. Open the review issue and check the evidence links.
2. Add the code to `data/codes.json` by hand:

   ```json
   { "code": "ABCDE", "gems": 500, "tickets": 0, "tier": "HIGH", "dateAdded": "2026-11-18" }
   ```

   `dateAdded` must be the publisher's date. For item or hero rewards use the existing
   `rewards[]` shape and run the generator to confirm it renders.
3. `npm run update-codes`, then commit and push.
4. The next scheduled run sees the code in `data/codes.json` and marks the queue entry
   `resolved`, which removes it from the issue.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Gemini HTTP 429` in the report | Quota or rate limit. The job continues publisher-only; re-run later. |
| `Gemini HTTP 400` mentioning `response_format` | The client retries once without the schema automatically. If it persists, the model string is wrong. |
| No review issue appears | The job needs `issues: write`; check the workflow permissions block. |
| Push rejected | The workflow rebases and retries three times. Persistent rejection usually means branch protection blocks `github-actions[bot]`. |
| Scheduled runs stop after a while | GitHub disables schedules after 60 days without repository activity. Re-enable the workflow from the Actions tab. |
| Report says `no reward found next to the code` | The reward source had not been indexed yet. It is retried daily and stays queued. |
| Report says `no publisher date` | A web-only code. It will never auto-publish; confirm it by hand. |

## Cost

One grounded interaction per day. Gemini 3 and newer bill grounding per search query, with
5,000 free search requests per month shared across those models; a run that issues a
handful of queries stays inside the free tier. Check the current Gemini API pricing if the
prompt or model changes.
