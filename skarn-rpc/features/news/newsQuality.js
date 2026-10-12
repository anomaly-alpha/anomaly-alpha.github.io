const NEWS_HEADLINE_MAX_GRAPHEMES = 48;
const NEWS_METADATA_MAX_GRAPHEMES = 42;
const NEWS_FIELD_MAX_BYTES = 128;

let segmenter;

function getSegmenter() {
  if (!segmenter) {
    if (!Intl || typeof Intl.Segmenter !== 'function') {
      const error = new Error('Intl.Segmenter is required for news display validation');
      error.code = 'GRAPHEME_SEGMENTER_UNAVAILABLE';
      throw error;
    }
    segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  }
  return segmenter;
}

function normalizeTitle(value) {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function graphemes(value) {
  return Array.from(getSegmenter().segment(String(value === undefined || value === null ? '' : value)), entry => entry.segment);
}

function graphemeCount(value) {
  return graphemes(value).length;
}

function meaningfulTokens(value) {
  return normalizeTitle(value).match(/[\p{L}]{3,}|[\p{N}]{3,}/gu) || [];
}

function isVersionOnly(value) {
  const title = normalizeTitle(value);
  if (!title) return false;
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(title)) return true;
  if (/^(?:v|version\s*)?\d+(?:[._-]\d+){1,}(?:[-+._][a-z0-9.-]+)?$/i.test(title)) return true;
  if (/^(?:0x)?[a-f0-9]{7,}$/i.test(title)) return true;
  if (/^[\d./_-]+$/.test(title)) return true;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(title)) return true;
  return false;
}

function hasMeaningfulSubject(value) {
  return meaningfulTokens(value).some(token => /\p{L}/u.test(token));
}

function removeBoilerplate(value) {
  let title = normalizeTitle(value);
  const prefix = /^(?:breaking|video|new|watch|announcement)\s*:\s*/i;
  if (prefix.test(title)) {
    const remainder = title.replace(prefix, '').trim();
    if (hasMeaningfulSubject(remainder)) title = remainder;
  }
  return title;
}

function removeRedundantParentheticals(value) {
  let title = value;
  let previous;
  do {
    previous = title;
    title = title.replace(/\s*\([^()]{1,120}\)(?=\s*$)/, '').trim();
  } while (title !== previous);
  return hasMeaningfulSubject(title) ? title : value;
}

function wordBoundaryPrefix(value, maxGraphemes) {
  const units = graphemes(value);
  if (units.length <= maxGraphemes) return value;
  const budget = Math.max(1, maxGraphemes - 1);
  let prefix = units.slice(0, budget).join('').trimEnd();
  const boundary = prefix.lastIndexOf(' ');
  if (boundary >= Math.floor(budget * 0.55)) prefix = prefix.slice(0, boundary).trimEnd();
  return prefix + '…';
}

function compactTitle(value, options) {
  const settings = options || {};
  const maxGraphemes = Number.isSafeInteger(settings.maxGraphemes) && settings.maxGraphemes > 0
    ? settings.maxGraphemes
    : NEWS_HEADLINE_MAX_GRAPHEMES;
  let title = removeBoilerplate(value);
  title = removeRedundantParentheticals(title);
  if (graphemeCount(title) <= maxGraphemes) return title;

  const sentence = title.split(/(?<=[.!?])\s+/u).find(candidate => graphemeCount(candidate) <= maxGraphemes && hasMeaningfulSubject(candidate));
  if (sentence) return sentence.trim();

  const compact = wordBoundaryPrefix(title, maxGraphemes);
  return hasMeaningfulSubject(compact.replace(/…$/, '')) ? compact : '';
}

function matchesException(title, sourceId, exceptions) {
  if (!Array.isArray(exceptions)) return false;
  return exceptions.some(rule => {
    if (!rule || rule.sourceId !== sourceId) return false;
    if (typeof rule.title === 'string') return normalizeTitle(rule.title).toLowerCase() === title.toLowerCase();
    if (typeof rule.pattern === 'string') {
      try { return new RegExp(rule.pattern, rule.flags || 'i').test(title); } catch (error) { return false; }
    }
    return false;
  });
}

function evaluateTitle(value, options) {
  const settings = options || {};
  const normalizedTitle = normalizeTitle(value);
  if (!normalizedTitle) return { eligible: false, reason: 'empty_title', normalizedTitle, displayTitle: '' };
  if (/[\u0000-\u001f\u007f-\u009f]/.test(String(value || ''))) return { eligible: false, reason: 'unsafe_text', normalizedTitle, displayTitle: '' };
  if (isVersionOnly(normalizedTitle) && !matchesException(normalizedTitle, settings.sourceId, settings.shortTitleExceptions)) {
    return { eligible: false, reason: 'version_only', normalizedTitle, displayTitle: '' };
  }
  if (!hasMeaningfulSubject(normalizedTitle) && !matchesException(normalizedTitle, settings.sourceId, settings.shortTitleExceptions)) {
    return { eligible: false, reason: 'no_meaningful_word', normalizedTitle, displayTitle: '' };
  }
  const displayTitle = compactTitle(normalizedTitle, settings);
  if (!displayTitle || graphemeCount(displayTitle) > (settings.maxGraphemes || NEWS_HEADLINE_MAX_GRAPHEMES)) {
    return { eligible: false, reason: 'overlong_compaction', normalizedTitle, displayTitle: '' };
  }
  return { eligible: true, reason: 'accepted', normalizedTitle, displayTitle };
}

function normalizedTokens(value) {
  return new Set((normalizeTitle(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
}

function tokenSimilarity(left, right) {
  const leftTokens = normalizedTokens(left);
  const rightTokens = normalizedTokens(right);
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection++;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function qualifiesAsNearDuplicate(left, right) {
  if (!left || !right || left.topic !== right.topic) return false;
  let leftUrl;
  let rightUrl;
  try {
    leftUrl = new URL(left.canonicalUrl);
    rightUrl = new URL(right.canonicalUrl);
  } catch (error) {
    return false;
  }
  if (leftUrl.hostname.toLowerCase() !== rightUrl.hostname.toLowerCase() || leftUrl.pathname.replace(/\/$/, '') !== rightUrl.pathname.replace(/\/$/, '')) return false;
  const leftTime = Date.parse(left.updatedAt || left.publishedAt || '');
  const rightTime = Date.parse(right.updatedAt || right.publishedAt || '');
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime) || Math.abs(leftTime - rightTime) > 24 * 60 * 60 * 1000) return false;
  if (graphemeCount(left.title) < 12 || graphemeCount(right.title) < 12) return false;
  return tokenSimilarity(left.title, right.title) >= 0.92;
}

function displayWithinBudget(value, maxGraphemes, maxBytes) {
  return graphemeCount(value) <= maxGraphemes && Buffer.byteLength(String(value), 'utf8') <= maxBytes;
}

module.exports = {
  NEWS_FIELD_MAX_BYTES,
  NEWS_HEADLINE_MAX_GRAPHEMES,
  NEWS_METADATA_MAX_GRAPHEMES,
  compactTitle,
  displayWithinBudget,
  evaluateTitle,
  graphemeCount,
  graphemes,
  isVersionOnly,
  normalizeTitle,
  qualifiesAsNearDuplicate,
  tokenSimilarity,
};
