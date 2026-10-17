// ===== COMMAND CONSOLIDATION + HISTORY SEARCH PRIVACY =====
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { db, createThread, insertMessage, searchConversations } = require('../../db/database');

const commandsDir = path.join(__dirname, '..', '..', 'commands');
const commands = [
  require('../../commands/friends'),
  require('../../commands/standing'),
  require('../../commands/level'),
  require('../../commands/trivia'),
  require('../../commands/memory'),
  require('../../commands/weather'),
  require('../../commands/knowledge'),
  require('../../commands/history'),
  require('../../commands/consult'),
];
const serialized = commands.map(command => command.data.toJSON());
const byName = new Map(serialized.map(command => [command.name, command]));
for (const name of ['friends', 'standing', 'level', 'trivia', 'memory', 'weather', 'knowledge', 'history', 'consult']) {
  assert.ok(byName.has(name), 'command is registered: ' + name);
}

function names(options) { return options.map(option => option.name); }
assert.deepStrictEqual(names(byName.get('friends').options), ['list', 'search', 'add', 'remove']);
assert.deepStrictEqual(names(byName.get('level').options), ['profile', 'leaderboard', 'roles']);
assert.deepStrictEqual(names(byName.get('level').options[2].options), ['list', 'set', 'remove']);
assert.deepStrictEqual(names(byName.get('trivia').options), ['source', 'topic', 'difficulty']);
assert.deepStrictEqual(names(byName.get('memory').options), ['view', 'save']);
assert.deepStrictEqual(names(byName.get('weather').options), ['current', 'report', 'track']);
assert.deepStrictEqual(names(byName.get('weather').options[2].options), ['add', 'remove', 'list']);
assert.deepStrictEqual(names(byName.get('knowledge').options), ['lookup', 'search']);
assert.deepStrictEqual(names(byName.get('history').options), ['list', 'thread', 'search']);
assert.deepStrictEqual(names(byName.get('consult').options), ['chat', 'advice']);

for (const retired of ['addfriend', 'removefriend', 'friend', 'leaderboard', 'levelroles', 'setlevelrole', 'aitrivia', 'etch', 'weathertrack', 'vault', 'find', 'advice']) {
  assert.strictEqual(fs.existsSync(path.join(commandsDir, retired + '.js')), false, 'retired command wrapper removed: ' + retired);
}
assert.strictEqual(fs.existsSync(path.join(__dirname, '..', '..', 'features', 'etch', 'etch.command.js')), false, 'retired etch command definition removed');
for (const command of commands) assert.strictEqual(command.activation, undefined, 'grouped slash command has no retired text activation: ' + command.data.name);

const help = require('../../features/help/helpPages');
assert.deepStrictEqual(help.warnUnmappedCommands(new Map(commands.map(command => [command.data.name, command]))), [], 'grouped commands have help themes');

function fakeInteraction(subcommand, options = {}) {
  const replies = [];
  return {
    interaction: {
      user: { id: options.userId || 'test-user', username: options.username || 'Tester', displayAvatarURL: () => '' },
      guild: options.guildId ? { id: options.guildId, roles: { fetch: async () => null } } : null,
      guildId: options.guildId || null,
      member: { permissions: { has: permission => !!options.admin } },
      memberPermissions: { has: permission => !!options.admin },
      channel: { id: options.channelId || 'test-channel' },
      options: {
        getSubcommand: () => subcommand,
        getSubcommandGroup: () => options.group || null,
        getString: name => (options.strings || {})[name] ?? null,
        getInteger: name => (options.integers || {})[name] ?? null,
        getUser: name => (options.users || {})[name] ?? null,
        getRole: name => (options.roles || {})[name] ?? null,
        getChannel: name => (options.channels || {})[name] ?? null,
      },
      reply: async payload => { replies.push(payload); return payload; },
      deferReply: async () => {},
      editReply: async payload => { replies.push(payload); return payload; },
    },
    replies,
  };
}

