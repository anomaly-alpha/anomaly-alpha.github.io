// ===== SMOKE ORCHESTRATOR =====
// Runs every scripts/smokes/*.js suite in its own temp-DB child process.
// Exit 0 only if all pass. No test framework — plain node scripts.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SMOKES_DIR = path.join(__dirname, 'smokes');
const suites = fs.readdirSync(SMOKES_DIR).filter((f) => f.endsWith('.js')).sort();

if (suites.length === 0) {
  console.error('[smoke] no suites found in scripts/smokes/');
  process.exit(1);
}

let failed = 0;
for (const suite of suites) {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-smoke-'));
  const res = spawnSync(process.execPath, [path.join(SMOKES_DIR, suite)], {
    env: { ...process.env, SKARN_DB_PATH: path.join(dbDir, 'smoke.db') },
    encoding: 'utf8',
  });
  if (res.status === 0) {
    console.log(`[smoke] PASS ${suite}`);
  } else {
    failed++;
    console.log(`[smoke] FAIL ${suite}`);
    console.log(res.stdout || '(no stdout)');
    console.error(res.stderr || '(no stderr)');
  }
}

console.log(failed === 0 ? `[smoke] all ${suites.length} suites passed` : `[smoke] ${failed}/${suites.length} suites failed`);
process.exitCode = failed === 0 ? 0 : 1;