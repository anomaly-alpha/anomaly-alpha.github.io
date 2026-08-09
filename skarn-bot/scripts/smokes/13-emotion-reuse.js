// ===== EMOTION REUSE (analyzer-sourced) =====
// Guards Strategic #10: analyzed messages write emotion from the analyzer
// result (no separate tone LLM call). Proves the mapped state lands in
// user_emotional_context and the tone_subtext memory entry is written.
const { getUserEmotion } = require('../../db/database');
const { mapAnalyzerEmotion, applyAnalyzedEmotion } = require('../../features/wisdom/emotionalIntelligence');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

assert('mapping: neutral passes through', mapAnalyzerEmotion('neutral') === 'neutral');
assert('mapping: frustrated→stressed', mapAnalyzerEmotion('frustrated') === 'stressed');

(async function() {
  await applyAnalyzedEmotion('u1', 'g1', 'this is a longer message that exceeds fifty characters for the smoke test here', {
    emotion: 'frustrated', intensity: 0.7, subtext: 'test subtext for the smoke', pacing: 'urgent',
  });
  const emo = getUserEmotion('u1', 'g1');
  assert('emotion written (mapped frustrated→stressed)', emo && emo.emotional_state === 'stressed');

  const { getMemoryEntries } = require('../../db/database');
  const mems = getMemoryEntries('u1', 'g1', 5);
  assert('tone_subtext memory written', mems.some(function(m) {
    return m.type === 'preference' && m.content.indexOf('tone_subtext: test subtext for the smoke') === 0;
  }));
})().catch(function(e) { console.error('smoke error:', e.message); process.exitCode = 1; });
