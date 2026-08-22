# Model Routing: Luna Primary Modes and MiMo Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the approved Luna/MiMo routing and specialist-agent workflow globally on this computer and portably in this repository.

**Architecture:** The global JSONC config provides defaults for every repository on this computer. The project JSON config repeats the routing so this repository carries its behavior to another computer. Four identical agent definitions are installed globally and project-locally; project-local definitions win in this repository while the global copies serve other repositories.

**Tech Stack:** MiMoCode JSONC configuration, MiMoCode Markdown subagent definitions, PowerShell validation, existing Playwright/Lighthouse/SEO/accessibility workflows.

## Global Constraints

- Route `build`, `plan`, and `compose` through `openai/gpt-5.6-luna` with `xhigh`.
- Keep `general`, `explore`, `browser-qa`, `reviewer`, and `seo-a11y-reviewer` on MiMo with `high`.
- Route `security-reviewer` through `openai/gpt-5.6-luna` with `xhigh`.
- Keep `lite` mapped to `opencode-go/mimo-v2.5` and leave `free` unchanged.
- Store specialist definitions under both `C:\Users\petra\.config\mimocode\agent\` and `.mimocode/agent/`.
- Reviewer and security reviewer are read-only; browser QA and SEO/a11y may make only small, obvious, source-only fixes.
- No specialist may commit, push, refactor broadly, add dependencies, or edit generated files, reports, lockfiles, or unrelated configuration.
- Automatic delegation uses changed-file patterns plus task intent and runs each specialist at most once per user task.
- Read-only work may run in parallel; write-capable agents run sequentially under primary-agent control.
- Findings return as structured conversation summaries; reports are not created by default.
- Preserve provider definitions, MCP servers, application files, unrelated project settings, recent/favorite model state, and the `free` group.

---

### Task 1: Update global model routing

**Covers:** S1, S2, S3, S4, S5

**Files:**
- Modify: `C:\Users\petra\.config\mimocode\mimocode.jsonc`
- Inspect only: `C:\Users\petra\.local\state\mimocode\model.json`

**Interfaces:**
- Consumes: Existing global JSONC provider, model groups, MCP, and agent settings.
- Produces: Global routing available to every repository on this computer.

- [ ] **Step 1: Record the pre-change global config state**

Run:

```powershell
Get-FileHash -LiteralPath 'C:\Users\petra\.config\mimocode\mimocode.jsonc' -Algorithm SHA256
Get-Content -LiteralPath 'C:\Users\petra\.config\mimocode\mimocode.jsonc' |
  Select-String -Pattern '"model"|"lite"|"build"|"plan"|"compose"|"general"|"explore"'
```

Expected: the current default and explicit agents still point to
`opencode-go/mimo-v2.5`, while `lite` already points to the same model.

- [ ] **Step 2: Change only global model and agent routing**

Set these existing fields, preserving all providers, MCP entries, comments, and
the existing `free` group:

```jsonc
"model": "openai/gpt-5.6-luna",
"agent": {
  "build": { "model": "openai/gpt-5.6-luna", "variant": "xhigh" },
  "plan": { "model": "openai/gpt-5.6-luna", "variant": "xhigh" },
  "compose": { "model": "openai/gpt-5.6-luna", "variant": "xhigh" },
  "general": { "model": "opencode-go/mimo-v2.5", "variant": "high" },
  "explore": { "model": "opencode-go/mimo-v2.5", "variant": "high" }
}
```

Keep this unchanged:

```jsonc
"model_groups": {
  "lite": "opencode-go/mimo-v2.5"
}
```

Do not edit the existing `free` group or any of its members.

- [ ] **Step 3: Confirm the global model registry**

Run:

```powershell
mimo models openai
```

Expected: output contains `openai/gpt-5.6-luna`.

### Task 2: Make the project config portable

**Covers:** S2, S3, S4, S6

**Files:**
- Modify: `.mimocode/mimocode.json`

**Interfaces:**
- Consumes: Existing project checkpoint and LSP settings.
- Produces: A checked-in project config that carries model routing to another computer.

- [ ] **Step 1: Preserve the existing project settings**

Keep the current `checkpoint`, `lsp`, and `$schema` entries unchanged.

- [ ] **Step 2: Add portable routing fields**

Add these top-level fields to the existing project JSON:

```json
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
```

- [ ] **Step 3: Check project JSON syntax**

Run:

```powershell
Get-Content -LiteralPath '.mimocode\mimocode.json' -Raw | ConvertFrom-Json | Out-Null
```

Expected: the command exits successfully without output.

### Task 3: Install global specialist agents

**Covers:** S2, S4, S6, S7, S8

**Files:**
- Create: `C:\Users\petra\.config\mimocode\agent\browser-qa.md`
- Create: `C:\Users\petra\.config\mimocode\agent\reviewer.md`
- Create: `C:\Users\petra\.config\mimocode\agent\security-reviewer.md`
- Create: `C:\Users\petra\.config\mimocode\agent\seo-a11y-reviewer.md`

**Interfaces:**
- Consumes: Global model groups and available MiMoCode skills/tools.
- Produces: Specialist definitions available in other repositories on this computer.

- [ ] **Step 1: Create `browser-qa.md`**

Use this exact contract:

```markdown
---
mode: subagent
model: lite
variant: high
description: Test UI changes in a real browser and make only small, obvious source fixes when directly evidenced.
---

