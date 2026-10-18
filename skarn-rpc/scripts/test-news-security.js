const assert = require('assert/strict');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../data/news-sources.json');
const { DEFAULT_ALLOWED_HOSTS, createSafeLookup, isUnsafeAddress, requestFeed } = require('../features/news/feedClient');
const { validateNewsConfig } = require('../features/news/newsPoller');
const { auditSources, errorCode } = require('./news-feed-health');
const { clearCache } = require('./clean-news-cache');

assert.equal(isUnsafeAddress('127.0.0.1'), true);
assert.equal(isUnsafeAddress('10.0.0.1'), true);
assert.equal(isUnsafeAddress('169.254.169.254'), true);
assert.equal(isUnsafeAddress('192.168.1.10'), true);
assert.equal(isUnsafeAddress('::1'), true);
assert.equal(isUnsafeAddress('fc00::1'), true);
assert.equal(isUnsafeAddress('fe80::1'), true);
assert.equal(isUnsafeAddress('8.8.8.8'), false);
assert.equal(isUnsafeAddress('2001:4860:4860::8888'), false);

async function run() {
await assert.rejects(() => requestFeed('https://user:pass@www.nasa.gov/feed', { allowlist: ['www.nasa.gov'], httpsModule: stub([]) }), error => error.code === 'FEED_URL_CREDENTIALS');
await new Promise((resolve, reject) => {
  createSafeLookup((hostname, options, callback) => callback(null, [{ address: '169.254.169.254', family: 4 }]))('feed.example', {}, error => {
    try { assert.equal(error.code, 'FEED_DNS_DESTINATION_UNSAFE'); resolve(); } catch (failure) { reject(failure); }
  });
});
const dnsRejectingStub = {
  request(options) {
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = error => { if (error) process.nextTick(() => request.emit('error', error)); };
    request.end = () => options.lookup('www.nasa.gov', {}, error => { if (error) process.nextTick(() => request.emit('error', error)); });
    return request;
  },
};
await assert.rejects(() => requestFeed('https://www.nasa.gov/dns', { allowlist: ['www.nasa.gov'], lookup: (hostname, options, callback) => callback(null, [{ address: '169.254.169.254', family: 4 }]), httpsModule: dnsRejectingStub }), error => error.code === 'FEED_DNS_DESTINATION_UNSAFE');

function stub(routes) {
  let index = 0;
  return {
    request(options, callback) {
      const route = routes[index++];
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.destroy = error => { if (error) process.nextTick(() => request.emit('error', error)); };
      request.end = () => process.nextTick(() => {
        const response = new EventEmitter();
        response.statusCode = route.statusCode;
        response.headers = route.headers || {};
        response.resume = () => {};
        callback(response);
        if (route.body) { response.emit('data', Buffer.from(route.body)); response.emit('end'); }
      });
      return request;
    },
  };
}

const sameHost = await requestFeed('https://www.nasa.gov/start', {
  allowlist: ['www.nasa.gov'],
  httpsModule: stub([
    { statusCode: 301, headers: { location: '/canonical' } },
    { statusCode: 200, headers: { 'content-type': 'application/rss+xml' }, body: '<rss/>' },
  ]),
});
assert.equal(sameHost.url, 'https://www.nasa.gov/canonical');
assert.equal(sameHost.redirectCount, 1);
await assert.rejects(() => requestFeed('https://www.nasa.gov/start', { allowlist: ['www.nasa.gov', 'openai.com'], httpsModule: stub([{ statusCode: 302, headers: { location: 'https://openai.com/feed' } }]) }), error => error.code === 'FEED_REDIRECT_CROSS_HOST');

const disabled = config.sources.filter(source => source.enabled === false);
assert.equal(validateNewsConfig(config).ok, true);
assert.equal(config.sources.length, 167);
assert.equal(disabled.length, 11);
assert.equal(config.sources.filter(source => source.enabled).length, 156);
const newSources = config.sources.slice(-10);
assert.equal(newSources.every(source => source.enabled && source.trustClass === 'publisher' && source.maxResponseBytes === 1048576), true);
for (const host of ['www.aljazeera.com', 'www.pcgamer.com', 'www.pcgamesn.com', 'www.theguardian.com']) {
  assert.equal(DEFAULT_ALLOWED_HOSTS.includes(host), true);
}
assert.equal(newSources.every(source => DEFAULT_ALLOWED_HOSTS.includes(source.domain)), true);
assert.equal(config.sources.find(source => source.id === 'crowdstrike-blog').feedUrl, 'https://www.crowdstrike.com/en-us/blog/feed');
assert.equal(config.sources.find(source => source.id === 'slack-engineering').feedUrl, 'https://slack.engineering/feed/');

const health = await auditSources({ sources: [config.sources.find(source => source.id === 'cisa-advisories')] }, {
  requestFeed: async () => { throw Object.assign(new Error('forbidden'), { code: 'FEED_HTTP_ERROR', statusCode: 403 }); },
});
assert.equal(health[0].finding, 'HTTP_403_WAF');
assert.equal(errorCode(Object.assign(new Error('timeout'), { code: 'FEED_TIMEOUT' })), 'TIMEOUT');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-news-clear-test-'));
fs.chmodSync(temporaryDirectory, 0o700);
const temporaryCache = path.join(temporaryDirectory, 'news-state.json');
const timestamp = new Date().toISOString();
const cachedItem = {
  id: 'clear-test-item',
  title: 'A current test headline',
  canonicalUrl: 'https://www.nasa.gov/news-release/test-headline',
  sourceId: 'nasa-breaking-news',
  sourceName: 'NASA Breaking News',
  publishedAt: timestamp,
  updatedAt: timestamp,
  fetchedAt: timestamp,
  topic: 'science',
  confidence: 1,
  basePriority: 1,
  salience: 'normal',
  iconRole: 'world',
  safetyDecision: 'accepted',
};
const cachedState = {
  schemaVersion: 1,
  updatedAt: Date.now(),
  items: [cachedItem],
  sources: { 'nasa-breaking-news': { etag: 'test-validator' } },
  lastPollAt: Date.now(),
  lastSuccessAt: Date.now(),
  lastError: null,
};
fs.writeFileSync(temporaryCache, JSON.stringify(cachedState), { mode: 0o600 });
let mockServiceActive = true;
const mockSystemctl = (command, args) => {
  assert.equal(command, 'systemctl');
  if (args[1] === 'is-active') return mockServiceActive ? 'active' : 'inactive';
  if (args[1] === 'stop') { mockServiceActive = false; return ''; }
  if (args[1] === 'start') { mockServiceActive = true; return ''; }
  throw new Error('unexpected systemctl operation');
};
const cleared = clearCache(temporaryCache, cachedState, { systemctl: mockSystemctl });
const clearedState = JSON.parse(fs.readFileSync(temporaryCache, 'utf8'));
const backupState = JSON.parse(fs.readFileSync(cleared.backupPath, 'utf8'));
assert.equal(cleared.previousArticleCount, 1);
assert.equal(cleared.previousSourceCount, 1);
assert.deepEqual(clearedState.items, []);
assert.deepEqual(clearedState.sources, {});
assert.equal(clearedState.lastSuccessAt, null);
assert.equal(backupState.items.length, 1);
assert.equal(mockServiceActive, true);
assert.equal(cleared.restarted, true);
fs.rmSync(temporaryDirectory, { recursive: true, force: true });

console.log('news security tests passed: immutable host boundary, DNS destination guard, redirect policy, quarantine, health dispositions, and recoverable cache clear');
}

run().catch(error => {
  console.error('news security tests failed:', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
