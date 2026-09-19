const crypto = require('crypto');

const ROLES = Object.freeze(['attention', 'knowledge', 'movement', 'time', 'mood', 'world']);
const TOPICS = Object.freeze(['science', 'space', 'ai', 'release', 'games', 'general']);
const TOPIC_ALIASES = Object.freeze({ developer: 'release', security: 'release', research: 'science', gaming: 'games' });
const SALIENCE = Object.freeze(['low', 'normal', 'high', 'critical']);
const TRUST_SCORES = Object.freeze({ official: 1, trusted: 0.9, verified: 0.85, known: 0.75, unknown: 0.35, untrusted: 0.1 });
const DEFAULTS = Object.freeze({
  historyLimit: 48,
  similarityThreshold: 0.84,
  phraseCooldownMs: 30 * 60 * 1000,
  topicCooldownMs: 15 * 60 * 1000,
  iconCooldownMs: 20 * 60 * 1000,
});

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hashText(value) {
  return crypto.createHash('sha256').update(normalizeText(value), 'utf8').digest('hex').slice(0, 24);
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? new Set(normalized.split(' ')) : new Set();
}

function similarity(left, right) {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return (2 * intersection) / (a.size + b.size);
}

function combinedText(candidate) {
  return [candidate && candidate.details, candidate && candidate.state].filter(Boolean).join(' | ');
}

function normalizeTopic(topic) {
  const normalized = normalizeText(topic).replace(/ /g, '_');
  const canonical = TOPIC_ALIASES[normalized] || normalized;
  return TOPICS.includes(canonical) ? canonical : 'general';
}

function normalizeSalience(salience) {
  const normalized = normalizeText(salience);
  return SALIENCE.includes(normalized) ? normalized : 'normal';
}

function salienceRank(salience) {
  return { low: 0, normal: 1, high: 2, critical: 3 }[normalizeSalience(salience)];
}

function isCooldownOverride(candidate) {
  return Boolean(candidate && (
    candidate.allowCooldownOverride === true ||
    candidate.kind === 'system' ||
    candidate.kind === 'recovery' ||
    candidate.kind === 'failure' ||
    ['high', 'critical'].includes(normalizeSalience(candidate.salience))
  ));
}

function candidateKeys(candidate) {
  const phraseSource = candidate && (candidate.phraseHash || candidate.phraseId || candidate.id || combinedText(candidate));
  const details = normalizeText(candidate && candidate.details);
  const state = normalizeText(candidate && candidate.state);
  const iconKey = String(candidate && (candidate.iconKey || candidate.smallImageKey) || '').trim();
  const topic = normalizeTopic(candidate && (candidate.topic || candidate.topicFamily));
  return {
    phraseHash: hashText(phraseSource),
    iconKey,
    iconTopic: iconKey ? iconKey + '|' + topic : '',
    details,
    state,
    text: [details, state].filter(Boolean).join(' | '),
    topic,
  };
}

function assertNow(now) {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('now must be a non-negative number');
}

function createRepetitionPolicy(options) {
  const config = Object.assign({}, DEFAULTS, options || {});
  for (const key of ['historyLimit', 'phraseCooldownMs', 'topicCooldownMs', 'iconCooldownMs']) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 0) throw new RangeError(key + ' must be a non-negative safe integer');
  }
  if (typeof config.similarityThreshold !== 'number' || config.similarityThreshold < 0 || config.similarityThreshold > 1) {
    throw new RangeError('similarityThreshold must be between 0 and 1');
  }

  const history = [];
  const phraseUses = new Map();
  const iconTopicUses = new Map();
  const topicUses = new Map();
  const iconUses = new Map();
  const textUses = [];

  function prune(now) {
    const minimum = now - Math.max(config.phraseCooldownMs, config.topicCooldownMs, config.iconCooldownMs);
    while (history.length && history[0].at < minimum) history.shift();
    while (textUses.length && textUses[0].at < minimum) textUses.shift();
    for (const map of [phraseUses, iconTopicUses, topicUses, iconUses]) {
      for (const [key, at] of map) if (at < minimum) map.delete(key);
    }
  }

  function setBounded(map, key, at) {
    if (!config.historyLimit) return;
    map.set(key, at);
    while (map.size > config.historyLimit) {
      let oldestKey;
      let oldestAt = Infinity;
      for (const [candidateKey, candidateAt] of map) {
        if (candidateAt < oldestAt) {
          oldestKey = candidateKey;
          oldestAt = candidateAt;
        }
      }
      map.delete(oldestKey);
    }
  }

  function evaluate(candidate, now) {
    assertNow(now);
    prune(now);
    const keys = candidateKeys(candidate || {});
    const override = isCooldownOverride(candidate);
    const reasons = [];
    if (!keys.text) reasons.push('empty-content');
    if (phraseUses.has(keys.phraseHash)) reasons.push('recent-phrase-hash');
    if (keys.iconTopic && iconTopicUses.has(keys.iconTopic) && !override) reasons.push('recent-icon-topic');
    if (keys.text && textUses.some(entry => similarity(keys.text, entry.text) >= config.similarityThreshold)) {
      reasons.push('near-duplicate');
    }
    if (keys.topic && topicUses.has(keys.topic) && !override) reasons.push('topic-cooldown');
    if (keys.iconKey && iconUses.has(keys.iconKey) && !override) reasons.push('icon-cooldown');
    return { allowed: reasons.length === 0, reasons, keys, override };
  }

  function record(candidate, now) {
    assertNow(now);
    const result = evaluate(candidate, now);
    const entry = Object.assign({ at: now }, result.keys, {
      id: candidate && candidate.id,
      kind: candidate && candidate.kind || 'ambient',
      salience: normalizeSalience(candidate && candidate.salience),
    });
    history.push(entry);
    while (history.length > config.historyLimit) history.shift();
    setBounded(phraseUses, entry.phraseHash, now);
    if (entry.iconTopic) setBounded(iconTopicUses, entry.iconTopic, now);
    if (entry.topic) setBounded(topicUses, entry.topic, now);
    if (entry.iconKey) setBounded(iconUses, entry.iconKey, now);
    if (entry.text) textUses.push({ at: now, text: entry.text });
    while (textUses.length > config.historyLimit) textUses.shift();
    return entry;
  }

  function consider(candidate, now) {
    const result = evaluate(candidate, now);
    if (result.allowed) record(candidate, now);
    return result;
  }

  return {
    consider,
    evaluate,
    record,
    reset() {
      history.length = 0;
      textUses.length = 0;
      phraseUses.clear();
      iconTopicUses.clear();
      topicUses.clear();
      iconUses.clear();
    },
    getHistory() { return history.slice(); },
    getConfig() { return Object.assign({}, config); },
  };
}

