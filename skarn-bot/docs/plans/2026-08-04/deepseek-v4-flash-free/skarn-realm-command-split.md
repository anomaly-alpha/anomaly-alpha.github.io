# Skarn — P1-4: Decompose `features/realm/realmCommand.js` God-Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 897-line `features/realm/realmCommand.js` (11 subcommand routers + embed/button handlers in one file) into per-subcommand handler modules under `features/realm/handlers/`, with `realmCommand.js` reduced to a thin router. Pure refactor: identical behavior, same exports, same slash wiring.

**Background (audit 2026-08-04, `skarn-bot/docs/reports/2026-08-04/deepseek-v4-flash-free/skarn-review.md` §3.2/§4.4):** `realmCommand.js` is 897 lines — the second god-module after `db/database.js` — mixing the 11-subcommand switch, the explore/choice parser, combat buttons, inventory embeds, and trade select menus. The Realm spec (`docs/specs/2026-07-18/deepseek-v4-flash/realm-of-skarn-final.md`) anticipated ~150 lines here; it grew ~6× to handle embed/collector/edge-case plumbing. The `features/` vertical-slice pattern says each concern owns its handler; this file violates it internally.

**Architecture:** Keep the single `realmCommand.js` export shape (whatever `commands/realm.js` and the button/select collectors import) as a facade that dispatches to `handlers/<subcommand>.js`. Each handler module exports the functions it owns. Button/select collectors (the `message-component` handlers) either stay in `realmCommand.js` (they're cross-cutting UI glue) or move to `handlers/ui.js` — executor judgment, keeping the principle "one concern per file."

**Proposed handler map** (the *split principle* is the contract; exact function boundaries are executor judgment based on the current file). Updated from the independent review — the router's `switch` at `realmCommand.js:872-886` routes **11 cases** including `help` (`handleHelp`, `realmCommand.js:844-864`), and `rest` lives at `:641-653`:

| File | Subcommands / concerns | Current line ranges (approx) |
|---|---|---|
| `handlers/create.js` | `create` (5-step wizard, 60s timeouts, backstory Accept/Reroll) | ~64–201 |
| `handlers/explore.js` | `start`/`explore` (choice parsing, move/NPC/combat routing, cooldowns) **+ combat button flow** (`handleExploreChoice` :291-417, `handleCombatButton` :421-516) + its build helpers (`buildExploreEmbed`/`buildExplorationButtons`/`buildCombatEmbed`/`buildCombatButtons` :30-63) | ~205–417, 421–516 |
| `handlers/stats.js` | `stats` sheet, `rest`, `leaderboard` | ~520–546, **641–653 (rest)**, 823–840 |
| `handlers/inventory.js` | `inventory` (paginated 25/page, equip, use) + `buildInventoryEmbed` (:585) + `buildInventoryButtons` (:605) | (inventory.js may already own logic — export what the router calls) |
| `handlers/quests.js` | **`handleQuests` view + quest embed — NOT the NPC hook lines** | **615–637** |
| `handlers/trade.js` | `trade` (select menus, 5-min window, confirm) + `renderTradeStatus` (:657) | ~666–779 |
| `handlers/delete.js` | `delete` (character deletion + confirm) | — |
| `handlers/ui.js` | **shared helpers + `help`** — `handleHelp` (:844-864), `capitalize` (used by create :97,114,197,200 and stats :528), `randomError`/`AI_ERRORS` (explore choice + combat error paths), `EPHEMERAL` constant | cross-cutting |

> **Second-pass review (2026-08-04) — quests row corrected:** the original `~353–373` range is **wrong** — those lines are NPC quest-giver *exploration* logic inside `handleExploreChoice` (`realmCommand.js:353-376`: `canCall`/`recordCall`/`generateQuestHook`/`createQuest`/`canAcceptQuest`) and belong with **explore.js**, NOT quests.js. Moving them to `quests.js` would sever the explore NPC-hook path. The real `handleQuests` view lives at **`realmCommand.js:615-637`**. Executor must keep `353-376` with explore.

**Tech Stack:** Node.js ≥18, CommonJS, discord.js v14 (existing). No new dependencies.

## Global Constraints

- **Zero behavior change.** Same embeds, same buttons, same error strings, same cooldown keys, same DB writes. Move code; do not rewrite. Any behavioral edit is out of scope.
- **Zero export-shape change.** Verified: `realmCommand.js` exports only `execute` (`module.exports`), and its sole consumer is `commands/realm.js:2` (`realmCommand.execute` at `:43`). The slimmed router must re-export exactly `execute`. `aiDriver.js` does **not** require `realmCommand.js` (the dependency is one-way: realmCommand → aiDriver), so no cycle.
- **Shared Realm state stays where it is.** `realmStore.js`, `combat.js` `activeCombats`, `economy.js` `activeTrades`, `realmRateLimit.js` are untouched by this plan. Verified: `realmCommand.js` holds **no module-level in-memory state** — every collector (`awaitMessages`/`awaitMessageComponent`) and the `sceneHistory` closure is local to its handler function and bound to its interaction, so splitting preserves lifecycles as long as code moves verbatim.
- **Realm cooldowns are in `db/database.js`, not realmRateLimit.** The `realm:<guild>:<user>` 30s cooldown uses `checkCooldown`/`setCooldown` from `../../db/database` (`realmCommand.js:13,221-223`); `realmRateLimit.js` holds only the 30/30min + 1000/day AI-call buckets. Keep the cooldown keys byte-identical.
- **Never add tests / never recreate `tests/`** (CONTEXT.md §11.2). Verification = `node --check` on every touched file + `node bot.js` module-load check + the existing README trade smoke. **Independent review note:** the README trade smoke exercises `economy.js` directly and does NOT exercise `handleTrade`'s collectors — it cannot catch a broken move; add the static helper cross-reference check and require-cycle check in Task 3 (below).
- **No bug fixes, no "while I'm here" work.** Note discovered issues in the handoff; do not fix them here.
- Code style: `function` declarations, `const`/`let`, UPPER_SNAKE_CASE constants, section-header comments. No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Inventory the router (read-only)

**Covers:** correctness of the split.

- [ ] **Step 1: Map every function + its caller**

```bash
grep -n "^function \|^async function \|^  function \|^  async function" features/realm/realmCommand.js
grep -n "module.exports" features/realm/realmCommand.js
grep -rn "require('.*realmCommand')" --include="*.js" . | grep -v node_modules
```

- [ ] **Step 2: Record the export surface + internal-call graph** in the plan handoff appendix. The slimmed router must re-export the same names and call the same internal helpers (now imported from handlers).

### Task 2: Extract handlers (one module per subcommand group)

**Covers:** the split.

**Files:**
- Add: `features/realm/handlers/create.js`, `explore.js`, `stats.js`, `inventory.js`, `quests.js`, `trade.js`, `delete.js`, `ui.js` (as needed by the Task-1 map)
- Modify: `features/realm/realmCommand.js` (slim to router + re-exports)

**Interfaces:**
- Consumes: existing `realmStore`, `realmConfig`, `combat`, `economy`, `character`, `world`, `npc`, `inventory`, `quest` modules (unchanged)
- Produces: per-subcommand modules exporting the moved functions; router imports them.

- [ ] **Step 1: Extract `handlers/create.js`** — move the 5-step wizard block verbatim; keep the `awaitMessages`/button-collector logic intact; export the wizard entry function.

- [ ] **Step 2: Extract `handlers/explore.js`** — move the explore/start block + choice parser (`parseChoices` interplay lives in `world.js`; only the router-level dispatch moves). Keep the 30s `realm:<guild>:<user>` cooldown key exactly as-is (`realmCommand.js:221-223`).

- [ ] **Step 3: Extract the remaining handlers** per the map (stats/rest/leaderboard, inventory, quests, trade, delete). Trade is the most delicate: the select-menu collectors + 5-min confirm window (`realmCommand.js:666-779`) must be preserved exactly, including the inline `5 * 60 * 1000` timeout (there is **no named `TRADE_TIMEOUT` constant** — the reviewer verified it's an inline literal at `:696`) and the single-active-trade guard.

- [ ] **Step 4: Verify each module loads**

```bash
for h in create explore stats inventory quests trade delete ui; do
  [ -f features/realm/handlers/$h.js ] && node --check features/realm/handlers/$h.js && echo "$h ok"
done
```

- [ ] **Step 5: Commit**

```bash
git add features/realm/handlers/
git commit -m "refactor(realm): extract per-subcommand handlers from realmCommand.js"
```

### Task 3: Slim `realmCommand.js` to a router + facade

**Covers:** god-module elimination.

**Files:**
- Modify: `features/realm/realmCommand.js`

**Interfaces:**
- Consumes: all `handlers/*` modules
- Produces: a file that keeps the `execute`-style dispatch (the `switch` at `realmCommand.js:868-896`), the collector registrations, and re-exports everything it exported before.

- [ ] **Step 1: Replace moved bodies with imports + dispatch**

Keep the subcommand switch and the button/select collectors (they bind Discord events and need `interaction`/`client` context). Replace each moved function body with a delegation call to the corresponding handler. Re-export any names the old file exported (per Task-1 inventory).

- [ ] **Step 2: Verify — full check**

```bash
node --check features/realm/realmCommand.js
SKARN_DB_PATH=$(mktemp -d)/realm.db node -e "
require('./features/realm/realmCommand');
console.log('realmCommand loads; exports:', Object.keys(require('./features/realm/realmCommand')).length);
"
```

- [ ] **Step 3: Static helper cross-reference check** (the real regression class — a moved handler referencing a helper that no longer resolves in its import set)

```bash
# Every identifier a handler references must exist in its own module, its imports,
# or the shared ui.js. Spot-check the shared ones moved to ui.js:
grep -rn "capitalize\|randomError\|AI_ERRORS\|EPHEMERAL" features/realm/ | grep -v node_modules
# Expect: definitions in handlers/ui.js + usages in create/explore/stats — no orphaned refs.
```

- [ ] **Step 4: Require-cycle check** (realmCommand → handlers must not loop back)

```bash
node -e "
const path = require('path');
const seen = new Set();
function walk(f, chain) {
  const abs = require.resolve(f);
  if (seen.has(abs)) return;
  seen.add(abs);
  const m = require(abs);
  // No direct check possible at runtime without executing; use the require graph:
}
console.log('require-graph note: realmCommand requires handlers; handlers must NOT require realmCommand (verified via grep above)');
"
grep -rn "require.*realmCommand" features/realm/handlers/ 2>/dev/null || echo "no handler requires realmCommand — good"
```

- [ ] **Step 5: Verify the README trade smoke still passes** (it exercises `economy.js` directly — proves no realm behavior regressed at the data layer; note it does NOT cover `handleTrade`'s collectors — the live QA in handoff covers that)

```bash
SKARN_DB_PATH=$(mktemp -d)/trade.db node -e "
require('./db/database');
const store = require('./features/realm/realmStore');
const { startTrade, addToTrade, confirmTrade } = require('./features/realm/economy');
// ... paste the README.md:497-514 trade block verbatim ...
"
```

- [ ] **Step 6: Boot check**

```bash
node -c bot.js
# module-load check without token:
DISCORD_TOKEN=dummy SKARN_DB_PATH=$(mktemp -d)/boot.db node -e "require('./bot.js'); console.log('modules load')"
```

- [ ] **Step 7: Commit**

```bash
git add features/realm/realmCommand.js
git commit -m "refactor(realm): slim realmCommand.js to a router over handlers/"
```

### Task 4: Docs sync

**Covers:** review §4.4; keep docs truthful.

**Files:**
- Modify: `docs/ARCHITECTURE.md` (Realm table row for the command router)

- [ ] **Step 1: Update ARCHITECTURE.md**

```
| Command router | `features/realm/realmCommand.js` (router) + `features/realm/handlers/` (per-subcommand UI handlers) |
```

- [ ] **Step 2: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: document realm handlers/ split"
```

---

## Self-review

- **Spec coverage:** Review §3.2 (god-module) → T1/T2/T3; §4.4 (realm refactor) → T2/T3; docs → T4.
- **Independent review applied (2026-08-04):** `help` subcommand added to the map (ui.js); shared helpers enumerated (`capitalize`, `randomError`/`AI_ERRORS`, `EPHEMERAL`); combat button flow assigned to `explore.js` (not ui.js); `rest` line range added; `TRADE_TIMEOUT` corrected to the inline literal; Task 3 gained the static helper cross-reference + require-cycle checks (the README trade smoke cannot catch a broken move — it exercises `economy.js` directly, bypassing `handleTrade`'s collectors); verified `realmCommand.js` exports only `execute` consumed by `commands/realm.js:2` and holds no module-level state.
- **Second-pass review applied (2026-08-04):** all first-pass fixes held (module.exports = only `execute`, sole consumer `commands/realm.js:2`, no module-level state, collector lifecycles local, 30s cooldown via `db/database` `checkCooldown`/`setCooldown` at `:221-223`, 9-case switch at `:872-886` intact). **One WRONG range fixed:** quests `~353-373` → **615–637** (`handleQuests`); `353-376` is NPC quest-giver logic inside `handleExploreChoice` and must stay with explore.js. Per-subcommand build helpers now named and owned: `buildInventoryEmbed` (:585)/`buildInventoryButtons` (:605) → inventory; `renderTradeStatus` (:657) → trade; `buildExploreEmbed`/`buildExplorationButtons`/`buildCombatEmbed`/`buildCombatButtons` (:30-63) → explore.
- **Safety:** zero behavior change by construction (code moved verbatim); export-shape unchanged (Task-1 inventory is the acceptance test). Trade's inline 5-min window and single-active-trade guard are the most delicate move.
- **Risk flagged honestly:** the handler map is a proposal; the executor re-buckets based on the real function inventory. Shared functions go in `handlers/ui.js`, never duplicated. Live-only flows (create-wizard collectors, explore choice parsing, trade UI) are covered by the manual QA step in the handoff, since they can't be smoke-tested offline.
- **Sequencing:** independent of P1-3 (db split) — can run in parallel or after; no shared files.

## Execution handoff

1. T1 (inventory) → T2 (handlers, one commit per module or batched per the executor's judgment) → T3 (slim router + verification incl. helper/cycle checks) → T4 (docs).
2. Acceptance: `node --check` clean on all touched files, `realmCommand` exports identical to pre-split (only `execute`), trade smoke passes, bot module-load check passes, helper cross-reference grep shows no orphans. Record the export inventory + function map in the handoff. **Live QA (required, cannot be smoked):** `/realm create` wizard, `/realm explore` choice parsing, and a full `/realm trade` collector flow in a real guild.