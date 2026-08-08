// ===== MODEL DEFAULT GUARD =====
// The code-level AI_MODEL fallback must stay gpt-5.4-mini (spec 6.2). If the env
// var is ever dropped, selectModel must not silently downgrade to gpt-3.5-turbo.
const { selectModel } = require('../../features/intelligence/modelRouter');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

// Force env-unset so the code-level fallback is what's exercised.
delete process.env.AI_MODEL;
delete process.env.AI_MODEL_COMPLEX;

assert('default branch is gpt-5.4-mini', selectModel('hi', false, 0.2) === 'gpt-5.4-mini');
assert('knowledge-match branch is gpt-5.4-mini', selectModel('x', true, 0.2) === 'gpt-5.4-mini');
assert('long-question branch is gpt-5.4-mini', selectModel('this is a very long question that definitely exceeds one hundred characters in length and needs a detailed explain please', false, 0.2) === 'gpt-5.4-mini');
assert('complexity branch is gpt-5.4-mini', selectModel('hi', false, 0.9) === 'gpt-5.4-mini');
