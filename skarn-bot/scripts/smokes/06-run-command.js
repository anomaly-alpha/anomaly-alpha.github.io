// ===== RUN_COMMAND =====
// Ported from README.md run_command smoke — fake message + facade, level via runTool.
(() => {
  require('../../features/activation/activationRegistry').scanCommands();
  const { runTool } = require('../../features/tools/toolRunner');
  const sent = [];
  const msg = {
    author: { id: 'u1', username: 'Tester' },
    guild: { id: 'g1', members: { cache: { get: function() { return { user: { username: 'Tester', displayAvatarURL: function() { return 'https://example.com/a.png'; } } }; } } } },
    member: { permissions: { has: function(p) { return false; } } },
    channel: { id: 'c1' },
    mentions: { users: { first: function() { return null; } }, channels: { first: function() { return { id: 'c9' }; } }, roles: { first: function() { return null; } } },
    reply: async function(payload) { sent.push(payload); return { react: async function() {} }; },
  };
  return runTool({ id: 'a', function: { name: 'run_command', arguments: JSON.stringify({ command: 'level' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: msg })
    .then(function(r) {
      const ok = r.content.includes('Level');
      console.log(ok ? 'run_command OK' : 'run_command FAILED: ' + r.content);
      if (!ok) process.exitCode = 1;
    });
})();