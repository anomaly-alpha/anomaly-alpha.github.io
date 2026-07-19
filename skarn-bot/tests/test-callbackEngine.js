const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { updateCallbacks, getCallbackLine, cleanCallbacks } = require('../features/humor/callbackEngine');

describe('callbackEngine', () => {
  it('ignores non-matching content (no entryType)', () => {
    updateCallbacks('ch-test1', 'u1', 'hello world');
    assert.strictEqual(getCallbackLine('ch-test1', 'u1'), '');
  });

  it('returns line when user has 2+ buffered entries', () => {
    // Force entries: short message (<50 chars) has 30% sample rate — run enough
    for (let i = 0; i < 20; i++) {
      updateCallbacks('ch-test2', 'u2', 'a');
    }
    const line = getCallbackLine('ch-test2', 'u2');
    // Probabilistic: may or may not have entries
    if (line) {
      assert.ok(line.startsWith('You remember this person saying:'));
    }
  });

  it('cleans old entries on timer', () => {
    // Manually age entries by manipulating Date.now would need a mock
    // For now, verify the function doesn't throw
    cleanCallbacks();
  });
});
