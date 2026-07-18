const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('search integration', () => {
  it('buildSystemPrompt accepts additionalContext', () => {
    const { buildSystemPrompt } = require('../persona/identity');
    const result = buildSystemPrompt({ additionalContext: 'test context' });
    assert.ok(result.includes('test context'));
  });

  it('roles has search entry', () => {
    const { roles, roleTokenBudgets } = require('../persona/roles');
    assert.ok(roles.search);
    assert.ok(roleTokenBudgets.search > 0);
  });

  it('ROLE_NATURE in postProcess has search entry', () => {
    const { ROLE_NATURE } = require('../features/discordNative/postProcess');
    assert.ok(ROLE_NATURE.search);
  });

  it('search command has correct name and options', () => {
    const command = require('../features/search/search.command');
    const json = command.data.toJSON();
    assert.strictEqual(json.name, 'search');
    assert.strictEqual(json.options.length, 1);
    assert.strictEqual(json.options[0].name, 'query');
    assert.ok(json.options[0].required);
    assert.strictEqual(json.options[0].min_length, 3);
    assert.strictEqual(json.options[0].max_length, 200);
  });
});
