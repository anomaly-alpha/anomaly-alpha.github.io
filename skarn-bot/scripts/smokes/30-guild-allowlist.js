const assert = require('assert');
const { parseApprovedList, isApproved, registerGuildAllowlist, ENV_KEY } = require('../../features/safety/guildAllowlist');

function fakeClient(guilds) {
  const handlers = {};
  return {
    handlers,
    guilds: { cache: new Map(guilds.map((g) => [g.id, g])) },
    on(event, handler) { handlers[event] = handler; },
  };
}

function fakeGuild(id, name, leaveSpy) {
  return {
    id,
    name,
    memberCount: 6,
    async leave() { if (leaveSpy) leaveSpy.push(id); },
  };
}

function recorder() {
  const entries = [];
  const record = (e) => entries.push(e);
  record.entries = entries;
  record.events = () => entries.map((e) => `${e.guildId}:${e.event}:${e.reason}`);
  return record;
}

function silent() {
  const lines = [];
  const log = (m) => lines.push(m);
  log.lines = lines;
  return log;
}

async function main() {
  const GOOD = '1460698506489630844';
  const OTHER = '983753918028845066';
  const ROGUE = '1553213088143118358';

  assert.deepStrictEqual(parseApprovedList(''), []);
  assert.deepStrictEqual(parseApprovedList(undefined), []);
  assert.deepStrictEqual(parseApprovedList(null), []);
  assert.deepStrictEqual(parseApprovedList(' '), []);
  assert.deepStrictEqual(parseApprovedList('abc, 123'), [], 'non-snowflake tokens are dropped');
  assert.deepStrictEqual(parseApprovedList(` ${GOOD} , ${OTHER} `), [GOOD, OTHER], 'trims whitespace');
  assert.deepStrictEqual(parseApprovedList(`${GOOD},,${OTHER}`), [GOOD, OTHER], 'drops empty segments');
  assert.strictEqual(isApproved([GOOD], GOOD), true);
  assert.strictEqual(isApproved([GOOD], OTHER), false);
  assert.strictEqual(isApproved([], GOOD), false);
  assert.strictEqual(ENV_KEY, 'SKARN_APPROVED_GUILDS');

  // Disabled: never leaves, but still logs every join and leave.
  {
    const left = [];
    const record = recorder();
    const client = fakeClient([]);
    const result = registerGuildAllowlist(client, { rawList: undefined, log: silent(), record });
    assert.strictEqual(result.enabled, false);
    assert.deepStrictEqual(result.approved, []);
    assert.strictEqual(typeof client.handlers.guildCreate, 'function', 'still listens to record joins');
    assert.strictEqual(typeof client.handlers.guildDelete, 'function', 'still listens to record leaves');

    await client.handlers.guildCreate(fakeGuild(ROGUE, 'Rogue', left));
    assert.deepStrictEqual(left, [], 'nothing left while disabled');
    assert.deepStrictEqual(record.events(), [`${ROGUE}:joined:allowlist_disabled`]);

    const sweep = await result.enforce();
    assert.deepStrictEqual(sweep, { left: 0, kept: 0 });
    assert.deepStrictEqual(left, []);
  }

  // Enabled: approved joins kept, unapproved joins left and both sides logged.
  {
    const left = [];
    const record = recorder();
    const client = fakeClient([]);
    const result = registerGuildAllowlist(client, { rawList: `${GOOD},${OTHER}`, log: silent(), record });
    assert.strictEqual(result.enabled, true);
    assert.deepStrictEqual(result.approved, [GOOD, OTHER]);

    await client.handlers.guildCreate(fakeGuild(GOOD, 'A', left));
    assert.deepStrictEqual(left, [], 'approved guild is kept');
    assert.deepStrictEqual(record.events(), [`${GOOD}:joined:allowlisted`]);

    const rogue = fakeGuild(ROGUE, 'Rogue', left);
    await client.handlers.guildCreate(rogue);
    assert.deepStrictEqual(left, [ROGUE], 'unapproved guild is left');
    assert.deepStrictEqual(record.events(), [
      `${GOOD}:joined:allowlisted`,
      `${ROGUE}:joined:unapproved`,
      `${ROGUE}:left:unapproved`,
    ]);

    await client.handlers.guildCreate(undefined);
    await client.handlers.guildCreate({});
    assert.strictEqual(record.entries.length, 3, 'malformed guild objects are ignored');
  }

  // guildDelete: recorded as external unless we caused it; outages skipped.
  {
    const left = [];
    const record = recorder();
    const client = fakeClient([]);
    registerGuildAllowlist(client, { rawList: GOOD, log: silent(), record });

    client.handlers.guildDelete({ id: ROGUE, name: 'Kicked', unavailable: false });
    assert.deepStrictEqual(record.events(), [`${ROGUE}:left:external`], 'admin removal logged as external');

    client.handlers.guildDelete({ id: ROGUE, name: 'Outage', unavailable: true });
    assert.strictEqual(record.entries.length, 1, 'outage is not a leave');

    const selfLeft = fakeGuild(OTHER, 'Self', left);
    await client.handlers.guildCreate(selfLeft);
    const before = record.entries.length;
    client.handlers.guildDelete({ id: OTHER, name: 'Self', unavailable: false });
    assert.strictEqual(record.entries.length, before, 'our own leave is not double-logged');
  }

  // Startup sweep removes cached guilds that predate the allowlist.
  {
    const left = [];
    const record = recorder();
    const client = fakeClient([
      fakeGuild(GOOD, 'A', left),
      fakeGuild(ROGUE, 'Rogue', left),
      fakeGuild('732943799772512417', 'Rogue2', left),
    ]);
    const result = registerGuildAllowlist(client, { rawList: GOOD, log: silent(), record });
    const sweep = await result.enforce();
    assert.deepStrictEqual(sweep, { left: 2, kept: 1 });
    assert.deepStrictEqual(left, [ROGUE, '732943799772512417']);
    assert.deepStrictEqual(record.events(), [
      `${ROGUE}:left:unapproved`,
      '732943799772512417:left:unapproved',
    ]);
  }

  // A failing leave is logged as leave_failed and does not throw.
  {
    const record = recorder();
    const log = silent();
    const client = fakeClient([]);
    const result = registerGuildAllowlist(client, { rawList: GOOD, log, record });
    const broken = { id: ROGUE, name: 'Broken', memberCount: 3, async leave() { throw new Error('missing access'); } };
    await client.handlers.guildCreate(broken);
    client.guilds.cache.set(ROGUE, broken);
    const sweep = await result.enforce();
    assert.deepStrictEqual(sweep, { left: 0, kept: 0 }, 'failed leave is not counted');
    assert.ok(log.lines.some((l) => l.includes('missing access')), 'logs the failure');
    assert.ok(record.events().includes(`${ROGUE}:left:leave_failed`), 'records the failed leave');
  }

  // A throwing recorder must never break enforcement.
  {
    const left = [];
    const client = fakeClient([]);
    const boom = () => { throw new Error('db down'); };
    const log = silent();
    registerGuildAllowlist(client, { rawList: GOOD, log, record: boom });
    await client.handlers.guildCreate(fakeGuild(ROGUE, 'Rogue', left));
    assert.deepStrictEqual(left, [ROGUE], 'still leaves even when logging fails');
    assert.ok(log.lines.some((l) => l.includes('log write failed')));
  }

  console.log('Guild allowlist smoke passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
