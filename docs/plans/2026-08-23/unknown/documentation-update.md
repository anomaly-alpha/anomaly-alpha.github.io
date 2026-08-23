# Repository Documentation Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all active repository documentation into agreement with the current working-tree code and configuration, while leaving implementation files unchanged.

**Architecture:** Use the current working tree as the only behavioral source of truth. Audit the root web app, public guide cluster, and independent `skarn-bot` project separately; update only active documentation and add one source-backed external-reference report. Treat dated plans, reports, journals, handoffs, and research snapshots as historical records unless an active document presents them as current instructions.

**Tech Stack:** Markdown, static HTML documentation pages, Node.js package metadata, PowerShell verification, Tavily search/extraction, repository-local audit scripts.

## Global Constraints

- “do not change any code”
- “the current code is the absolute source of truth”
- Preserve all pre-existing user changes in the working tree.
- Do not edit JavaScript, CSS, JSON data, package manifests, tests, generated assets, deployment configuration, or other implementation/configuration files; HTML edits are limited to user-facing documentation copy and documentation metadata.
- Sitemap/XML and HTML metadata are in scope only as documentation/SEO records: update their factual labels and index inventory when current repository evidence requires it, without changing executable scripts or application data.
- Do not rewrite dated historical plans, reports, journals, handoffs, or research snapshots merely because their historical claims no longer describe current behavior.
- Every changed factual claim must be supported by current source inspection; externally owned claims must cite a primary source in the research report.
- Do not add speculative features, future plans, or undocumented behavior.

---

### Task 1: Normalize root and active web-app documentation

