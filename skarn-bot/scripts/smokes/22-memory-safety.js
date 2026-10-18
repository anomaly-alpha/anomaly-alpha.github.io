// ===== SMOKE: AUTO-MEMORY SENSITIVITY FILTER =====
const assert = require('assert');
const { isSensitiveMemoryCandidate } = require('../../features/memory/memorySafety');

assert.strictEqual(isSensitiveMemoryCandidate('prefers tea without sugar'), false);
assert.strictEqual(isSensitiveMemoryCandidate('working on a long-term gardening project'), false);
assert.strictEqual(isSensitiveMemoryCandidate('has a medical diagnosis and takes medication'), true);
assert.strictEqual(isSensitiveMemoryCandidate('recovering from trauma after abuse'), true);
assert.strictEqual(isSensitiveMemoryCandidate('shared a bank account and credit card number'), true);
assert.strictEqual(isSensitiveMemoryCandidate('uses password reset recovery code'), true);
assert.strictEqual(isSensitiveMemoryCandidate('home address is 12 Example Street'), true);
assert.strictEqual(isSensitiveMemoryCandidate(''), true);
assert.strictEqual(isSensitiveMemoryCandidate(null), true);

console.log('Memory safety smoke passed');
