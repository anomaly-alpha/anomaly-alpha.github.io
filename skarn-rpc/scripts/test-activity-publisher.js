const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Module = require('module');
const originalModuleLoad = Module._load;
Module._load = (request, parent, isMain) => request === 'register-scheme'
  ? (() => false)
  : originalModuleLoad(request, parent, isMain);
const DiscordRpc = require('../node_modules/discord-rpc');
Module._load = originalModuleLoad;
const {
  createActivityPublisher,
  hashActivity,
} = require('../features/presence/activityPublisher');
const {
  createActivityLogger,
  MAX_LOG_TOTAL_BYTES,
} = require('../features/presence/activityLogger');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeRpcClient {
  constructor(handler) {
    this.handler = handler || (() => Promise.resolve());
    this.calls = [];
    this.clearCalls = 0;
    this.destroyed = false;
    this.active = 0;
    this.maxActive = 0;
  }

  setActivity(payload) {
    if (this.destroyed) throw new Error('destroyed client used');
    const index = this.calls.length;
    this.calls.push(payload);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    let result;
    try { result = this.handler('setActivity', payload, index); } catch (error) { result = Promise.reject(error); }
    return Promise.resolve(result).then(value => {
      this.active -= 1;
      return value;
    }, error => {
      this.active -= 1;
      throw error;
    });
  }

  clearActivity() {
    if (this.destroyed) throw new Error('destroyed client used');
    this.clearCalls += 1;
    let result;
    try { result = this.handler('clearActivity', null, this.clearCalls - 1); } catch (error) { result = Promise.reject(error); }
    return Promise.resolve(result);
  }

  destroy() {
    this.destroyed = true;
    return Promise.resolve();
  }
}

function activity(name, extra) {
  return {
    details: 'Details ' + name,
    state: 'State ' + name,
    largeImageKey: 'skarn_logo',
    largeImageText: 'Skarn Bot',
    smallImageKey: 'skarn_eye',
    smallImageText: 'Eye',
    instance: false,
    type: 0,
    startTimestamp: new Date('2026-09-19T12:00:00.000Z'),
    ...(extra || {}),
  };
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 500);
  while (!check()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for fake RPC call');
    await new Promise(resolve => setImmediate(resolve));
  }
}

