# Model Routing: Luna Primary Modes and MiMo Helpers

Status: Proposed; specification only. No configuration or application changes are included.

## [S1] Problem and current state

MiMoCode currently uses `opencode-go/mimo-v2.5` as the global default and for
all explicitly configured agents:

- Primary modes: `build`, `plan`, and `compose`
- Helper subagents: `general` and `explore`
- Cheap-task group: `lite`

The global configuration is `C:\Users\petra\.config\mimocode\mimocode.jsonc`.
The project config does not override model selection. The `free` model group is
out of scope and remains configured separately.

The TUI model state already records `openai/gpt-5.6-luna` with the `xhigh`
variant, but that state does not make Luna the configured model for the three
primary modes.

## [S2] Goals

1. Route `build`, `plan`, and `compose` through `openai/gpt-5.6-luna`.
2. Pin the `xhigh` variant for each of those three primary modes.
3. Keep `general` and `explore` on `opencode-go/mimo-v2.5` with the `high`
   variant.
4. Keep the `lite` group on `opencode-go/mimo-v2.5` so cheap tasks remain on
   the MiMo model.
5. Define four project-local specialist subagents—`browser-qa`, `reviewer`,
   `security-reviewer`, and `seo-a11y-reviewer` with the agreed model,
   permissions, skill map, triggers, and output contract in [S7].
6. Keep provider definitions, MCP servers, application files, unrelated project
   settings, and the existing recent/favorite model state unchanged.

## [S3] Proposed configuration

The implementation should make the following effective global settings:

```jsonc
{
  "model": "openai/gpt-5.6-luna",
  "model_groups": {
    "lite": "opencode-go/mimo-v2.5"
  },
  "agent": {
    "build": { "model": "openai/gpt-5.6-luna", "variant": "xhigh" },
    "plan": { "model": "openai/gpt-5.6-luna", "variant": "xhigh" },
    "compose": { "model": "openai/gpt-5.6-luna", "variant": "xhigh" },
    "general": { "model": "opencode-go/mimo-v2.5", "variant": "high" },
    "explore": { "model": "opencode-go/mimo-v2.5", "variant": "high" }
  }
}
```

This is a targeted edit to the existing global JSONC file plus four new
project-local agent prompt files. The JSONC edit must preserve the provider,
model catalog, `free` group, MCP definitions, comments, and unrelated settings.

## [S4] Routing behavior

- An explicit `agent.<name>.model` takes precedence for that agent.
- Therefore `general` and `explore` continue using MiMo even after the global
  default changes to Luna.
- Cheap tasks continue using `lite`, which remains MiMo because no legacy
  `small_model` override is configured.
- Future custom helper agents that must use MiMo should specify `model: lite`
  or the explicit `opencode-go/mimo-v2.5` model.
- The `free` group is unchanged and is used only when explicitly selected or
  referenced.
- `browser-qa`, `reviewer`, and `seo-a11y-reviewer` use `model: lite` with the
  `high` variant.
- `security-reviewer` uses `openai/gpt-5.6-luna` with the `xhigh` variant.
- Automatic delegation uses changed-file patterns plus task intent. Each
  specialist runs at most once per user task; findings do not recursively
  trigger more specialists.
- Read-only work may run in parallel. Write-capable agents run sequentially in
  the order selected by the primary agent.
- Reviewer execution is coalesced into one final pass after implementation and
  any specialist writes; it does not run repeatedly after each intermediate
  edit.

## [S5] Trade-offs and non-goals

This split gives the primary modes the higher-effort Luna route while keeping
parallel exploration and cheap background work on MiMo. The trade-off is that
`xhigh` may increase response time and usage; exact pricing and runtime limits
are provider-specific and are not changed by this specification.

The specification does not:

- Change `general`, `explore`, or `lite` away from MiMo.
- Change the `free` model group.
- Modify provider credentials, MCP configuration, or application code.
- Change the TUI recent/favorite model state unless verification demonstrates
  that the existing Luna entry is missing.
- Permit commits, pushes, broad refactors, new dependencies, or unscoped
  automatic fixes by specialist agents.

## [S6] Verification requirements

After implementation, verification must confirm:

1. `mimo models openai` registers `openai/gpt-5.6-luna`.
2. `mimo agent list` shows `build`, `plan`, and `compose` with Luna and
   `general`/`explore` with MiMo, plus all four specialist subagents.
3. The parsed effective configuration still resolves `lite` to
   `opencode-go/mimo-v2.5`.
4. `general`, `explore`, `browser-qa`, `reviewer`, and `seo-a11y-reviewer`
   resolve to MiMo with `high`; `security-reviewer` resolves to Luna with
   `xhigh`.
5. Reviewer and security agents are read-only; browser QA and SEO/a11y edits
   are limited to small, obvious, source-only fixes.
6. Automatic triggers use file patterns plus task intent and enforce one pass
   per user task.
7. Any specialist source edits are followed by one final reviewer pass.
   Verification follows `AGENTS.md`; generated build noise is reverted.
8. The project configuration and application worktree have no unrelated
   changes.
9. A new session or model re-selection is used if the current TUI has already
   pinned the previous primary model.

This is a configuration-only change; no application test suite is required.

