const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { getGratitudeDirective, getMilestoneLine, flagForApology, getApologyLine, clearFlags } = require('../features/etiquette/etiquetteEngine');

describe('etiquetteEngine', () => {
  it('detects gratitude in text', () => {
    assert.ok(getGratitudeDirective('thanks a lot'));
    assert.ok(getGratitudeDirective('ty'));
    assert.ok(getGratitudeDirective('tysm'));
    assert.ok(getGratitudeDirective('appreciate it'));
  });

  it('returns empty for non-gratitude text', () => {
    assert.strictEqual(getGratitudeDirective('hello'), '');
  });

  it('flags milestone at correct counts', () => {
    assert.ok(getMilestoneLine('u1', 50));
    // Same milestone should not fire twice
    assert.strictEqual(getMilestoneLine('u1', 50), '');
    // Next milestone
    assert.ok(getMilestoneLine('u1', 100));
  });

  it('returns apology line after flag', () => {
    flagForApology('u5');
    assert.ok(getApologyLine('u5'));
    // Consumed — second call returns empty
    assert.strictEqual(getApologyLine('u5'), '');
  });

  it('clears flags without throwing', () => {
    flagForApology('u6');
    clearFlags();
  });
});
