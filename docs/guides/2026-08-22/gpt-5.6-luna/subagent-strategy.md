# MiMoCode Subagent Strategy — Portable Guide

**Purpose**: Apply the approved dual-model subagent strategy to any MiMoCode repository on any computer. This guide is written for coding models that will read and apply these settings.

---

## 1. Goal

Route agent tasks to the most cost-effective capable model:

| Task group | Model | Variant | Reason |
|------------|-------|---------|--------|
| build, plan, compose | `openai/gpt-5.6-luna` | `xhigh` | Complex orchestration, multi-file edits, security review |
| general, explore, browser-qa, reviewer, seo-a11y | `opencode-go/mimo-v2.5` | `high` | General reasoning, read-only review, browser testing |
| lite model group | `opencode-go/mimo-v2.5` | — | Fallback / low-cost tasks |

---

## 2. Two-Scope Installation

MiMoCode merges configuration from two scopes:

1. **Global scope** — `~/.mimocode/mimocode.json` + `~/.mimocode/agent/*.md`
   - Applies to **all repositories** on the machine.
   - Use for model/provider authentication and default model routing.

2. **Project scope** — `.mimocode/mimocode.json` + `.mimocode/agent/*.md` (inside the repo)
   - Applies to **this repository only**.
   - Portable: committed to git, travels with the repo to other computers.
   - Use for agent role definitions, specialist prompts, and project-specific model overrides.

**On a new computer**: clone the repo (project scope comes with it), then install global-scope provider auth and model definitions for that machine.

---

## 3. Configuration Snippets

### 3.1 Top-level model default

```json
"model": "openai/gpt-5.6-luna"
```

### 3.2 Model groups

```json
"model_groups": {
  "lite": "opencode-go/mimo-v2.5"
}
```

### 3.3 Agent routing

```json
"agent": {
  "build": {
    "model": "openai/gpt-5.6-luna",
    "variant": "xhigh"
  },
  "plan": {
    "model": "openai/gpt-5.6-luna",
    "variant": "xhigh"
  },
  "compose": {
    "model": "openai/gpt-5.6-luna",
    "variant": "xhigh"
  },
  "general": {
    "model": "opencode-go/mimo-v2.5",
    "variant": "high"
  },
  "explore": {
    "model": "opencode-go/mimo-v2.5",
    "variant": "high"
  }
}
```

### Merge instructions

When applying these snippets to an existing `mimocode.json`:

- Merge minimally: add or replace only `model`, `model_groups`, and `agent` keys.
- **Preserve** all existing `providers`, `mcp`, `free` group definitions, comments (`//`), and unrelated settings (`checkpoint`, `lsp`, `$schema`, etc.).
- Do not reformat the file beyond the changed keys.
- Do not add, remove, or rename provider entries.

---

## 4. Specialist Agent Roles

Four specialist roles are defined as `.mimocode/agent/*.md` prompt files. Each uses a YAML frontmatter header followed by plain instructions.

### 4.1 Overview

| File | Model | Variant | Role |
|------|-------|---------|------|
| `security-reviewer.md` | `openai/gpt-5.6-luna` | `xhigh` | Security-sensitive review (OWASP checklist) |
| `browser-qa.md` | `lite` (resolves to `opencode-go/mimo-v2.5`) | `high` | Playwright/Lighthouse browser testing |
| `reviewer.md` | `lite` | `high` | Final read-only code review |
| `seo-a11y-reviewer.md` | `lite` | `high` | SEO + accessibility audit + small fixes |

### 4.2 Frontmatter format

```yaml
---
mode: subagent
model: <model-or-group>
variant: <variant>
description: <one-line purpose>
---
```

- `model` can be a full model ID (`openai/gpt-5.6-luna`) or a model group reference (`lite`).
- `variant` is optional; use `xhigh` for highest quality, `high` for standard quality.

### 4.3 Triggers

Each specialist prompt defines when it should be invoked (e.g., "trigger for inline JavaScript", "trigger for UI-related changes"). The primary agent reads these descriptions and invokes specialists when the task matches.

### 4.4 Skills

Specialists may reference built-in or project skills by name (e.g., `playwright`, `lighthouse`, `code-review`, `seo-audit`, `accessibility`). These must be available in the MiMoCode skill registry or the project `.mimocode/skills/` directory.

### 4.5 Read/write boundaries

- **Read-only** specialists (`reviewer.md`, `security-reviewer.md`): must not edit files, commit, or push.
- **Write-allowed** specialists (`browser-qa.md`, `seo-a11y-reviewer.md`): may edit only touched source files for small, obvious, directly evidenced fixes. Never edit generated files, reports, lockfiles, or unrelated configuration.
- **All specialists**: never commit or push. The primary agent handles git operations.

### 4.6 Structured conversation summary