**Covers:** Active documentation inventory, current application behavior, public guide topology, build and verification instructions.

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CONTEXT.md`
- Modify: `docs/index.md`
- Modify: `docs/DESIGN_SYSTEM.md` only where the audit proves a current design-system claim is stale or missing
- Modify: `advertising.md` only where current public copy contains a stale claim or broken active URL
- Modify: `CHANGELOG.md` to record the current documentation-visible changes using the existing release-history convention
- Modify: `sitemap.xml` only if the audit proves a currently indexable public page is missing; preserve deliberate noindex/legal exclusions

**Interfaces:**
- Consumes: current `index.html`, `script.js`, `data/codes.json`, `sitemap.xml`, `package.json`, `scripts/*.js`, `tests/*.js`, and `guide/*/index.html`.
- Produces: root and app-facing documentation that names the actual guide count, sitemap inventory, active code count, build commands, verification commands, ad fallback behavior, generated-source relationships, and current feature surface.

- [ ] **Step 1: Apply the audit findings**

  Correct every confirmed stale count, path, command, feature description, source-of-truth statement, and active link. Preserve historical references by labeling them as historical rather than silently rewriting them.

- [ ] **Step 2: Document the current ad-disabled fallback**

  Describe the current `ads-config` state and site-message fallback only in Markdown documentation; do not alter the inline configuration or CSS/JavaScript implementation.

- [ ] **Step 3: Re-scan active root docs for stale markers**

  Run a targeted search for old guide counts, old code counts, singular `docs/plan/` paths, unsupported “no tests” claims, and contradictory ad/runtime statements. Resolve every result that refers to current behavior.

- [ ] **Step 4: Review the resulting diff**

  Confirm that all edits are documentation-only and that no existing user change is removed. Treat `lighthouserc.js` as an implementation/configuration file: if its eight-page audit scope differs from the nine-guide public cluster, clarify the scope in docs rather than editing that JavaScript config.

### Task 2: Synchronize public guide documentation

**Covers:** Public guide copy, cross-linking, metadata descriptions, current user-visible behavior.

**Files:**
- Modify: only the specific files under `guide/*/index.html` identified by the guide audit
- Modify: `music/index.html` for stale public metadata/copy identified by the audit
- Modify: `privacy/index.html`, `terms/index.html`, `authors/anomaly/index.html`, `seo/index.html`, `404.html` only if the audit finds a current user-facing documentation or metadata claim that is stale
- Do not modify: inline JavaScript behavior, inline JSON application data, generated code bundles, or stylesheets

**Interfaces:**
- Consumes: current guide HTML, root `index.html`, `sitemap.xml`, `data/codes.json`, guide-generation markers, and the guide audit report.
- Produces: guide prose and documentation metadata that accurately describe the current nine-guide public cluster, current counts, redemption flow, creator directory, and site-message fallback.

- [ ] **Step 1: Fix confirmed stale guide copy**

  Update only prose, headings, descriptions, dates, labels, and documentation metadata that the audit maps to current source evidence. Keep the current user changes in each guide intact.

- [ ] **Step 2: Verify guide topology and links**

  Check every local guide link referenced by active guides against the actual `guide/*/index.html` files and sitemap entries. Repair documentation links only when the target exists in the current tree.

- [ ] **Step 3: Verify generated-page boundaries**

  Ensure edits do not break generator marker pairs or alter generated behavior. If a stale claim is generated from source data, document the generator/source relationship instead of hand-editing generated code.

- [ ] **Step 4: Resolve public-page inventory decisions**

  Reconcile the sitemap and documentation page lists with the actual public pages. Keep `music/` out of the sitemap if its current `noindex` metadata makes that intentional; keep legal pages out if the current site treats them as non-indexable; document those exclusions instead of adding URLs speculatively.

### Task 3: Refresh active `skarn-bot` documentation

**Covers:** Bot setup, commands, model routing, database/runtime operations, RPC guide, and documentation-audit workflow.

**Files:**
- Modify: `skarn-bot/README.md`
- Modify: `skarn-bot/CONTEXT.md`
- Modify: `skarn-bot/RPC_GUIDE.md`
- Modify: `skarn-bot/docs/ARCHITECTURE.md`
- Modify: `skarn-bot/docs/DATABASE.md`
- Modify: `skarn-bot/docs/NL-TOOLS.md`
- Modify: `skarn-bot/docs/adr/0001-tiered-context-assembly.md` only if it is currently presented as an active decision and the audit identifies a factual contradiction

**Interfaces:**
- Consumes: `skarn-bot/package.json`, `.env.example`, `bot.js`, `deploy-commands.js`, command modules, feature modules, database modules, scripts, smoke checks, and the bot audit report.
- Produces: operational documentation matching the current command registry, environment variables, model router, safety gates, database schema, RPC behavior, and available verification scripts.

- [ ] **Step 1: Reconcile setup and runtime instructions**

  Align prerequisites, install/start/deploy/audit/smoke commands, environment variable names/defaults, and model-selection descriptions with the current bot files.

- [ ] **Step 2: Reconcile command and feature inventories**

  Update command counts and detailed command sections only where source inspection proves drift. Keep `/help` as the live command reference where the source intentionally makes the list dynamic.

- [ ] **Step 3: Reconcile architecture and persistence docs**

  Update module boundaries, model-routing behavior, moderation/rate-limit behavior, storage paths, migrations, and backup/restore instructions from current source and schema files.

- [ ] **Step 4: Reconcile RPC documentation**

  Make the RPC guide accurately distinguish its standalone example from the repository’s hardcoded script and current process-manager options.

### Task 4: Add source-backed external-reference audit

**Covers:** External platform/API claims used by active documentation.

**Files:**
- Create: `docs/reports/2026-08-23/mimocode/external-reference-audit.md`

**Interfaces:**
- Consumes: active documentation URLs and external claims plus Tavily results from official sources.
- Produces: one Markdown report mapping each validated external claim to the repository file/line and the primary source URL used.

- [ ] **Step 1: Record Tavily findings**

  Include official-source evidence for Node.js support status, OpenAI model naming where documented, Discord.js/runtime requirements where relevant, and any other external claim that remains in active docs.

- [ ] **Step 2: Record unresolved external claims**

  For claims that cannot be verified from an authoritative source, mark the claim as repository-specific or remove it from active docs rather than presenting it as externally guaranteed.

- [ ] **Step 3: Link the report from the active documentation index**

  Add a concise entry to `docs/index.md` so future audits can find [`external-reference-audit.md`](../../reports/2026-08-23/mimocode/external-reference-audit.md).

### Task 5: Verify the documentation-only update

**Covers:** No-code-change constraint, stale-reference closure, link integrity, and repository checks.

**Files:**
- Test: existing documentation and repository verification commands; no test-file changes

**Interfaces:**
- Consumes: the complete documentation diff and current working-tree source.
- Produces: auditable evidence that documentation claims, local links, and repository checks pass without implementation changes.

- [ ] **Step 1: Verify code-file immutability**

  Run `git diff --name-only` and classify every changed path. Fail the task if any implementation/configuration/test/generated file changed.

- [ ] **Step 2: Verify local documentation links and stale claims**

  Run targeted PowerShell/Node checks over active Markdown and HTML docs for missing local targets, old guide/sitemap counts, old code counts, obsolete path forms, and contradictory setup commands.

- [ ] **Step 3: Run existing documentation-relevant checks**

  Run `npm run test:creators`, `npm run test:ads-txt`, `npm run test:ads-fallback`, and `npm --prefix skarn-bot run audit:docs`. Do not run generators such as `npm run skarn-index` as verification because they can rewrite generated files; if a generator is needed to understand a claim, inspect its source and discard no user changes.

- [ ] **Step 4: Run the final review**

  Inspect the complete diff, confirm every audit finding is either corrected or explicitly historical/repository-specific, and report any residual limitation instead of claiming zero gaps without evidence.
