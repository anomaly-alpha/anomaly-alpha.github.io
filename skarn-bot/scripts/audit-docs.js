// ===== AUDIT: DOC/CODE DRIFT GUARD =====
// Re-verifies the four drift claims fixed by plan P1-6 (2026-08-04).
// If any PASS line flips to FAIL, the code drifted from the docs again.
const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + label);
  if (!cond) process.exitCode = 1;
}

// 1. Realm driver routes through the model router (NOT a hardcoded model)
const aiDriver = read('features/realm/aiDriver.js');
check('realm driver uses selectModel', /selectModel\s*\(/.test(aiDriver));

// 2. Socratic/Advice tier is populated (NOT dead surface)
const promptCtx = read('features/promptContext.js');
check('socraticLine populated', /getSocraticQuestion\s*\(/.test(promptCtx) && /isFullTier\s*=\s*true/.test(promptCtx));

// 3. Rate limit ceiling is 50 (NOT 10)
const rateLimit = read('lib/rateLimit.js');
check('RATE_LIMIT_MAX_CALLS = 50', /RATE_LIMIT_MAX_CALLS\s*=\s*50/.test(rateLimit));

// 4. hostileDetector.js is gone (Gates 2-3 deleted)
check('hostileDetector.js deleted', !fs.existsSync(path.join(__dirname, '..', 'features/safety/hostileDetector.js')));