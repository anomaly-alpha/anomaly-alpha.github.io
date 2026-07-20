# Documentation Audit & Design-Decision Persistence — Prompt for Local Model

You are auditing the documentation of an existing project called **skarn-bot**
— a Discord bot with a persistent AI persona (Skarn), built across several
major feature sets over time (persona/mood system, an RPG called "Realm of
Skarn," a private DM feature called "Confidant Mode," passive "Derived
Memory," and a "Friend Tiers" permission/reputation system). You do not have
access to the conversations where these were designed — this prompt gives
you the conventions you need instead of assuming you'll infer them from code
alone.

Your job has two parts: **(1) audit the current state of documentation in
this repo**, and **(2) produce or update a single canonical `CONTEXT.md`**
that persists the project's real architectural decisions so future work
(by you, by another model, or by the human developer) doesn't have to
rediscover them by reading every file from scratch.

---

## Part 1 — Documentation Audit

Scan the repository for existing documentation: `README.md`, any file under
a `/docs` directory, inline comments describing architecture (not
line-by-line code comments — look for header-level comments explaining
*why*, not *what*), any spec or plan `.md` files checked into the repo, and
`package.json` scripts/descriptions that imply intended usage.

For each piece of documentation you find, check:

1. **Does it match the code?** Open the files it describes. Flag anywhere
   documentation describes behavior, a schema, a command, or a config
   variable that no longer matches what's actually implemented. Don't
   silently "fix" the doc to match the code or vice versa — flag the
   mismatch and note which one looks more likely to be current (e.g. a
   recently-modified file vs. a doc with an old timestamp reference).
2. **Is it complete?** Cross-check every table in the "Established
   Conventions" section below against the actual codebase. If a convention
   listed there (e.g. per-guild scoping, a specific env var, a rate-limit
   pattern) isn't documented anywhere in the repo, that's a gap — note it.
3. **Is it consistent in terminology?** This project has accumulated
   several subsystems built at different times. Watch specifically for:
   inconsistent naming for the same concept (e.g. "role line" vs. "persona
   line" vs. "system prompt fragment" all referring to the same thing),
   or a term reused for two different things across subsystems.
4. **Is anything orphaned?** Documentation describing a file, table, or
   command that no longer exists in the codebase at all (fully removed,
   not just renamed).

Produce your findings as a numbered list before moving to Part 2 — don't
skip straight to writing `CONTEXT.md` without surfacing what you found.

---

## Part 2 — Build or Update `CONTEXT.md`

`CONTEXT.md` is not a README (that's for humans installing/running the bot)
and not an API reference. It is a **decisions record** — the kind of file
that answers "wait, why did we build it this way?" six months from now,
for a person or a model who wasn't there when it was decided. If
`CONTEXT.md` already exists, update it in place — preserve any accurate
existing content, correct anything that's drifted from the code per your
Part 1 findings, and fill genuine gaps. Don't regenerate it from scratch if
most of it still holds up.

### Required structure

```markdown
# skarn-bot — Architecture & Design Context

## Purpose of this file
[one paragraph — this file exists so decisions aren't re-litigated or
re-discovered from scratch; link to it from README]

## Core architectural pattern
[Vertical slice architecture: each feature owns its command definition,
handler, and data access together. No shared "god" file per concern.
Persona identity, role registry, and token budgets are the one deliberately
shared layer — every AI-powered surface routes through the same
buildSystemPrompt() function, no exceptions, even when a command needs no
state/memory context (it passes empty strings rather than building its own
prompt inline).]

## Scoping conventions
[Table: which subsystems are per-guild vs. account-wide, and why. E.g.
Realm and Derived Memory are per-guild (user_id, guild_id) composite keys;
Confidant Mode is account-wide by design since DMs have no guild context;
this was an explicit decision point once before (Realm v1 originally had
an inconsistent mix of scoping across its own tables before being
corrected) — don't let a new feature introduce scoping ambiguity without
stating the choice explicitly here.]

## Rate limiting and cost control
[Table: every independent rate-limit bucket in the system, its window,
its ceiling, and why it's separate from the others. Each major feature
(general persona commands, Realm, Confidant, Derived Memory extraction)
intentionally has its OWN bucket — reusing a shared bucket across features
with different usage shapes was tried and reverted once already, because a
single Realm session or Confidant conversation could exhaust a budget
sized for occasional one-shot commands within minutes. Any new AI-calling
feature needs its own bucket, not a shared one, unless there's a specific
reason to merge them — state that reason explicitly if it ever happens.]

## Persona and role conventions
[- SKARN_CORE_IDENTITY is the one unchanging voice constant, never
  duplicated or paraphrased elsewhere.
- Every AI command's role-specific instruction lives in persona/roles.js's
  `roles` object — never inlined in a command file.
- Every role has a paired token budget in `roleTokenBudgets` — no command
  uses a bare/ungoverned max_tokens value.
- Temperature is set deliberately per role type: low (~0.2-0.3) for
  factual/extraction/summarization tasks, higher (~0.7-0.8) for narrative/
  conversational tasks. Document the reasoning inline if you add a role
  that breaks this pattern.]

## Memory systems — what's separate and why
[This project has FOUR distinct memory stores, deliberately kept apart:
1. user_memory (/etch) — explicit, user-asserted, user-controlled facts
2. derived_memory — passive, AI-extracted, relevance-ranked via embeddings,
   opt-outable
3. Realm's realm_npc_memory — in-fiction NPC memory, scoped to the game
   world, never bleeds into real-world persona context
4. confidant_messages / running_summary — private DM thread memory,
   explicitly walled off from the public persona in both directions
Do not let a future feature quietly merge two of these without documenting
why the wall came down — the separation was deliberate in each case.]

## Guardrails that are load-bearing, not decorative
[List: content-safety rules baked directly into role-line prompts (no
romantic/sexual content in Confidant Mode, fantasy-violence-only tone in
Realm), the crisis-detection path in Confidant Mode that's exempt from
rate limiting, the sensitivity-category exclusions in Derived Memory
extraction, the decay-only (no admin override) design of Friend Tiers'
auto-promotion paired with a SEPARATE admin-controlled permission-flag
layer for actual access control. Note explicitly: these aren't stylistic
choices, don't relax them for convenience during future refactors without
re-deriving why they were added.]

## Known trade-offs, accepted deliberately
[Running list of things that were considered and consciously left as-is
rather than fixed — e.g. conversation content stored in plaintext with no
encryption at rest; Friend Tiers' decay-only anti-gaming can't stop an
actively-present-but-disruptive user from climbing tiers (permission flags
are the intended tool for that case instead); no timezone-aware scheduling
for any proactive/daily job, fixed UTC run times only. Each entry: what the
trade-off is, why it was accepted, what would need to change to revisit it.]

## Cross-cutting bugs already found and fixed once
[Short list of bug CLASSES already discovered and corrected in this
project's history, so they aren't reintroduced by a future feature copying
an old pattern: (1) double-write races on any in-memory-then-persisted
counter/state machine — always compute-once-write-once within a single
function call; (2) concurrent-message double-processing — any handler that
can receive two rapid inputs for the same user needs a per-user
processing lock before it does anything stateful; (3) a state/value
computed on message ARRIVAL should never represent "this channel has been
silent" — idle-only states belong exclusively to a separate decay/cleanup
job, never the arrival-time handler itself.]

## Environment variables in use
[Table: every env var referenced anywhere in the codebase, one line each on
what it controls and its default if unset. Audit this against Part 1 —
this is the single most common place documentation silently drifts from
code, since a new var is easy to add in code and easy to forget to
document.]

## Open questions / not yet decided
[Anything you found during the audit that seems like a real unresolved
design gap, not just a documentation gap — flag it here rather than
guessing at an answer and writing it down as if it were settled.]
```

### Rules while writing this file

- **Do not invent conventions that aren't actually reflected in the code.**
  If a section above doesn't apply to what you find in this repo (e.g. no
  Friend Tiers system exists yet), say so plainly rather than filling the
  section with speculative content — `CONTEXT.md` should describe what
  exists, not what an earlier design conversation once proposed if it was
  never actually built.
- **Preserve rationale, not just facts.** "Confidant Mode is account-wide"
  is a fact. "Confidant Mode is account-wide because DMs have no guild
  context, and every other feature in this bot is per-guild" is the kind
  of sentence this file exists to hold onto. Always write the reasoning,
  not just the conclusion.
- **Flag drift, don't silently resolve it.** If code and existing docs
  disagree, note both and say which you believe is current and why,
  but don't erase the discrepancy without a trace — leave enough detail
  that a human can double-check your judgment call.
- **Keep it text, not code.** Link to specific files by path rather than
  reproducing large code blocks — this file should stay readable end to
  end in a few minutes, not become a second copy of the source tree.

---

## Deliverables

1. The Part 1 audit findings, as a plain numbered list, presented first.
2. A complete, updated `CONTEXT.md` at the repo root.
3. A short summary (5-10 lines max) of what changed if `CONTEXT.md` already
   existed, or a note that it was created fresh if it didn't.

Do not modify any other files in the repository as part of this task —
this is a documentation-only pass. If the audit surfaces something that
looks like an actual bug (not just a doc mismatch), note it in the audit
findings under a clearly separate heading rather than fixing it inline.
