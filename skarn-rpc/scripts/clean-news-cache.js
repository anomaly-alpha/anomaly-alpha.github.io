const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const { evaluateTitle, qualifiesAsNearDuplicate } = require('../features/news/newsQuality');
const { loadNewsConfig, validateNewsConfig } = require('../features/news/newsPoller');
const { MAX_ITEMS, validateNewsState } = require('../features/news/newsState');

const ROOT = path.join(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'news-state.json');
const CONFIG_PATH = path.join(ROOT, 'data', 'news-sources.json');
const SERVICE_NAME = 'skarn-rpc.service';

function diagnostic(error) {
  return String(error && error.message ? error.message : error).replace(/\s+/g, ' ').slice(0, 240);
}

function readState(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('cache could not be read: ' + diagnostic(error));
  }
  const validation = validateNewsState(parsed);
  if (!validation.ok) throw new Error('cache is invalid: ' + validation.errors.join('; '));
  return parsed;
}

function loadConfig(filePath) {
  const config = loadNewsConfig(filePath);
  const validation = validateNewsConfig(config);
  if (!validation.ok) throw new Error('news config is invalid: ' + validation.errors.join('; '));
  return config;
}

function timestampOf(item) {
  const timestamp = Date.parse(item.updatedAt || item.publishedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sourceRank(item, sources) {
  const source = sources.get(item.sourceId);
  return source && source.trustClass === 'official' ? 2 : 1;
}

function prefer(left, right, sources) {
  return timestampOf(left) > timestampOf(right)
    || (timestampOf(left) === timestampOf(right) && sourceRank(left, sources) > sourceRank(right, sources))
    || (timestampOf(left) === timestampOf(right) && sourceRank(left, sources) === sourceRank(right) && (left.basePriority || 0) > (right.basePriority || 0))
    || (timestampOf(left) === timestampOf(right) && sourceRank(left, sources) === sourceRank(right) && (left.basePriority || 0) === (right.basePriority || 0) && String(left.id).localeCompare(String(right.id)) < 0)
    ? left
    : right;
}

function projectActive(items, maxItemsPerSource) {
  const groups = new Map();
  for (const item of items) {
    const key = item.sourceId || item.sourceName || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const projected = [];
  for (const group of groups.values()) {
    group.sort((left, right) => timestampOf(right) - timestampOf(left) || String(left.id).localeCompare(String(right.id)));
    projected.push(...group.slice(0, maxItemsPerSource));
  }
  const sourceCounts = {};
  for (const item of projected) sourceCounts[item.sourceName || item.sourceId || 'unknown'] = (sourceCounts[item.sourceName || item.sourceId || 'unknown'] || 0) + 1;
  return { items: projected, sourceCounts };
}

function buildPlan(state, config, now) {
  if (!state) return { before: 0, after: 0, rejected: {}, removed: [], items: [], projectedActiveCount: 0, projectedSourceCounts: {}, examples: [] };
  const sources = new Map(config.sources.map(source => [source.id, source]));
  const rejected = {};
  const accepted = [];
  for (const item of state.items) {
    const quality = evaluateTitle(item.title, { sourceId: item.sourceId });
    const timestamp = timestampOf(item);
    let reason = quality.eligible ? null : quality.reason;
    if (!reason && timestamp > now) reason = 'future';
    if (!reason && now - timestamp > config.maxAgeMs) reason = 'stale';
    if (reason) {
      rejected[reason] = (rejected[reason] || 0) + 1;
      continue;
    }
    accepted.push(item);
  }

  const kept = [];
  const removed = [];
  for (const item of accepted) {
    const exactIndex = kept.findIndex(candidate => candidate.id === item.id || candidate.canonicalUrl === item.canonicalUrl);
    if (exactIndex >= 0) {
      const winner = prefer(kept[exactIndex], item, sources);
      const loser = winner === kept[exactIndex] ? item : kept[exactIndex];
      kept[exactIndex] = winner;
      removed.push({ id: loser.id, reason: 'exact_duplicate' });
      continue;
    }
    const fuzzyIndex = kept.findIndex(candidate => qualifiesAsNearDuplicate(candidate, item));
    if (fuzzyIndex >= 0) {
      const winner = prefer(kept[fuzzyIndex], item, sources);
      const loser = winner === kept[fuzzyIndex] ? item : kept[fuzzyIndex];
      kept[fuzzyIndex] = winner;
      removed.push({ id: loser.id, reason: 'near_duplicate' });
      continue;
    }
    kept.push(item);
  }
  kept.sort((left, right) => timestampOf(right) - timestampOf(left));
  if (kept.length > MAX_ITEMS) {
    for (const item of kept.slice(MAX_ITEMS)) removed.push({ id: item.id, reason: 'state_limit' });
  }
  const items = kept.slice(0, MAX_ITEMS);
  const projected = projectActive(items, config.maxItemsPerSource || 10);
  return { before: state.items.length, after: items.length, rejected, removed, items, projectedActiveCount: projected.items.length, projectedSourceCounts: projected.sourceCounts, examples: removed.slice(0, 10) };
}

function fingerprint(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('cache target must be a regular non-symlink file');
  const content = fs.readFileSync(filePath);
  return { inode: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs, hash: crypto.createHash('sha256').update(content).digest('hex') };
}

function assertOwnerOnly(filePath) {
  const stat = fs.lstatSync(filePath);
  const directory = fs.lstatSync(path.dirname(filePath));
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('cache target must be a regular non-symlink file');
  if (directory.isSymbolicLink()) throw new Error('cache directory must not be a symlink');
  if ((stat.mode & 0o777) !== 0o600 || (directory.mode & 0o777) !== 0o700) throw new Error('cache permissions must be directory 0700 and file 0600');
  if (typeof process.getuid === 'function' && (stat.uid !== process.getuid() || directory.uid !== process.getuid())) throw new Error('cache owner does not match the current user');
}

function systemctl(args, runner) {
  const execute = runner || childProcess.execFileSync;
  return execute('systemctl', ['--user', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function serviceIsActive(runner) {
  try { return systemctl(['is-active', SERVICE_NAME], runner) === 'active'; } catch (error) { return false; }
}

function assertAbsent(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    throw new Error('target already exists and will not be overwritten: ' + filePath + (stat.isSymbolicLink() ? ' (symlink)' : ''));
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
  }
}

function applyPlan(filePath, state, plan, config, options) {
  if (!state) throw new Error('cannot apply cleanup because the cache does not exist');
  assertOwnerOnly(filePath);
  const runner = options && options.systemctl;
  const wasActive = serviceIsActive(runner);
  const before = fingerprint(filePath);
  systemctl(['stop', SERVICE_NAME], runner);
  if (serviceIsActive(runner)) throw new Error('service remained active after stop; cache was not changed');
  const afterStop = fingerprint(filePath);
  if (JSON.stringify(before) !== JSON.stringify(afterStop)) throw new Error('cache changed while service was stopping; cleanup aborted');
  const currentState = readState(filePath);
  if (!currentState) throw new Error('cache disappeared after service stop');
  const currentPlan = buildPlan(currentState, config, Date.now());

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + String(Date.now()).slice(-4);
  const backupPath = filePath + '.backup-' + timestamp;
  const temporary = filePath + '.tmp-clean-' + process.pid;
  assertAbsent(backupPath);
  assertAbsent(temporary);
  let restartAttempted = false;
  try {
    fs.copyFileSync(filePath, backupPath);
    fs.chmodSync(backupPath, 0o600);
    const replacement = { ...currentState, updatedAt: Date.now(), items: currentPlan.items };
    const validation = validateNewsState(replacement);
    if (!validation.ok) throw new Error('cleaned cache is invalid: ' + validation.errors.join('; '));
    fs.writeFileSync(temporary, JSON.stringify(replacement, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, filePath);
    assertOwnerOnly(filePath);
    const verified = readState(filePath);
    if (!verified) throw new Error('replacement disappeared during validation');
    if (wasActive) {
      restartAttempted = true;
      systemctl(['start', SERVICE_NAME], runner);
    }
    return { backupPath, restarted: wasActive, plan: currentPlan };
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (cleanupError) {}
    if (restartAttempted) {
      try { systemctl(['stop', SERVICE_NAME], runner); } catch (stopError) {}
    }
    throw error;
  }
}

function formatReport(plan, filePath, mode) {
  const reasons = Object.entries(plan.rejected).map(([reason, count]) => reason + '=' + count).join(', ') || 'none';
  const removed = plan.removed.map(entry => entry.reason).reduce((counts, reason) => { counts[reason] = (counts[reason] || 0) + 1; return counts; }, {});
  const duplicateCounts = Object.entries(removed).map(([reason, count]) => reason + '=' + count).join(', ') || 'none';
  const sourceCounts = Object.entries(plan.projectedSourceCounts || {}).sort(([, left], [, right]) => right - left).slice(0, 10).map(([source, count]) => source + '=' + count).join(', ') || 'none';
  const examples = (plan.examples || []).map(entry => entry.id + '=' + entry.reason).join(', ') || 'none';
  return [
    'Skarn news cache cleanup report',
    'Target: ' + filePath,
    'Before: ' + plan.before,
    'After: ' + plan.after,
    'Rejected: ' + reasons,
    'Removed/deduplicated: ' + duplicateCounts,
    'Projected active pool: ' + (plan.projectedActiveCount || 0),
    'Projected source concentration: ' + sourceCounts,
    'Examples: ' + examples,
    mode === 'apply'
      ? 'Mode: applied after service stop; cache replacement and validation completed'
      : 'Mode: read-only; no feed, service, cache, mail, Git, or chronicle mutation performed',
  ].join('\n');
}

function main(argv, options) {
  const args = new Set(argv);
  if (argv.some(argument => !['--dry-run', '--apply', '--help'].includes(argument))) throw new Error('accepted arguments: --dry-run, --apply, or no argument for a read-only report');
  if (args.has('--help')) {
    console.log('Usage: node scripts/clean-news-cache.js [--dry-run|--apply]');
    return;
  }
  const config = loadConfig(CONFIG_PATH);
  const state = readState(CACHE_PATH);
  const plan = buildPlan(state, config, Date.now());
  if (!args.has('--apply')) {
    console.log(formatReport(plan, CACHE_PATH));
    return;
  }
  const result = applyPlan(CACHE_PATH, state, plan, config, options || {});
  console.log(formatReport(plan, CACHE_PATH, 'apply'));
  console.log('Applied atomically; backup: ' + result.backupPath + '; service restarted: ' + result.restarted);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) {
    console.error('News cache cleanup failed: ' + diagnostic(error));
    process.exitCode = 1;
  }
}

module.exports = { applyPlan, assertOwnerOnly, buildPlan, fingerprint, formatReport, loadConfig, main, readState };