Every specialist must return a structured summary with these fields:

- **status**: pass / fail / partial
- **trigger and scope**: what invoked the specialist
- **findings by severity**: categorized with file references
- **files changed**: list of modified files (if any)
- **commands and results**: validation commands run
- **residual risks**: known issues not addressed

### 4.7 Coordination model

- The **primary agent** (build/plan/compose/general) orchestrates specialist invocations.
- Specialists run as **subagents** — bounded, one-pass tasks.
- The primary agent collects specialist summaries and incorporates findings.
- After all specialists complete, the primary agent runs a final review via `reviewer.md`.

---

## 5. `.gitignore` Portability

The project `.gitignore` must track portable files and ignore machine-local data:

```gitignore
# MiMoCode — track portable config and agent prompts
.mimocode/*
!.mimocode/mimocode.json
!.mimocode/agent/
!.mimocode/agent/*.md
```

What this means:

- **Tracked** (committed to git):
  - `.mimocode/mimocode.json` — project model routing and agent config
  - `.mimocode/agent/*.md` — specialist prompt definitions

- **Ignored** (machine-local, not committed):
  - `.mimocode/node_modules/`, `.mimocode/package.json`, `.mimocode/package-lock.json`
  - `.mimocode/skills/`, `.mimocode/plans/`, `.mimocode/command/`
  - `.mimocode/.cron-lock`, `.mimocode/.gitignore`
  - Any other `.mimocode/` contents

Also inside `.mimocode/`, a secondary `.gitignore` excludes:

```
node_modules
package.json
package-lock.json
bun.lock
.gitignore
```

---

## 6. Cross-Computer Limitations

- **Model/provider authentication is per machine.** API keys, tokens, and provider configs in global `mimocode.json` or environment variables are not portable. Each machine must authenticate providers independently.
- **`model.json` recent/favorite/variant state is per machine.** Do not commit `model.json` — it contains machine-local UI state.
- **Agent prompt files (`.mimocode/agent/*.md`) are portable.** They travel with the repo and work on any machine with the correct model/provider setup.

---

## 7. Application Checklist

### Step 1: Verify model providers are available

```bash
mimo models openai
mimo models opencode-go
```

Expected: list of available models for each provider. If a provider is missing, configure it in global `~/.mimocode/mimocode.json` before proceeding.

### Step 2: Apply project config

Merge the JSON snippets from Section 3 into `.mimocode/mimocode.json`. Verify the file is valid JSON:

```bash
# PowerShell
Get-Content .mimocode/mimocode.json | ConvertFrom-Json | Out-Null
Write-Output "JSON valid"
```

### Step 3: Verify agent files exist

```bash
mimo agent list
```

Expected output should include: `browser-qa`, `reviewer`, `security-reviewer`, `seo-a11y-reviewer`.

### Step 4: Verify global vs project scope

Run from **inside** the repo:

```bash
mimo agent list
```

Run from **outside** the repo (e.g., home directory):

```bash
mimo agent list
```

Inside should show the 4 project specialists. Outside should show only global agents (if any).

### Step 5: Verify agent file integrity

Compare SHA256 hashes of project agent files to confirm they are tracked and unmodified:

```bash
# PowerShell
Get-ChildItem .mimocode/agent/*.md | ForEach-Object {
    $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
    "$($_.Name): $hash"
}
```

Save these hashes. On another machine, re-run and compare to verify the files transferred correctly.

### Step 6: Verify `.gitignore` rules

```bash
# Should be ignored (not tracked)
git check-ignore .mimocode/node_modules
git check-ignore .mimocode/skills
git check-ignore .mimocode/.cron-lock

# Should NOT be ignored (tracked)
git check-ignore .mimocode/mimocode.json
git check-ignore .mimocode/agent/reviewer.md
```

Expected: first three return matching paths (ignored); last two return nothing (not ignored = tracked).

### Step 7: Verify no secrets in tracked files

```bash
Get-Content .mimocode/mimocode.json | Select-String -Pattern "apiKey|secret|token|password" -CaseSensitive:$false
```

Expected: no matches. The tracked config should contain only model IDs, variant names, and structural settings.

---

## 8. Completion Criteria

The strategy is correctly applied when:

1. `mimo models openai` lists available models (provider authenticated)
2. `mimo models opencode-go` lists available models (provider authenticated)
3. `.mimocode/mimocode.json` is valid JSON with the correct `model`, `model_groups`, and `agent` keys
4. `mimo agent list` inside the repo shows all 4 specialists
5. `mimo agent list` outside the repo does not show project specialists
6. SHA256 hashes of `.mimocode/agent/*.md` match between source and target machines
7. `git check-ignore` confirms portable files are tracked and local files are ignored
8. No secrets, API keys, tokens, or absolute machine paths appear in tracked files
9. No files have been committed or pushed during this process
