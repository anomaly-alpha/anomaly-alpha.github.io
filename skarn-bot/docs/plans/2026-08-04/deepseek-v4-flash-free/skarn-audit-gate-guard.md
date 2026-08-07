# Skarn — P0-1: Moderation & Rate-Limit Gate Regression Guard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure **every** OpenAI call that can touch user text funnels through the central `moderatedChatCompletion()` gate (`ai/client.js`) — for silence enforcement, rate limiting, and input/output moderation — and that a regression cannot silently re-open a bypass.

**Background (audit 2026-08-04, `skarn-bot/docs/reports/2026-08-04/deepseek-v4-flash-free/skarn-review.md` §3.4/4.6):** The 2026-08-02 audit-fix pass already routed all 10 former bypass sites through the gate — verified this plan's author by grep: `realm/aiDriver.js:32` (`bucket:'realm'`), `serverMemory/omen/omenJob.js:24,43` (`omen`), `serverMemory/chronicle/chronicleJob.js:33` (`chronicle`), `intelligence/toneAnalyzer.js:52` (`tone`), `conversation/topicExtractor.js:9` (`topic`), `conversation/summarizer.js:29` (`summarizer`), `wisdom/storyEngine.js:69` (`story`), `discordNative/attentionGate.js:66` (`attention`), `lib/weatherScheduler.js:56` (`weather`), and `preprocessing/postProcessor.js:25`. The only raw `.chat.completions.create` left is inside the gate itself (`ai/client.js:85`). **The residual risk is not "bypasses exist" — it is that nothing stops a future change from adding one.** This plan adds a deterministic guard plus two read-path checks that protect the invariants that ran the 10-sites work in the first place.

**Architecture:** A repo-local `scripts/audit-ai-gate.js` that statically scans all `.js` files under `features/`, `lib/`, `commands/`, `ai/` **and the repo root + `games/` + `db/` + `persona/` + `scripts/`** (there is no top-level `realm/` dir — the Realm code lives under `features/realm/`) for direct OpenAI chat/Responses-API calls and fails closed, plus a runtime smoke verifying the gate rejects a silenced + over-quota user **against a seeded temp DB through the real gate** (no mock). Wired as `npm run audit:gate`. No changes to `ai/client.js`.

> **Review-applied (2026-08-04, independent gap review):** fixes incorporated — (1) `RATE_LIMIT_MAX_CALLS` is a private const in `lib/rateLimit.js:13`, **not exported** (exports are `{ canCall, releaseCall, getUsage, getRateLimitMessage }` at `lib/rateLimit.js:48`) — the smoke must hardcode 50 or the plan must add the export; (2) `SCAN_DIRS` included a nonexistent top-level `realm/`; (3) the scanner's chat patterns missed the newer `client.responses.create` (Responses API) — added; (4) Task 3's smoke originally re-implemented the gate as a mock — replaced with real-DB seeding (corrected code below).

**Tech Stack:** Node.js ≥18, CommonJS, no runtime dependencies (uses `fs`/`path`/`child_process`).

## Global Constraints

- **Never add tests / never reintroduce the removed `tests/` suite** (CONTEXT.md §11.2, deliberate). This plan adds a static *audit* script + `node -e` smokes, matching the existing "verified by `node -e` temp-DB smokes" convention — not a test framework.
- **Do NOT change `ai/client.js`.** The gate is the source of truth; this plan only guards that it is the *only* entry point.
- **Embeddings note:** `embeddings.create` (`features/intelligence/embeddings.js:5`) is not a chat completion and carries no user-authored prompt, so it is intentionally NOT routed through `moderatedChatCompletion` (no moderation need). The audit script must allow `client.embeddings.create` and any `embedText` call, while flagging *chat* completions.
- **Fail closed:** the audit script exits non-zero on any unexpected direct chat-call site, so it can gate a pre-commit step or CI later.
- Code style: `function` declarations, `const`/`let`, UPPER_SNAKE_CASE constants, section-header comments. No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Write `scripts/audit-ai-gate.js`

