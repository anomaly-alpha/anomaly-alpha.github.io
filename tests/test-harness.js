// tests/test-harness.js
const results = [];
let currentSuite = '';

function describe(name, fn) {
  currentSuite = name;
  fn();
}

function it(name, fn) {
  try {
    fn();
    results.push({ suite: currentSuite, name, pass: true });
  } catch (e) {
    results.push({ suite: currentSuite, name, pass: false, error: e.message });
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: expected ${expected}, got ${actual}`);
}

function assert_true(val, msg) {
  if (!val) throw new Error(`${msg || 'assert_true'}: expected truthy, got ${val}`);
}

function assert_false(val, msg) {
  if (val) throw new Error(`${msg || 'assert_false'}: expected falsy, got ${val}`);
}

function runTests() {
  const el = document.getElementById('results');
  let html = '';
  let passed = 0, failed = 0;
  for (const r of results) {
    if (r.pass) {
      html += `<div class="pass">✓ ${r.suite} › ${r.name}</div>`;
      passed++;
    } else {
      html += `<div class="fail">✗ ${r.suite} › ${r.name}: ${r.error}</div>`;
      failed++;
    }
  }
  html += `<div style="margin-top:1rem;font-weight:bold">${passed} passed, ${failed} failed</div>`;
  el.innerHTML = html;
}