async function testLatestWinsAndSuppression() {
  const first = deferred();
  const client = new FakeRpcClient((method, payload, index) => index === 0 ? first.promise : undefined);
  const publisher = createActivityPublisher({ timeoutMs: 1000 });
  await publisher.setClient(client);

  const firstPublish = publisher.publish(activity('first'));
  await waitFor(() => client.calls.length === 1);
  const replacedPublish = publisher.publish(activity('replaced'));
  const latestActivity = activity('latest');
  const latestPublish = publisher.publish(latestActivity);
  assert.strictEqual(publisher.getStatus().pending, true);
  first.resolve();

  assert.strictEqual(await firstPublish, true);
  assert.strictEqual(await replacedPublish, false);
  assert.strictEqual(await latestPublish, true);
  assert.strictEqual(client.calls.length, 2);
  assert.strictEqual(client.calls[1].details, latestActivity.details);
  assert.strictEqual(client.maxActive, 1);

  const duplicate = await publisher.publish({ ...latestActivity, state: latestActivity.state });
  assert.strictEqual(duplicate, false);
  assert.strictEqual(client.calls.length, 2);
  assert.strictEqual(publisher.getStatus().lastPublishedHash, hashActivity(client.calls[1]));

  assert.strictEqual(await publisher.clear(), true);
  assert.strictEqual(client.clearCalls, 1);
  assert.strictEqual(publisher.getStatus().lastPublishedHash, null);

  const unsafeCandidate = activity('sanitized', {
    buttons: [{ label: 'unsafe', url: 'https://example.invalid' }],
    party: { id: 'unsafe' },
    secrets: { join: 'unsafe' },
    url: 'https://example.invalid',
  });
  assert.strictEqual(await publisher.publish(unsafeCandidate), true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(client.calls[2], 'buttons'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(client.calls[2], 'party'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(client.calls[2], 'secrets'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(client.calls[2], 'url'), false);
}

async function testTimeoutAndRejectionRecovery() {
  const rejected = new Error('simulated rejection');
  rejected.code = 'SIMULATED_REJECTION';
  const client = new FakeRpcClient((method, payload, index) => {
    if (index === 0) return new Promise(() => {});
    if (index === 1) return Promise.reject(rejected);
    return undefined;
  });
  const publisher = createActivityPublisher({ timeoutMs: 20 });
  await publisher.setClient(client);

  assert.strictEqual(await publisher.publish(activity('timeout')), false);
  assert.strictEqual(publisher.getStatus().lastError.code, 'RPC_ACTIVITY_TIMEOUT');
  assert.strictEqual(await publisher.publish(activity('reject')), false);
  assert.strictEqual(publisher.getStatus().lastError.code, 'SIMULATED_REJECTION');
  assert.strictEqual(await publisher.publish(activity('recovered')), true);
  assert.strictEqual(publisher.getStatus().lastError, null);
}

async function testDetachedLateResponseAndDestroy() {
  const late = deferred();
  const oldClient = new FakeRpcClient(() => late.promise);
  const newClient = new FakeRpcClient();
  const publisher = createActivityPublisher({ timeoutMs: 1000 });
  await publisher.setClient(oldClient);
  const oldPublish = publisher.publish(activity('old'));
  await waitFor(() => oldClient.calls.length === 1);

  await publisher.disconnectClient();
  assert.strictEqual(oldClient.destroyed, true);
  assert.strictEqual(publisher.getStatus().connected, false);
  assert.strictEqual(await publisher.publish(activity('while-disconnected')), false);
  assert.strictEqual(oldClient.calls.length, 1);

  await publisher.setClient(newClient);
  assert.strictEqual(await publisher.publish(activity('new')), true);
  const newHash = publisher.getStatus().lastPublishedHash;
  late.resolve();
  assert.strictEqual(await oldPublish, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(publisher.getStatus().lastPublishedHash, newHash);
  assert.strictEqual(newClient.calls.length, 1);
}

function testTimestampConversion() {
  let requestPayload;
  const wrapper = Object.create(DiscordRpc.Client.prototype);
  wrapper.request = (command, payload) => {
    requestPayload = payload;
    return Promise.resolve();
  };
  const timestamp = new Date('2026-09-19T12:34:56.789Z');
  wrapper.setActivity({ details: 'timestamp', startTimestamp: timestamp });
  assert.strictEqual(requestPayload.activity.timestamps.start, timestamp.getTime());
  wrapper.setActivity({ details: 'timestamp', startTimestamp: timestamp.getTime() });
  assert.strictEqual(requestPayload.activity.timestamps.start, timestamp.getTime());
}

function testRedactedBoundedLogs() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-rpc-log-'));
  const logFile = path.join(directory, 'rpc.log');
  const logger = createActivityLogger({
    logFile,
    maxTotalBytes: 1024,
    maxFileBytes: 512,
    writeConsole: false,
  });
  logger.log('publisher / rejection', {
    token: 'do-not-write-token',
    articleBody: 'do-not-write-article-body',
    code: 'RPC_ACTIVITY_TIMEOUT',
  });
  for (let index = 0; index < 30; index += 1) logger.log('bounded_event', { index, note: 'x'.repeat(180) });

  const activeSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  const backupFile = logFile + '.1';
  const backupSize = fs.existsSync(backupFile) ? fs.statSync(backupFile).size : 0;
  assert.ok(activeSize <= 512);
  assert.ok(backupSize <= 512);
  assert.ok(activeSize + backupSize <= logger.maxTotalBytes);
  assert.ok(activeSize + backupSize <= MAX_LOG_TOTAL_BYTES);
  const stored = (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '') + (fs.existsSync(backupFile) ? fs.readFileSync(backupFile, 'utf8') : '');
  assert.ok(stored.includes('"event":"bounded_event"') || stored.includes('log_line_truncated'));
  assert.ok(!stored.includes('do-not-write-token'));
  assert.ok(!stored.includes('do-not-write-article-body'));
  assert.strictEqual(fs.statSync(logFile).mode & 0o777, 0o600);
  fs.rmSync(directory, { recursive: true, force: true });
}

async function main() {
  await testLatestWinsAndSuppression();
  await testTimeoutAndRejectionRecovery();
  await testDetachedLateResponseAndDestroy();
  testTimestampConversion();
  testRedactedBoundedLogs();
  console.log('activity publisher tests passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
