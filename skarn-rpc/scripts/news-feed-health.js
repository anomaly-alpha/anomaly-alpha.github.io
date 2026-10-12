const fs = require('fs');
const path = require('path');
const { loadNewsConfig, validateNewsConfig } = require('../features/news/newsPoller');
const { requestFeed } = require('../features/news/feedClient');

const CONFIG_PATH = require('path').join(__dirname, '..', 'data', 'news-sources.json');
const HEALTH_PATH = path.join(__dirname, '..', 'data', 'news-health.json');
const CONCURRENCY = 8;

async function runWithConcurrency(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }));
}

function errorCode(error) {
  if (error && error.code === 'FEED_HTTP_ERROR' && error.statusCode === 403) return 'HTTP_403_WAF';
  if (error && error.code === 'FEED_TIMEOUT') return 'TIMEOUT';
  if (error && error.code === 'FEED_CONTENT_TYPE_INVALID') return 'INVALID_CONTENT_TYPE';
  if (error && error.code === 'FEED_REDIRECT_CROSS_HOST') return 'UNSAFE_REDIRECT';
  if (error && error.code === 'FEED_DNS_DESTINATION_UNSAFE') return 'UNSAFE_DNS_DESTINATION';
  return error && error.code ? String(error.code).slice(0, 80) : 'HEALTH_CHECK_FAILED';
}

async function auditSources(config, options) {
  const request = options && options.requestFeed ? options.requestFeed : requestFeed;
  const results = [];
  await runWithConcurrency(config.sources, CONCURRENCY, async source => {
    const result = {
      id: source.id,
      enabled: source.enabled,
      disposition: source.enabled ? 'enabled' : 'quarantined',
      configuredUrl: source.feedUrl,
      finalUrl: null,
      redirectCount: 0,
      tlsVerified: null,
      contentType: null,
      statusCode: null,
      finding: null,
    };
    try {
      const response = await request(source.feedUrl, {
        allowlist: [source.domain],
        maxResponseBytes: source.maxResponseBytes,
        timeoutMs: 5000,
      });
      result.finalUrl = response.url || source.feedUrl;
      result.redirectCount = response.redirectCount || 0;
      result.tlsVerified = response.tlsVerified === true;
      result.contentType = response.contentType || null;
      result.statusCode = response.statusCode || null;
      result.finding = result.redirectCount > 0 ? 'SAME_HOST_REDIRECT' : 'GOOD';
    } catch (error) {
      result.statusCode = Number.isInteger(error.statusCode) ? error.statusCode : null;
      result.finding = errorCode(error);
    }
    results.push(result);
  });
  return results.sort((left, right) => left.id.localeCompare(right.id));
}

function formatReport(results) {
  const counts = results.reduce((output, result) => { output[result.finding] = (output[result.finding] || 0) + 1; return output; }, {});
  const dispositions = new Map();
  for (const result of results) {
    if (result.finding === 'GOOD' && result.finding !== 'SAME_HOST_REDIRECT' && result.disposition !== 'quarantined') continue;
    const suffix = result.disposition === 'quarantined' ? ' (quarantined)' : '';
    dispositions.set(result.id, result.id + '=' + result.finding + suffix);
  }
  const lines = [
    'Skarn news feed health report',
    'Sources checked: ' + results.length,
    'Findings: ' + Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => name + '=' + count).join(', '),
    'Quarantined/unverified: ' + (dispositions.size ? Array.from(dispositions.values()).sort().join(', ') : 'none'),
    'No response bodies or credentials are retained. This is an endpoint snapshot, not a full publisher security audit.',
  ];
  return lines.join('\n');
}

function writeHealthEvidence(results, filePath) {
  const target = filePath || HEALTH_PATH;
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const evidence = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    sources: results.map(result => ({
      id: result.id,
      enabled: result.enabled,
      disposition: result.disposition,
      configuredUrl: result.configuredUrl,
      finalUrl: result.finalUrl,
      redirectCount: result.redirectCount,
      tlsVerified: result.tlsVerified,
      contentType: result.contentType,
      statusCode: result.statusCode,
      finding: result.finding,
    })),
  };
  const temporary = target + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, JSON.stringify(evidence, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, target);
  fs.chmodSync(target, 0o600);
  return target;
}

async function main(argv) {
  if (argv.includes('--help')) {
    console.log('Usage: node scripts/news-feed-health.js --report');
    return;
  }
  if (argv.length !== 1 || argv[0] !== '--report') throw new Error('accepted argument: --report');
  const config = loadNewsConfig(CONFIG_PATH);
  const validation = validateNewsConfig(config);
  if (!validation.ok) throw new Error('news config is invalid: ' + validation.errors.join('; '));
  const results = await auditSources(config);
  const evidencePath = writeHealthEvidence(results);
  console.log(formatReport(results));
  console.log('Bounded health evidence: ' + evidencePath);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error('News feed health failed: ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { HEALTH_PATH, auditSources, errorCode, formatReport, main, writeHealthEvidence };
