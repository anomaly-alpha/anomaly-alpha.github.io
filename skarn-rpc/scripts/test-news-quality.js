const assert = require('assert/strict');
const config = require('../data/news-sources.json');
const { evaluateTitle, graphemeCount, qualifiesAsNearDuplicate, tokenSimilarity } = require('../features/news/newsQuality');
const { createCandidateSelector } = require('../features/presence/candidateSelector');
const { loadNewsState, createEmptyState, validateNewsState } = require('../features/news/newsState');
const { applyPlan, buildPlan } = require('./clean-news-cache');
const fs = require('fs');
const os = require('os');
const path = require('path');

const NOW = Date.parse('2026-09-20T12:00:00.000Z');

function item(id, sourceId, title, minutes) {
  const timestamp = new Date(NOW - minutes * 60000).toISOString();
  return { id, title, canonicalUrl: 'https://example.test/' + id, sourceId, sourceName: sourceId, publishedAt: timestamp, updatedAt: timestamp, fetchedAt: timestamp, topic: 'developer', confidence: 0.95, basePriority: 50, salience: 'normal', iconRole: 'knowledge', safetyDecision: 'accepted' };
}

assert.equal(evaluateTitle('44.103.7').reason, 'version_only');
assert.equal(evaluateTitle('v9.9.0-M2').eligible, false);
assert.equal(evaluateTitle('A meaningful launch headline').eligible, true);
const long = evaluateTitle('A long headline about the ancient machinery of release engineering that must fit the mobile activity surface');
assert.equal(long.eligible, true);
assert.ok(graphemeCount(long.displayTitle) <= 48);
assert.equal(evaluateTitle('🚀'.repeat(60)).eligible, false);
assert.equal(graphemeCount('é👨‍👩‍👧‍👦') , 2);
assert.ok(tokenSimilarity('A new secure release arrives today', 'A new secure release arrives today') >= 0.92);
const nearLeft = { ...item('a', 'one', 'A new secure release arrives today', 10), canonicalUrl: 'https://example.test/shared?edition=one' };
const nearRight = { ...item('b', 'two', 'A new secure release arrives today', 20), canonicalUrl: 'https://example.test/shared?edition=two' };
assert.equal(qualifiesAsNearDuplicate(nearLeft, nearRight), true);
assert.equal(qualifiesAsNearDuplicate(item('c', 'one', 'A new secure release arrives today', 10), { ...item('d', 'two', 'A new secure release arrives today', 20), topic: 'science' }), false);

const candidates = Array.from({ length: 12 }, (_, index) => item('source-a-' + index, 'source-a', 'A meaningful source A headline ' + index, index));
const selector = createCandidateSelector({ maxItemsPerSource: 10, newsPoller: { getCandidates: () => candidates }, random: () => 0, renderNews: value => ({ details: value.title, state: 'Developer · source · now' }) });
const selected = selector.select({ id: 'ambient', details: 'Ambient', state: 'Quiet' }, NOW);
assert.ok(selected);
assert.ok(selector.getActive());
assert.equal(selector.getNewsCandidates(NOW).length, 10);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-news-quality-'));
assert.equal(loadNewsState(path.join(temporary, 'missing.json'), { now: NOW }).items.length, 0);
fs.writeFileSync(path.join(temporary, 'bad.json'), '{not-json');
assert.throws(() => loadNewsState(path.join(temporary, 'bad.json'), { now: NOW }), /could not be read/);
assert.equal(validateNewsState(createEmptyState(NOW)).ok, true);

const state = createEmptyState(NOW);
const goodItem = item('good', 'source-a', 'A meaningful story headline', 5);
const duplicateItem = { ...item('duplicate', 'source-a', 'A meaningful story headline', 4), canonicalUrl: goodItem.canonicalUrl + '?edition=2' };
state.items = [item('noise', 'source-a', '44.103.7', 10), goodItem, duplicateItem];
const plan = buildPlan(state, config, NOW);
assert.equal(plan.rejected.version_only, 1);
assert.equal(plan.after, 1);
assert.equal(plan.removed.some(entry => entry.reason === 'exact_duplicate' || entry.reason === 'near_duplicate'), true);

const applyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-news-apply-'));
const applyPath = path.join(applyDirectory, 'news-state.json');
const applyState = createEmptyState(NOW);
applyState.items = [item('apply-item', 'source-a', 'A meaningful cache item', 2)];
fs.writeFileSync(applyPath, JSON.stringify(applyState, null, 2) + '\n', { mode: 0o600 });
fs.chmodSync(applyDirectory, 0o700);
fs.chmodSync(applyPath, 0o600);
let active = true;
const systemctl = (command, args) => {
  assert.equal(command, 'systemctl');
  const action = args[1];
  if (action === 'is-active') return active ? 'active' : 'inactive';
  if (action === 'stop') { active = false; return ''; }
  if (action === 'start') { active = true; return ''; }
  throw new Error('unexpected systemctl action');
};
const applyResult = applyPlan(applyPath, applyState, buildPlan(applyState, config, NOW), config, { systemctl });
assert.equal(applyResult.restarted, true);
assert.equal(active, true);
assert.ok(fs.existsSync(applyResult.backupPath));
assert.equal(validateNewsState(JSON.parse(fs.readFileSync(applyPath, 'utf8'))).ok, true);
fs.unlinkSync(applyResult.backupPath);
fs.unlinkSync(applyPath);
fs.rmdirSync(applyDirectory);

console.log('news quality tests passed: title classification, graphemes, deduplication, source cap, fail-closed state, and cleanup planning');