**Covers:** Review §3.4, §4.6 (moderation bypass re-audit); regression guard.

**Files:**
- Add: `scripts/audit-ai-gate.js`

**Interfaces:**
- Consumes: filesystem walk of `features/`, `lib/`, `commands/`, `ai/`, `games/`, `db/`, `persona/`, `scripts/`, plus root-level `*.js` (`bot.js`, `deploy-commands.js`, `rich-presence.js`, `ecosystem.config.js`) (`.js` only, excluding `node_modules`)
- Produces: exits 0 when all direct chat/Responses-API call sites are within `ai/client.js` (or are legitimately exempted); exits 1 listing offenders otherwise.

- [ ] **Step 1: Create the scanner**

```js
// ===== AUDIT: DIRECT AI-CALL GUARD =====
// Every chat completion that can carry user text MUST go through
// moderatedChatCompletion() in ai/client.js (silence + rate-limit +
// input/output moderation). This scanner fails if a direct call creeps in.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Root-level files + all dirs (there is no top-level realm/ — it's features/realm/).
const SCAN_DIRS = ['features', 'lib', 'commands', 'ai', 'games', 'db', 'persona', 'scripts'];
const ROOT_FILES = ['bot.js', 'deploy-commands.js', 'rich-presence.js', 'ecosystem.config.js'];
const GATE_FILE = 'ai/client.js';
const CHAT_PATTERNS = [
  /\.chat\.completions\.create\s*\(/,
  /\.chat\.completions\.stream\s*\(/,
  /\.responses\.create\s*\(/,          // Responses API — chat-completion equivalent
  /createChatCompletion\s*\(/,
];
// KNOWN LIMITATION (second-pass review): alt-spellings — `const {chat}=client; chat.completions.create`,
// backtick/template forms — would not match. No such site exists in the tree today; if one appears,
// extend these patterns. The patterns above catch every current offender.
// Legitimate: the gate itself + an allowlist keyed by file suffix/expression.
const ALLOWLIST = [
  'ai/client.js', // the single chokepoint
];

function listJs(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(listJs(p));
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

let offenders = [];
const files = [];
for (const rel of SCAN_DIRS) files.push(...listJs(path.join(ROOT, rel)));
for (const f of ROOT_FILES) { const p = path.join(ROOT, f); if (fs.existsSync(p)) files.push(p); }
for (const file of files) {
  const relFile = path.relative(ROOT, file).split(path.sep).join('/');
  if (ALLOWLIST.includes(relFile)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const re of CHAT_PATTERNS) {
    if (re.test(src)) {
      offenders.push(relFile);
      break;
    }
  }
}

if (offenders.length > 0) {
  console.error('[audit-ai-gate] FAIL: direct chat-completion calls outside the gate:');
  offenders.forEach((f) => console.error('  - ' + f));
  process.exitCode = 1;
} else {
  console.log('[audit-ai-gate] OK: all chat-completion calls route through ai/client.js');
}
```

- [ ] **Step 2: Verify against current tree**

```bash
node scripts/audit-ai-gate.js
```

