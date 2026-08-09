// ===== ROLE REGISTRY ALIGNMENT =====
// Guards the 3-way role registries (roles/roleTokenBudgets/ROLE_NATURE) staying
// key-aligned (CONTEXT.md §11.3). Also exercised at boot via bot.js.
const { roles, roleTokenBudgets, ROLE_NATURE, assertRoleRegistryAligned } = require('../../persona/roles');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

assert('assertRoleRegistryAligned passes', assertRoleRegistryAligned() === true);
assert('roles/tokenBudgets keysets match', Object.keys(roles).sort().join(',') === Object.keys(roleTokenBudgets).sort().join(','));
assert('roles/ROLE_NATURE keysets match', Object.keys(roles).sort().join(',') === Object.keys(ROLE_NATURE).sort().join(','));
