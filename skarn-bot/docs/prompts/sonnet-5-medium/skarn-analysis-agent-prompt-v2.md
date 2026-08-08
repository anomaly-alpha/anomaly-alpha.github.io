# Agent Task: Analyze Skarn's Current Persona & Capabilities, Suggest Upgrades (v2)

## Context

You are analyzing **skarn-bot**, a feature-rich Discord bot built on `discord.js`, hosted on Railway.app. Its core feature is **Skarn**, a demon Warmaster persona that talks to users in Discord servers. You have full read access to this repository — use it. Do not ask the user to paste files; find and read them yourself.

Architectural conventions this project follows — evaluate code against these, not just prose:

- Vertical slice structure (feature-based, not layer-based)
- No god-files — logic should be split by responsibility
- All AI/LLM calls route through a single shared client
- Per-feature rate-limit buckets
- Per-guild data scoping (nothing should leak across servers)
- SQLite storage (5 GB available)

Known existing features to expect (adjust to what you actually find — the repo is ground truth, not this list): a persona/mood system with a channel state machine, per-user explicit memory (`/etch`), the Realm of Skarn persistent RPG, Confidant Mode (DM-based relationship feature with wellbeing guardrails and history compression), Derived Memory (embedding-based passive fact extraction), Friend Tiers / AI Interaction Permissions (five-tier reputation system), Chronicle and Omen (server-memory narrative features), and a moderation integration.

## Step 0: Establish Ground Truth Before Analyzing

Before evaluating anything, resolve these — they change how you read everything after:

- **Canonical vs. stale files.** If multiple files look like persona/system-prompt definitions (e.g. old drafts, `_backup`, `_v1`/`_v2`, unused exports), determine which one is actually wired into the live code path. Check `git log`/`git blame` for recency if timestamps are ambiguous. Flag any dead persona files you find instead of silently ignoring or silently analyzing them as if live.
- **The actual prompt-assembly path.** Trace the real runtime path from "user sends message" to "final string sent to the LLM." List every file that contributes a piece of that final prompt, in the order they're assembled. This is more reliable than reading a persona file in isolation.
- **Model & call configuration.** Find where the LLM client is configured: model name/version, `max_tokens`, `temperature`, and any other sampling params. Note if different features use different models or settings.

## Step 1: Read Everything In Scope

Fully open and read (not filename-skim) every file that defines or influences Skarn's persona and behavior, including:

- Core system prompt / persona definition file(s)
- Mood/state-machine logic that modulates tone
- Memory systems that feed context into responses (`/etch`, Derived Memory, Chronicle/Omen)
- Friend Tier / permission logic gating what he can say or do per user
- Prompt-construction/assembly code identified in Step 0
- Any existing eval scripts, test files, or logged transcripts that show Skarn's actual output (not just the prompt that's supposed to produce it) — behavior in practice can drift from what the prompt says

## Step 2: Map the Current State (Facts Only, No Judgment Yet)

Produce a factual account of:
- Skarn's core identity/voice as currently written
- Explicitly defined traits, tone rules, and constraints
- What context/memory actually reaches the prompt at runtime, and its approximate size/token footprint
- Inconsistencies between files (e.g., mood system implies one tone, base persona implies another)
- Any persona-relevant files that are dead code (per Step 0)

## Step 3: Trait-by-Trait Assessment

Evaluate against these target traits: **wiser, more patient, more knowledgeable, more kind, more intelligent, more in-character as a demon Warmaster** (not a generic wise-mentor cliché). For each trait:
- Is it currently supported by the prompt/logic, weakly implied, or absent?
- Is it undercut anywhere (e.g., a mood state that makes him impatient/dismissive in a way that contradicts the target)?
- Cite specific file + line range for every claim — no unsupported assertions.

Also assess fit against this design principle, already agreed on separately: Skarn should never *name-drop* philosophers or lecture — wisdom/patience should show as behavior (Socratic questioning, Stoic restraint under provocation, strategic patience, restrained confidence, framing struggle as growth) not as quoted aphorisms. Flag anywhere the current prompt risks tipping into fortune-cookie or therapy-speak territory.

## Step 4: Capability Gaps

Group by system (persona/mood, memory, permissions, architecture). Include:
- Memory/context collected but underused in the final prompt
- God-files or leaky abstractions
- Missing guardrails (e.g., wellbeing checks present in Confidant Mode but absent elsewhere)
- Rate-limit or per-guild scoping gaps
- Safety/moderation blind spots — not just wellbeing, but anything touching user privacy, content moderation, or age-inappropriate content given this runs on public Discord servers
- Systems that could inform each other but currently don't (mood, memory, friend tier)
- Cost/latency concerns if context footprint is large relative to the model's effective window

## Step 5: Upgrade Recommendations

Each recommendation must include:
- What to change and why
- File(s) touched (path + approximate line numbers)
- Complexity: small / medium / large
- Risk of persona drift or architecture violation
- Whether it's a **quick win** (small effort, clear impact) or a **strategic change** (larger effort, structural)

Order the list by impact within each of those two buckets, quick wins first.

## Output Format

Save the report to `docs/skarn-persona-analysis-<date>.md` in the repo (or an equivalent docs location if that path doesn't exist — use your judgment on repo convention) AND return it in your response. Structure:

1. **Executive Summary** — 5-8 bullets max, the headline findings and top 3 recommended actions
2. **Files Read** — every file opened, one-line role description, flag if dead/stale
3. **Prompt Assembly Trace** — the ordered path from user message to final LLM call
4. **Current Persona Snapshot**
5. **Trait-by-Trait Assessment**
6. **Capability Gaps** (grouped)
7. **Upgrade Recommendations** — quick wins first, then strategic
8. **Open Questions** — anything undeterminable from the code, needs a human decision

## Constraints

- Read-only analysis pass. Do not modify, refactor, or commit any code.
- Do not invent features not present in the codebase — if something is referenced but the implementation can't be found, flag it under Open Questions rather than guessing.
- Every claim about current behavior needs a file citation. No recommendation should rely on an unverified assumption about what the code does.
- Recommendations must be concrete enough to hand to an implementation pass — never "make him wiser," always the specific mechanism and file (e.g., "add a Socratic-questioning fallback when confidence is low in `moodResponder.js:142`").
