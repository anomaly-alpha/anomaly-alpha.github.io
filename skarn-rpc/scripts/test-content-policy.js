const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  calculateConfidence,
  compareCandidates,
  createRepetitionPolicy,
  deriveSalience,
  normalizeIconMetadata,
  selectIconForTopic,
  selectReaction,
  selectTopicFamily,
} = require('../features/presence/repetitionPolicy');

const root = path.join(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const registry = readJson('data/icon-registry.json');
const overrides = readJson('data/icon-role-overrides.json');
const reactions = readJson('data/news-reactions.json');

function testStaticJson() {
  assert.strictEqual(registry.length, 130, 'the original icon registry must retain all 130 entries');
  assert.strictEqual(overrides.icons.length, 130, 'every icon needs semantic metadata');
  const registryKeys = registry.map(icon => icon.key);
  const overrideKeys = overrides.icons.map(icon => icon.key);
  assert.strictEqual(new Set(registryKeys).size, 130, 'icon registry keys must remain unique');
  assert.deepStrictEqual([...overrideKeys].sort(), [...registryKeys].sort(), 'metadata must cover exactly the registry keys');
  assert.deepStrictEqual(overrides.roles.slice().sort(), ['attention', 'knowledge', 'mood', 'movement', 'time', 'world']);
  assert.deepStrictEqual(overrides.topics.slice().sort(), ['ai', 'games', 'general', 'release', 'science', 'space']);
  for (const icon of overrides.icons) {
    assert(overrides.roles.includes(icon.role), icon.key + ' has an unknown role');
    assert(icon.topics.length > 0, icon.key + ' needs at least one topic');
    assert(icon.topics.every(topic => overrides.topics.includes(topic)), icon.key + ' has an unknown topic');
    assert.strictEqual(typeof icon.newsEligible, 'boolean', icon.key + ' must declare news eligibility');
    assert(icon.tooltip && Buffer.byteLength(icon.tooltip, 'utf8') <= 128, icon.key + ' tooltip exceeds 128 bytes');
  }
  const seenReactions = [];
  for (const groups of Object.values(reactions.reactions)) {
    for (const entries of Object.values(groups)) seenReactions.push(...entries);
  }
  for (const entry of [...seenReactions, ...Object.values(reactions.fallback)]) {
    assert(entry.trim() && Buffer.byteLength(entry, 'utf8') <= reactions.maxReactionBytes, 'reaction exceeds byte limit');
    assert(!/[\r\n]/.test(entry), 'reaction must be one line');
  }
}

function testSemanticSelection() {
  const metadata = normalizeIconMetadata(registry, overrides);
  const first = selectIconForTopic(metadata, 'space', 'normal', { seed: 'stable' });
  const second = selectIconForTopic(metadata, 'space', 'normal', { seed: 'stable' });
  assert.strictEqual(first.key, second.key, 'icon mapping must be stable');
  assert.strictEqual(selectIconForTopic(metadata, 'ai', 'high', { seed: 'urgent' }).role, 'attention');
  assert.strictEqual(selectIconForTopic(metadata, 'science', 'normal', { seed: 'science' }).topics.includes('science'), true);
  assert.strictEqual(selectIconForTopic(metadata.filter(icon => icon.role !== 'world'), 'space', 'normal'), null,
    'no eligible role/topic combination should return null');
  assert.strictEqual(selectIconForTopic(metadata.map(icon => ({ ...icon, newsEligible: false })), 'space', 'normal'), null,
    'news selection must return null when every matching icon is ineligible');
  assert.strictEqual(selectTopicFamily({ title: 'NASA lunar science update' }), 'space');
  assert.strictEqual(selectTopicFamily({ title: 'A new AI model release' }), 'ai');
  assert.strictEqual(deriveSalience({ title: 'Critical release update', topic: 'release', source: { highSalienceTitlePatterns: ['critical'] } }), 'high');
  assert.strictEqual(deriveSalience({ kind: 'system' }), 'critical');
  assert(calculateConfidence({ source: { trustClass: 'official' }, parserValid: true, safetyValid: true }) >
    calculateConfidence({ source: { trustClass: 'unknown' }, parserValid: true, safetyValid: true }));
  assert(compareCandidates({ salience: 'high', basePriority: 1 }, { salience: 'normal', basePriority: 9 }) < 0,
    'salience must outrank source priority');
}

function testReactionsAndRepetition() {
  assert(selectReaction(reactions, 'science', 'high', 'one'));
  assert(selectReaction(reactions, 'not-a-topic', 'normal', 'two'), 'unknown topics use the general fallback path');
  assert.strictEqual(selectReaction({ maxReactionBytes: 72, reactions: {}, fallback: {} }, 'science', 'normal'), null,
    'reaction selection must return null when no authored fallback exists');
  const policy = createRepetitionPolicy({ phraseCooldownMs: 100, topicCooldownMs: 100, iconCooldownMs: 100, similarityThreshold: 0.7 });
  const first = { id: 'phrase-1', details: 'News · Solar storm watch', state: 'Space · 12m · NASA', iconKey: 'skarn_star', topic: 'space', kind: 'ambient' };
  assert.strictEqual(policy.consider(first, 0).allowed, true);
  assert.strictEqual(policy.consider({ ...first, id: 'phrase-2' }, 10).allowed, false, 'identical content is suppressed');
  assert.strictEqual(policy.consider({ id: 'phrase-3', details: 'News · Solar storm watch expanded', state: 'Space · 13m · NASA', iconKey: 'skarn_star', topic: 'space' }, 20).allowed, false,
    'near-duplicate content is suppressed');
  assert.strictEqual(policy.consider({ id: 'phrase-4', details: 'News · Rust ships a release', state: 'Release · 1m · Rust', iconKey: 'skarn_refresh', topic: 'release', kind: 'news', salience: 'high' }, 20).allowed, true,
    'high-salience news may override ambient cooldowns');
  assert.strictEqual(policy.consider({ id: 'phrase-5', details: 'Fresh space signal', state: 'Space · 30m · NASA', iconKey: 'skarn_star', topic: 'space' }, 101).allowed, true,
    'cooldowns expire deterministically');
  assert.strictEqual(policy.getHistory().length, 2, 'expired history is pruned to the active cooldown window');
}

function main() {
  testStaticJson();
  testSemanticSelection();
  testReactionsAndRepetition();
  console.log('content policy verified: 130 icons, bounded reactions, semantic selection, salience, similarity, and cooldowns');
}

main();