function normalizeIconMetadata(registry, overrides) {
  if (!Array.isArray(registry)) throw new TypeError('icon registry must be an array');
  const overrideList = Array.isArray(overrides) ? overrides : overrides && Array.isArray(overrides.icons) ? overrides.icons : [];
  const overrideByKey = new Map(overrideList.map(item => [item.key, item]));
  const registryKeys = new Set(registry.map(icon => icon && icon.key));
  if (overrideByKey.size !== registry.length || [...overrideByKey.keys()].some(key => !registryKeys.has(key))) {
    throw new Error('icon role overrides must cover exactly the registry keys');
  }
  return registry.map(icon => {
    const override = overrideByKey.get(icon.key);
    const role = override.role;
    const rawTopics = Array.isArray(override.topics) ? override.topics : [];
    const topics = rawTopics.map(normalizeTopic);
    if (!ROLES.includes(role) || topics.length === 0 || typeof override.tooltip !== 'string' || !override.tooltip.trim()) {
      throw new Error('invalid semantic metadata for ' + icon.key);
    }
    if (topics.some((topic, index) => !TOPICS.includes(rawTopics[index]))) throw new Error('unknown topic for ' + icon.key);
    if (typeof override.newsEligible !== 'boolean') throw new Error('newsEligible is required for ' + icon.key);
    if (override.tooltip !== override.tooltip.normalize('NFKC').trim() || /[\r\n]/.test(override.tooltip) || Buffer.byteLength(override.tooltip, 'utf8') > 128) {
      throw new Error('invalid tooltip for ' + icon.key);
    }
    if (override.tooltipOnly !== undefined && typeof override.tooltipOnly !== 'boolean') throw new Error('tooltipOnly must be boolean for ' + icon.key);
    return Object.assign({}, icon, override, { topics, tooltipOnly: override.tooltipOnly === true });
  });
}

function roleForTopic(topic, salience) {
  if (['high', 'critical'].includes(normalizeSalience(salience))) return 'attention';
  return { science: 'world', space: 'world', ai: 'knowledge', release: 'movement', games: 'mood', general: 'knowledge' }[normalizeTopic(topic)];
}

function stableIconIndex(seed, length) {
  if (!length) return -1;
  return Number.parseInt(hashText(seed).slice(0, 8), 16) % length;
}

function selectIconForTopic(metadata, topic, salience, options) {
  const normalizedTopic = normalizeTopic(topic);
  const role = options && options.role || roleForTopic(normalizedTopic, salience);
  const newsOnly = !options || options.newsOnly !== false;
  const candidates = metadata.filter(icon =>
    icon.role === role && (!newsOnly || icon.newsEligible) &&
    (icon.topics.includes(normalizedTopic) || icon.topics.includes('general')),
  );
  const usable = candidates.filter(icon => !icon.tooltipOnly);
  const pool = usable.length ? usable : candidates;
  if (!pool.length) return null;
  const exact = pool.filter(icon => icon.topics.includes(normalizedTopic));
  const selectedPool = exact.length ? exact : pool;
  return selectedPool.slice().sort((a, b) => a.key.localeCompare(b.key))[stableIconIndex(
    (options && options.seed) || normalizedTopic + '|' + normalizeSalience(salience) + '|' + role,
    selectedPool.length,
  )];
}