Use the Playwright and Lighthouse skills. Trigger for UI-related HTML, JavaScript, CSS, Tailwind source/config, or interaction changes. Test local file:// or local-server behavior and the deployed URL when deployment or network behavior matters. Inspect console and network errors, capture screenshots or traces when useful, and run relevant Lighthouse checks. Only edit touched source files for small, obvious, directly evidenced fixes. Never edit generated files, reports, lockfiles, or unrelated configuration. Never commit or push.

Return a structured conversation summary containing status, trigger and scope, findings by severity, files changed, commands and results, and residual risks.
```

- [ ] **Step 2: Create `reviewer.md`**

Use this exact contract:

```markdown
---
mode: subagent
model: lite
variant: high
description: Perform the final read-only review of the working diff and specialist changes.
---

Use the code-review skill. Run once as the final review after implementation and any specialist writes. Inspect the working diff, applicable spec or task, AGENTS.md, and changed specialist prompt files. Check correctness, regressions, missing validation, scope creep, unsafe permissions, and model/tool routing. Ignore style-only preferences. Do not edit files, commit, or push.

Return a structured conversation summary containing status, findings by severity with file references, commands and results, and residual risks.
```

- [ ] **Step 3: Create `security-reviewer.md`**

Use this exact contract:

```markdown
---
mode: subagent
model: openai/gpt-5.6-luna
variant: xhigh
description: Review security-sensitive application and MiMoCode agent/config changes using an OWASP-oriented checklist.
---

Trigger for inline JavaScript, DOM rendering, third-party scripts, browser storage, security headers, external inputs, dependencies, .mimocode agent/config files, or provider/tool permissions. Review changed trust boundaries, unsafe sinks, injection risks, exposed secrets, excessive permissions, and security regressions. Use an OWASP-oriented secure-review checklist. Stay project-scoped by default; inspect global MiMoCode/provider configuration only when explicitly delegated. Redact secrets, keys, tokens, and private values. Do not edit files, commit, or push.

Return a structured conversation summary containing status, trigger and scope, findings by severity with redacted evidence, commands and results, and residual risks.
```

- [ ] **Step 4: Create `seo-a11y-reviewer.md`**

Use this exact contract:

```markdown
---
mode: subagent
model: lite
variant: high
description: Review targeted page, SEO, and accessibility changes and make small, obvious source fixes when directly evidenced.
---

Use the SEO audit, accessibility, and Lighthouse skills. Trigger for page, content, metadata, navigation, template, robots.txt, sitemap.xml, or shared UI changes. Check canonical, OG/Twitter, structured data, sitemap/robots consistency, semantic markup, keyboard and screen-reader behavior, contrast, and relevant Lighthouse findings across affected and shared-template pages. Only edit touched source files for small, obvious, directly evidenced fixes. Never edit generated files, reports, lockfiles, or unrelated configuration. Never commit or push.

