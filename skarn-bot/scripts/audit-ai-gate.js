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