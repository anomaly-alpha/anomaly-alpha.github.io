const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { updateWarmth, getWarmthLine, getPatienceLine, cleanWarmth } = require('../features/warmth/warmthManager');

describe('warmthManager', () => {
  it('updates sentiment and returns warmth line', () => {
    updateWarmth('u1', 'g1', 'i love this');
    updateWarmth('u1', 'g1', 'this is wonderful');
    // Familiarity is 0 (new user), so warmth line should be empty
    assert.strictEqual(getWarmthLine('u1', 'g1', 'casual'), '');
  });

  it('patience line returns empty for new content', () => {
    assert.strictEqual(getPatienceLine('u1', 'g1', 'hello'), '');
  });
});
