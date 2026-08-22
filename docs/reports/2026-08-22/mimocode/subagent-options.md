# MiMoCode subagent options

## Context

The global MiMoCode config currently defines `build`, `plan`, `compose`,
`general`, and `explore`, all on `opencode-go/mimo-v2.5`. The project is a
static HTML/CSS/JavaScript site with no test framework. Its documented
verification path is manual browser QA plus Lighthouse audits across the site.

That makes a browser-verification role the largest uncovered capability;
another broad implementation or exploration agent would mostly duplicate the
existing setup.

## Candidate roles

### `browser-qa` / `browser-debugger`

Reproduce UI behavior in a real browser, exercise important flows, inspect
console and network output, capture screenshots or traces, and report exact
steps and evidence. This directly matches the repository's manual-QA process.

Playwright documents browser automation for agent workflows and provides traces
with action timelines, DOM snapshots, screenshots, and network evidence.

### `reviewer`

Run an independent, read-only diff review focused on correctness, regressions,
security, and missing validation. This is a strong general-purpose gate before
completion, but it overlaps with the existing review skills more than browser
QA does.

### `security-reviewer`

Perform a targeted secure-code review for inline JavaScript, DOM sinks, third-
party scripts, secrets, and security headers. OWASP recommends diff-based review
that checks new attack vectors, changed trust boundaries, and security
regressions. This is valuable but should be invoked for security-sensitive
changes rather than every UI edit.

### `seo-a11y-reviewer`

Check canonical/OG/Twitter metadata, structured data, sitemap/robots, semantic
markup, accessibility, and Lighthouse scores. It fits the site's SEO-heavy
purpose, but Lighthouse already covers the main automated categories and the
existing project has dedicated SEO/accessibility skills.

## Decision

Define `browser-qa` first. Give it read-only access plus Playwright, Bash, and
targeted file-reading tools. Its output should be an evidence report, not a
patch: pages and flows tested, exact reproduction steps, console/network
errors, screenshots or traces, and Lighthouse results when relevant.

Use `opencode-go/mimo-v2.5` (or the `lite` group, which currently resolves to
that model). Add `reviewer` second if you want a mandatory pre-completion gate.
Defer `security-reviewer` and `seo-a11y-reviewer` until the corresponding
change type appears frequently enough to justify separate prompts.

> **Superseded:** The recommendation above to defer `security-reviewer` and
> `seo-a11y-reviewer` was superseded by the approved model-routing spec
> (`docs/specs/2026-08-22/gpt-5.6-luna/model-routing-luna-mimo.md`), which
> defines all four specialist agents—`browser-qa`, `reviewer`,
> `security-reviewer`, and `seo-a11y-reviewer`—immediately.

## Sources

- OpenAI Codex subagents: https://developers.openai.com/codex/agent-configuration/subagents
- Claude Code custom subagents: https://code.claude.com/docs/en/sub-agents
- Playwright: https://playwright.dev/docs/best-practices and https://playwright.dev/docs/trace-viewer
- Chrome Lighthouse for agents: https://developer.chrome.com/docs/devtools/agents/use-cases/lighthouse-audit
- OWASP secure code review: https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html
- Project workflow: `AGENTS.md`