async function runBehaviorChecks() {
  const friends = byName.get('friends');
  let ctx = fakeInteraction('add', { guildId: 'roster-server-a', strings: { code: '123456789', name: 'Roster Test', power: '20/30' } });
  await friends.execute(ctx.interaction);
  assert.ok(db.prepare('SELECT 1 FROM friends WHERE code = ?').get('123456789'), 'friend add writes to the existing global roster');
  ctx = fakeInteraction('list', { guildId: 'roster-server-b' });
  await friends.execute(ctx.interaction);
  assert.ok(ctx.replies[0].embeds[0].data.description.includes('Roster Test'), 'friend roster remains visible across servers');
  ctx = fakeInteraction('remove', { strings: { name: 'Roster Test' } });
  await friends.execute(ctx.interaction);
  assert.strictEqual(db.prepare('SELECT 1 FROM friends WHERE code = ?').get('123456789'), undefined, 'friend remove deletes from the same roster');

  const guildId = 'migration-test-guild';
  const level = byName.get('level');
  ctx = fakeInteraction('set', { guildId, group: 'roles', integers: { level: 5 }, roles: { role: { id: 'role-5', name: 'Level Five' } }, admin: false });
  await level.execute(ctx.interaction);
  assert.ok(ctx.replies[0].content.includes('Administrator'), 'level-role mutation denies non-admins');
  assert.strictEqual(db.prepare('SELECT 1 FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles'), undefined, 'denied level-role mutation does not write');
  ctx = fakeInteraction('set', { guildId, group: 'roles', integers: { level: 5 }, roles: { role: { id: 'role-5', name: 'Level Five' } }, admin: true });
  await level.execute(ctx.interaction);
  assert.ok(ctx.replies[0].embeds, 'administrator can set a level role');

  const weather = byName.get('weather');
  ctx = fakeInteraction('add', { guildId, group: 'track', strings: { location: 'Tokyo', time: '08:00' }, channels: { channel: { id: 'weather-channel' } }, admin: false });
  await weather.execute(ctx.interaction);
  assert.ok(ctx.replies[0].content.includes('Manage Channels'), 'weather tracking denies users without Manage Channels');
  assert.strictEqual(db.prepare('SELECT 1 FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'weatherTracks'), undefined, 'denied weather mutation does not write');
  ctx = fakeInteraction('add', { guildId, group: 'track', strings: { location: 'Tokyo', time: '08:00' }, channels: { channel: { id: 'weather-channel' } }, admin: true });
  await weather.execute(ctx.interaction);
  assert.ok(ctx.replies[0].content.includes('scheduled'), 'Manage Channels can schedule weather tracking');

  const memory = byName.get('memory');
  ctx = fakeInteraction('save', { strings: { fact: 'DM must not write memory' }, userId: 'memory-user' });
  await memory.execute(ctx.interaction);
  assert.ok(ctx.replies[0].content.includes('scoped to a server'), 'memory save handles DMs with a clear server-scope response');
  ctx = fakeInteraction('save', { guildId, strings: { fact: 'Retain this memory' }, userId: 'memory-user' });
  await memory.execute(ctx.interaction);
  assert.ok(db.prepare('SELECT 1 FROM memory_entries WHERE user_id = ? AND guild_id = ? AND content = ?').get('memory-user', guildId, 'Retain this memory'), 'memory save preserves per-user, per-guild storage');
  ctx = fakeInteraction('view', { guildId, userId: 'memory-user' });
  await memory.execute(ctx.interaction);
  assert.ok(ctx.replies[0].embeds[0].data.fields.some(field => field.value.includes('Retain this memory')), 'memory view shows saved facts');

  const history = byName.get('history');
  ctx = fakeInteraction('search', { guildId, strings: { query: 'private conversation' }, users: { user: { id: 'other-user', username: 'Other' } }, admin: false });
  await history.execute(ctx.interaction);
  assert.ok(ctx.replies[0].content.includes('administrators'), 'history search cannot target another user without admin permission');

  const channelId = 'history-search-channel';
  const userA = 'history-search-user-a';
  const userB = 'history-search-user-b';
  const term = 'historyscopecanary';
  const threadA = createThread(userA, guildId, channelId, 'channel');
  const threadB = createThread(userB, guildId, channelId, 'channel');
  insertMessage(threadA.thread_id, userA, guildId, channelId, 'user', 'private ' + term + ' user A');
  insertMessage(threadB.thread_id, userB, guildId, channelId, 'user', 'private ' + term + ' user B');
  const resultsA = searchConversations(term, guildId, userA, 10);
  const resultsB = searchConversations(term, guildId, userB, 10);
  assert.ok(resultsA.length > 0 && resultsA.every(row => row.user_id === userA), 'history search is scoped to user A');
  assert.ok(resultsB.length > 0 && resultsB.every(row => row.user_id === userB), 'history search is scoped to user B');
  assert.deepStrictEqual(searchConversations(term, guildId, null, 10), [], 'history search fails closed without a user ID');
}

runBehaviorChecks().then(() => {
  db.close();
  console.log('command consolidation smoke passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
