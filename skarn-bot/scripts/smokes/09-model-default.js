// ===== MODEL DEFAULT GUARD =====
// The code-level AI_MODEL fallback must stay gpt-6-luna. Verify env overrides
// and every model-router branch so an unset Railway variable uses the intended model.
const { selectModel } = require('../../features/intelligence/modelRouter');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

// Force env-unset so the code-level fallback is what's exercised.
delete process.env.AI_MODEL;
delete process.env.AI_MODEL_COMPLEX;

assert('default branch is gpt-6-luna', selectModel('hi', false, 0.2) === 'gpt-6-luna');
assert('knowledge-match branch is gpt-6-luna', selectModel('x', true, 0.2) === 'gpt-6-luna');
assert('long-question branch is gpt-6-luna', selectModel('this is a very long question that definitely exceeds one hundred characters in length and needs a detailed explain please', false, 0.2) === 'gpt-6-luna');
assert('complexity branch is gpt-6-luna', selectModel('hi', false, 0.9) === 'gpt-6-luna');

process.env.AI_MODEL = 'gpt-6-luna';
assert('AI_MODEL override is honored', selectModel('hi', false, 0.2) === 'gpt-6-luna');
process.env.AI_MODEL_COMPLEX = 'gpt-6-luna';
assert('AI_MODEL_COMPLEX override is honored', selectModel('x', true, 0.2) === 'gpt-6-luna');