Expected: `[audit-ai-gate] OK: all chat-completion calls route through ai/client.js` and exit 0. (Confirmed this plan's author: the only direct `.chat.completions.create` is `ai/client.js:85`; `embeddings.create` at `embeddings.js:5` does not match the chat patterns.)

- [ ] **Step 3: Verify it actually catches a bypass (negative test)**

```bash
mkdir -p /tmp/audit-test/features && cp -r features /tmp/audit-test/features 2>/dev/null
# Inject a fake bypass into a scratch file inside a SCAN_DIR copy
mkdir -p /tmp/audit-test/features/scratch
printf 'const x = require("openai"); x.chat.completions.create({});\n' > /tmp/audit-test/features/scratch/bad.js
node -e "
const fs = require('fs');
const ROOT = '/tmp/audit-test';
fs.writeFileSync('target-path.js', 'const GATE = ' + JSON.stringify(ROOT) + ';');
"
# Point the scanner at the scratch copy via a tiny wrapper (run inline):
node -e "
const re = /\.chat\.completions\.create\s*\(/;
const src = require('fs').readFileSync('/tmp/audit-test/features/scratch/bad.js','utf8');
console.log('negative-test catches bypass:', re.test(src) === true);
"
rm -rf /tmp/audit-test
```

Expected: `negative-test catches bypass: true`. This proves the pattern matches what it must, without touching the real tree.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-ai-gate.js
git commit -m "feat: add AI gate audit script (fail-closed on direct chat calls)"
```

### Task 2: Wire `npm run audit:gate` + document

**Covers:** Review §4.7 (CI-less gate); packaging.

**Files:**
- Modify: `package.json` (add `audit:gate` script)
- Modify: `README.md` (Verification section, add the audit line)

- [ ] **Step 1: Add script to `package.json`**

Add to `"scripts"` — **final form (second-pass review resolved the Task 2/Task 3 collision):** the smoke is chained into the same script so one command runs both the static scan and the runtime gate check. Do NOT add a scan-only version in Task 2 and overwrite it in Task 3 — define it once, here, in its final chained form:
```json
    "audit:gate": "node scripts/audit-ai-gate.js && SKARN_DB_PATH=$(mktemp -d)/gate.db node scripts/smoke-gate.js"
```
> **Note (second-pass review):** the `$(mktemp -d)` form is macOS/Linux-portable but may differ on Windows; if the deployment is Windows-only, replace with a Node one-liner (`node -e "require('fs').mkdtempSync(require('os').tmpdir()+'/gate-')"`). Keep the chained form otherwise.

- [ ] **Step 2: Append to README Verification block**

```bash
    # Gate coverage audit — fails if any direct OpenAI chat call bypasses moderatedChatCompletion():
    npm run audit:gate
```

- [ ] **Step 3: Verify the script runs via npm**

```bash
npm run audit:gate
```

Expected: `[audit-ai-gate] OK: ...` and exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore: add npm run audit:gate for AI gate coverage"
```

### Task 3: Add a runtime gate smoke (silenced + over-quota rejection)

**Covers:** Review §3.4 (silence fail-closed); validates the gate behaves under the two admission checks it guards.

**Files:**
- Add: `scripts/smoke-gate.js` (or document an inline `node -e` block — prefer a file so `npm run audit:gate` can chain it)

**Interfaces:**
- Consumes: `moderatedChatCompletion` from `ai/client.js`, `isSilenced`/`recordStrike` from `features/safety/slurFilter.js`, `db` via `SKARN_DB_PATH`
- Produces: logs two lines proving the gate returns a safe message (no AI call) for (a) a silenced user, (b) an over-quota user.

- [ ] **Step 1: Write `scripts/smoke-gate.js`**

This smoke tests the **real** `moderatedChatCompletion` gate by seeding a fresh temp DB directly. It makes **no OpenAI call** — both admissions short-circuit before generation (silence at `ai/client.js:49`, over-quota at `:53`). Feedback from the independent review: the earlier mock-based sketch (which re-implemented admission logic) was dropped; we seed the exact DB rows `getStrikes()` and `canCall()` read instead.

```js
// ===== SMOKE: REAL GATE ADMISSION CHECK =====
// Seeds a temp DB, then calls the REAL moderatedChatCompletion. Both cases
// return { success:false, safeMessage } with zero network (silence + rate gate).
const { db } = require('../db/database');   // honors SKARN_DB_PATH
const now = Date.now();

// (a) silenced user: seed the same app_flags shape getStrikes() reads.
//     app_flags(flag_key, flag_value, created_at, expires_at) — schema:446
const STRIKE_LIMIT = 3;   // slurFilter.js:6 (STRIKE_LIMIT is private; do not import)
db.prepare('INSERT INTO app_flags (flag_key, flag_value, created_at, expires_at) VALUES (?,?,?,?)')
  .run('strike_siluser',
    JSON.stringify({ count: STRIKE_LIMIT, windowStart: now - 2000, silencedUntil: now + 60000 }),
    now, now + 60000);

// (b) over-quota user: fill the bucket (rate_limits(id,user_id,bucket,timestamp) — schema:344)
const RATE_LIMIT_MAX_CALLS = 50;   // private const in lib/rateLimit.js:13 — hardcode, do not import
const ins = db.prepare('INSERT INTO rate_limits (user_id, bucket, timestamp) VALUES (?,?,?)');
for (let i = 0; i < RATE_LIMIT_MAX_CALLS; i++) ins.run('bulkuser', 'test', now);

const { moderatedChatCompletion } = require('../ai/client');  // exported prop at ai/client.js:132
(async () => {
  const silenced = await moderatedChatCompletion({
    userId: 'siluser', bucket: 'test', messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('silenced user blocked:', silenced.success === false && !!silenced.safeMessage);
  const over = await moderatedChatCompletion({
    userId: 'bulkuser', bucket: 'test', messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('over-quota user blocked:', over.success === false && !!over.safeMessage);
})();
```

> **Note:** `RATE_LIMIT_MAX_CALLS` and `STRIKE_LIMIT` are **private** consts (`lib/rateLimit.js:13`, `slurFilter.js:6`) — not exported. Hardcode the literals here (or, as an optional follow-up, export them from their source modules). Do not read `require('..').RATE_LIMIT_MAX_CALLS` — it would be `undefined` and silently fall back to `|| 50`.

- [ ] **Step 2: Verify (expected output)**

```bash
SKARN_DB_PATH=$(mktemp -d)/gate.db node scripts/smoke-gate.js
```

Expected: `silenced user blocked: true` and `over-quota user blocked: true`.

- [ ] **Step 3: Confirm the chained `audit:gate` (already defined in final form in Task 2 Step 1)**

The script was defined once in its final chained form in Task 2 — no second definition here. Verify it end-to-end:
```bash
npm run audit:gate
```
Expected: `[audit-ai-gate] OK: ...`, then `silenced user blocked: true` and `over-quota user blocked: true`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-gate.js package.json
git commit -m "feat: add gate admission smoke (silenced + over-quota)"
```

---

## Self-review

- **Spec coverage:** Review §3.4 (moderation bypass) → T1 scanner; §4.6 (re-audit) → T1 + T3; §4.7 (CI-less gate) → T2. No review item left un-owned.
- **Independent review applied (2026-08-04):** scanner now covers root + `games/`/`db/`/`persona/`/`scripts/` and matches `responses.create`; the Task 3 smoke seeds `app_flags` + `rate_limits` and calls the real gate (no mock); `RATE_LIMIT_MAX_CALLS`/`STRIKE_LIMIT` are handled as hardcoded literals (private consts). Known fact: `moderatedChatCompletion`, `moderations.create`, and `chat.completions.create` are the only OpenAI SDK call sites in the tree — all in `ai/client.js` (+`embeddings.create` in `embeddings.js`, correctly out of one).
- **Second-pass review applied (2026-08-04):** all five verification points held (scanner coverage, chat patterns, smoke seeds match `getStrikes()`/`canCall()` exactly, gate short-circuits, npm chaining). Two minor fixes applied: (a) the `audit:gate` script is now defined **once** in final chained form in Task 2 (Task 3 no longer redefines it — resolves the scan-only vs scan+smoke collision), with a Windows-portability note for `$(mktemp -d)`; (b) documented the residual limitation that alt-spellings of OpenAI calls (`const {chat}=client; chat.completions.create`, template forms) would not match the chat patterns — no such site exists today, but a comment in the scanner flags it as a known limitation rather than silent coverage.

## Execution handoff

1. T1 (scanner) → T2 (npm script + docs) → T3 (runtime smoke). Execute with `subagent` style per house preference.
2. After T3, run `npm run audit:gate` and capture the exit code; the smoke is the last verification before the "done" claim.