function selectTopicFamily(input, rules) {
  const text = normalizeText(input && (input.title || input.text || input));
  const explicit = normalizeTopic(input && (input.topic || input.topicFamily));
  if (input && (input.topic || input.topicFamily) && explicit !== 'general') return explicit;
  const configured = rules || {
    space: ['space', 'nasa', 'orbit', 'lunar', 'planet', 'astronomy', 'rocket'],
    science: ['science', 'research', 'climate', 'biology', 'physics', 'health'],
    ai: [' ai ', 'artificial intelligence', 'model', 'inference', 'machine learning'],
    release: ['release', 'released', 'launch', 'update', 'version', 'changelog', 'patch'],
    games: ['game', 'gaming', 'playstation', 'xbox', 'steam', 'console'],
  };
  for (const topic of ['space', 'science', 'ai', 'release', 'games']) {
    if ((configured[topic] || []).some(term => {
      const normalizedTerm = normalizeText(term);
      return normalizedTerm === 'ai' ? tokenize(text).has('ai') : text.includes(normalizedTerm);
    })) return topic;
  }
  return 'general';
}

function deriveSalience(candidate, rules) {
  if (candidate && ['critical', 'high', 'normal', 'low'].includes(normalizeSalience(candidate.salience))) {
    if (candidate.salience === 'critical') return 'critical';
    if (candidate.salience === 'high') return 'high';
  }
  if (candidate && ['system', 'recovery', 'failure'].includes(candidate.kind)) return 'critical';
  const title = normalizeText(candidate && candidate.title);
  const source = candidate && candidate.source || {};
  const highTitles = (rules && rules.highSalienceTitlePatterns) || source.highSalienceTitlePatterns || [];
  const highTopics = (rules && rules.highSalienceTopics) || source.highSalienceTopics || [];
  if (highTopics.map(normalizeTopic).includes(normalizeTopic(candidate && (candidate.topic || candidate.topicFamily)))) return 'high';
  if (highTitles.some(pattern => title.includes(normalizeText(pattern)))) return 'high';
  return candidate && candidate.kind === 'ambient' ? 'low' : 'normal';
}

function calculateConfidence(candidate) {
  const source = candidate && candidate.source || candidate || {};
  const trust = TRUST_SCORES[source.trustClass] === undefined ? TRUST_SCORES.unknown : TRUST_SCORES[source.trustClass];
  const parserValidity = source.parserValid === false || candidate && candidate.parserValid === false ? 0 : 1;
  const safetyValidity = source.safetyValid === false || candidate && candidate.safetyValid === false ? 0 : 1;
  return Number((trust * parserValidity * safetyValidity).toFixed(3));
}

function compareCandidates(left, right) {
  const salienceDifference = salienceRank(right && right.salience) - salienceRank(left && left.salience);
  if (salienceDifference) return salienceDifference;
  const leftPriority = Number(left && (left.basePriority === undefined ? left.source && left.source.basePriority : left.basePriority)) || 0;
  const rightPriority = Number(right && (right.basePriority === undefined ? right.source && right.source.basePriority : right.basePriority)) || 0;
  if (rightPriority !== leftPriority) return rightPriority - leftPriority;
  const leftFreshness = Date.parse(left && (left.publishedAt || left.updatedAt || '')) || 0;
  const rightFreshness = Date.parse(right && (right.publishedAt || right.updatedAt || '')) || 0;
  if (rightFreshness !== leftFreshness) return rightFreshness - leftFreshness;
  return String(left && (left.id || left.title) || '').localeCompare(String(right && (right.id || right.title) || ''));
}

function selectReaction(reactions, topic, salience, seed) {
  const normalizedTopic = normalizeTopic(topic);
  const level = normalizeSalience(salience) === 'critical' ? 'high' : normalizeSalience(salience);
  const groups = reactions && reactions.reactions || {};
  const list = groups[normalizedTopic] && groups[normalizedTopic][level];
  const fallback = reactions && reactions.fallback && reactions.fallback[level];
  const candidates = Array.isArray(list) ? list : fallback ? [fallback] : [];
  const maxBytes = reactions && Number.isSafeInteger(reactions.maxReactionBytes) ? reactions.maxReactionBytes : 72;
  const safe = candidates.filter(value => typeof value === 'string' && value.trim() && Buffer.byteLength(value, 'utf8') <= maxBytes);
  if (!safe.length) return null;
  return safe[stableIconIndex((seed || '') + '|' + normalizedTopic + '|' + level, safe.length)];
}

module.exports = {
  DEFAULTS,
  ROLES,
  SALIENCE,
  TOPICS,
  calculateConfidence,
  candidateKeys,
  compareCandidates,
  createRepetitionPolicy,
  deriveSalience,
  hashText,
  isCooldownOverride,
  normalizeIconMetadata,
  normalizeSalience,
  normalizeText,
  normalizeTopic,
  roleForTopic,
  selectIconForTopic,
  selectReaction,
  selectTopicFamily,
  similarity,
};