Return a structured conversation summary containing status, trigger and scope, findings by severity, files changed, commands and results, and residual risks.
```

### Task 4: Install portable project-local specialist agents and fix `.gitignore`

**Covers:** S2, S6, S7, S8, S9

**Files:**
- Modify: `.gitignore`
- Create: `.mimocode/agent/browser-qa.md`
- Create: `.mimocode/agent/reviewer.md`
- Create: `.mimocode/agent/security-reviewer.md`
- Create: `.mimocode/agent/seo-a11y-reviewer.md`

**Interfaces:**
- Consumes: The project config's `lite` group and checked-in project instructions.
- Produces: The same specialist behavior when this repository is opened on another computer.

- [ ] **Step 1: Replace the broad `.mimocode/` ignore rule**

Replace the single `.mimocode/` line in `.gitignore` with:

```
.mimocode/*
!.mimocode/mimocode.json
!.mimocode/agent/
!.mimocode/agent/*.md
```

This makes the project config and agent files trackable while keeping other
`.mimocode` contents ignored. Preserve all other ignore rules unchanged.

- [ ] **Step 2: Copy the four global contracts without changing model or permission rules**

The project-local files must match Task 3 exactly. Project-local definitions override same-named global definitions, so identical copies prevent this repository from drifting from the global workflow.

- [ ] **Step 3: Confirm agent files contain no credentials or machine-specific paths**

Run:

```powershell
Get-ChildItem -LiteralPath '.mimocode\agent' -File | Select-Object -ExpandProperty Name
Select-String -Path '.mimocode\agent\*.md' -Pattern 'apiKey|token|secret|password|C:\\Users\\petra'
```

Expected: four agent names are listed and the sensitive/path search returns no matches.

### Task 5: Validate both activation scopes

**Covers:** S3, S4, S6, S8

**Files:**
- Inspect: `C:\Users\petra\.config\mimocode\mimocode.jsonc`
- Inspect: `.mimocode/mimocode.json`
- Inspect: `C:\Users\petra\.config\mimocode\agent\*.md`
- Inspect: `.mimocode/agent/*.md`

- [ ] **Step 1: Validate the current project scope**

Run from the repository:

```powershell
mimo models openai
mimo agent list
```

Expected: Luna is registered; the project shows the primary modes, existing MiMo helpers, and all four specialist agents.

- [ ] **Step 2: Validate global-only behavior from outside this repository**

Run from a directory outside the repository, such as the system temporary directory:

```powershell
Push-Location ([IO.Path]::GetTempPath())
try { mimo agent list } finally { Pop-Location }
```

Expected: the global specialist agents are available without loading this repository's `.mimocode` files.

- [ ] **Step 3: Confirm `.mimocode` files are trackable and not ignored**

Run:

```powershell
git check-ignore .mimocode/mimocode.json .mimocode/agent/browser-qa.md
```

Expected: no output and exit code 1, meaning neither file is ignored by any rule.

- [ ] **Step 4: Confirm the project worktree diff is limited to intended files**

Run:

```powershell
git status --short -- .gitignore .mimocode/mimocode.json .mimocode/agent docs/compose/specs docs/compose/plans
git diff -- .gitignore .mimocode/mimocode.json
```

Expected: status lists only the `.gitignore` change, the project config, four project agent files, and the approved spec/plan artifacts as attributable to this work; existing unrelated user changes remain untouched. The diff shows only the intended changes.

- [ ] **Step 5: Confirm no global recent-model rewrite occurred**

Run:

```powershell
Get-Content -LiteralPath 'C:\Users\petra\.local\state\mimocode\model.json' -Raw | ConvertFrom-Json | Select-Object recent, favorite, variant
```

Expected: existing recent, favorite, and variant entries are preserved.

No application test suite is required because this change only configures MiMoCode and agent prompts. Do not commit or push unless separately requested.