## [S7] Specialist subagent definitions

Create these project-local files under `.mimocode/agent/`. Each file must use
`mode: subagent`, a clear trigger description, the model and variant specified
below, and a role-specific skill map. Specialist summaries return to the
conversation rather than creating reports by default.

All specialists follow these shared rules:

- Automatic invocation uses changed-file patterns plus task intent.
- Each specialist runs at most once per user task.
- The primary agent has final authority over findings and edits.
- No specialist may commit or push.
- Automatic fixes must be local, obvious, directly evidenced, and within the
  touched source-file scope. No new requirements, refactors, or dependencies.
- Generated files, reports, lockfiles, and unrelated configuration are not
  writable targets. Build commands may be used for verification, but generated
  noise is reverted.
- A failed verification stops further automatic specialist edits and returns a
  structured failure summary to the primary agent.
- Specialist summaries use this structure: status, trigger and scope, findings
  by severity, files changed, commands and results, and residual risks.

### `browser-qa`

Use automatically for UI-related changes to HTML, JavaScript, CSS, Tailwind
source/config, or interaction behavior. Test affected pages in a real browser,
exercise key flows, inspect console and network errors, capture screenshots or
traces when useful, and run relevant Lighthouse checks. Test local `file://` or
local-server behavior and the deployed URL when deployment or network behavior
matters.

Model and permissions:

- Model: `lite`; variant: `high`.
- Skills: Playwright and Lighthouse.
- May make small, obvious, directly evidenced fixes to touched source files.
- May not edit generated bundles, reports, lockfiles, or unrelated config.

### `reviewer`

Use automatically as the final review after implementation and any specialist
writes. Coalesce the review into one pass per user task. Inspect the working
diff, the relevant spec or task, `AGENTS.md`, and specialist prompt files when
they are changed. Review correctness, regressions, missing validation, scope
creep, unsafe permissions, and routing mistakes. Lead with actionable findings,
file references, and severity; ignore style-only preferences.

Model and permissions:

- Model: `lite`; variant: `high`.
- Skill: code review.
- Strictly read-only.
- Review baseline: working diff plus applicable spec and instructions.

### `security-reviewer`

Use automatically when changed-file patterns and task intent indicate inline
JavaScript, DOM rendering, third-party scripts, browser storage, security
headers, external inputs, dependencies, `.mimocode` agent/config files, or
provider/tool permissions. Review changed trust boundaries, unsafe sinks,
injection risks, exposed secrets, excessive permissions, and security
regressions using an OWASP-oriented secure-review checklist.

Model and permissions:

- Model: `openai/gpt-5.6-luna`; variant: `xhigh`.
- Skill guidance: secure-review checklist.
- Strictly read-only.
- Project scope by default. Global MiMoCode/provider configuration is inspected
  only when explicitly delegated, and sensitive values are always redacted.

### `seo-a11y-reviewer`

Use automatically for page, content, metadata, navigation, or template changes
to HTML, `robots.txt`, `sitemap.xml`, or shared UI source. Check
canonical/OG/Twitter metadata, structured data, sitemap/robots consistency,
semantic markup, keyboard and screen-reader behavior, contrast, and relevant
Lighthouse SEO/accessibility findings across affected pages and pages that
inherit the changed shared template.

Model and permissions:

- Model: `lite`; variant: `high`.
- Skills: SEO audit, accessibility, and Lighthouse.
- May make small, obvious, directly evidenced fixes to touched source files.
- May not edit generated bundles, reports, lockfiles, or unrelated config.

## [S8] Coordination and verification contract

Read-only specialists may run in parallel when their scopes are independent.
When browser QA and SEO/a11y both need to edit the same page, the primary agent
chooses the order and serializes the edits. After all specialist writes finish,
`reviewer` runs once against the final diff.

Write-capable specialists follow the repository's verification rules:

- Major HTML/CSS/JavaScript changes: run `npm run build`,
  `npm run lighthouse:all`, and `npm run lighthouse:report`.
- Small fixes: run targeted browser and Lighthouse checks appropriate to the
  touched page or behavior.
- If verification fails, stop further automatic edits and report the failure;
  the primary agent decides whether to repair, revert, or continue.

## [S9] Portability correction: `.gitignore` trackability

The broad `.mimocode/` ignore rule originally prevented the project-local
configuration and specialist agent files from being committed. These files must
be trackable so the repository carries its model routing and agent definitions
to another computer:

- `.mimocode/mimocode.json` — the project-local model routing and agent
  configuration.
- `.mimocode/agent/*.md` — the four project-local specialist subagent
  definitions (`browser-qa`, `reviewer`, `security-reviewer`,
  `seo-a11y-reviewer`).

The `.gitignore` must therefore replace the single `.mimocode/` rule with a
negation pattern that ignores all `.mimocode` contents except the above files.

### [S9-V] Verification requirement

Run from the repository root:

```powershell
git check-ignore .mimocode/mimocode.json .mimocode/agent/browser-qa.md
```

Expected: no output and exit code 1, meaning neither file is ignored. Other
unrelated `.mimocode` contents (caches, state, temp files) must remain ignored
by the `.mimocode/*` base rule.
