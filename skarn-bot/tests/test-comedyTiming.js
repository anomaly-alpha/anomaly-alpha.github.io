const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { recordSetup, isPunchline, cleanChains } = require('../features/humor/comedyTiming');

describe('comedyTiming', () => {
  it('detects punchline after a setup', () => {
    recordSetup('ch1', 'u1', 'guess what?');
    // isPunchline has 30s window, so this runs within it
    assert.ok(isPunchline('i won', 'ch1', 'u1'));
  });

  it('returns false when no setup exists', () => {
    assert.strictEqual(isPunchline('hello', 'ch2', 'u2'), false);
  });

  it('returns false for long text', () => {
    assert.strictEqual(isPunchline('x'.repeat(100), 'ch2', 'u2'), false);
  });

  it('returns false for question text', () => {
    assert.strictEqual(isPunchline('really?', 'ch2', 'u2'), false);
  });

  it('does not record non-setup content', () => {
    recordSetup('ch3', 'u3', 'hello there');
    assert.strictEqual(isPunchline('hi', 'ch3', 'u3'), false);
  });
});
