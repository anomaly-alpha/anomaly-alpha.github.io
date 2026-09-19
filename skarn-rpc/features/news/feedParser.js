const Parser = require('rss-parser');

const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ALL_TIME_MAX_AGE_MS = Number.MAX_SAFE_INTEGER;
const MAX_TITLE_BYTES = 256;
const MAX_ID_BYTES = 512;
const MAX_URL_BYTES = 2048;
const MAX_SOURCE_BYTES = 128;
const MAX_TOPIC_BYTES = 64;
const SENSITIVE_URL_PARAM = /(?:access[_-]?token|api[_-]?key|auth|credential|jwt|key|password|secret|session|sig(?:nature)?|token)/i;
const INSTRUCTION_PATTERN = /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?|(?:system|developer|assistant)\s+(?:prompt|message)|\b(?:system|developer|assistant)\s*:/i;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const HTML_PATTERN = /<[^>]*>/g;
const ENTITY_PATTERN = /&(#x?[0-9a-f]+|nbsp|amp|lt|gt|quot|apos);/gi;
const parser = new Parser();

function decodeEntity(match, value) {
  const lower = value.toLowerCase();
  if (lower === 'nbsp') return ' ';
  if (lower === 'amp') return '&';
  if (lower === 'lt') return '<';
  if (lower === 'gt') return '>';
  if (lower === 'quot') return '"';
  if (lower === 'apos') return "'";
  const number = lower[0] === 'x' ? parseInt(lower.slice(1), 16) : parseInt(lower.slice(1), 10);
  return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' ';
}

function sanitizeText(value) {
  const original = String(value === undefined || value === null ? '' : value);
  const hadHtml = HTML_PATTERN.test(original);
  HTML_PATTERN.lastIndex = 0;
  const decoded = original.replace(ENTITY_PATTERN, decodeEntity);
  const withoutHtml = decoded.replace(HTML_PATTERN, ' ');
  const hadControlCharacters = CONTROL_PATTERN.test(withoutHtml);
  CONTROL_PATTERN.lastIndex = 0;
  const withoutControls = withoutHtml.replace(CONTROL_PATTERN, ' ');
  const instructionLike = INSTRUCTION_PATTERN.test(withoutControls);
  const text = withoutControls.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return { text, hadHtml, hadControlCharacters, instructionLike };
}

function byteLength(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

function canonicalizeUrl(value) {
  let parsed;
  try { parsed = new URL(String(value)); } catch (error) { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (/^(?:utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key) || SENSITIVE_URL_PARAM.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return parsed.toString();
}

function firstValue(item, fields) {
  for (const field of fields) {
    if (item[field] !== undefined && item[field] !== null && String(item[field]).trim() !== '') return item[field];
  }
  return null;
}

function parseTimestamp(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toIso(timestamp) {
  return new Date(timestamp).toISOString();
}

function matchesAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some(term => lower.includes(String(term).toLowerCase()));
}

function matchesAll(text, terms) {
  const lower = text.toLowerCase();
  return terms.every(term => lower.includes(String(term).toLowerCase()));
}

function determineSalience(title, source) {
  const rule = source.highSalience || {};
  const sourceMatch = Array.isArray(rule.sourceIds) && rule.sourceIds.includes(source.id);
  const topicMatch = Array.isArray(rule.topicFamilies) && rule.topicFamilies.includes(source.topicFamily);
  const titleAny = Array.isArray(rule.titleAny) ? rule.titleAny : [];
  const titleAll = Array.isArray(rule.titleAll) ? rule.titleAll : [];
  const titleNone = Array.isArray(rule.titleNone) ? rule.titleNone : [];
  const titleMatch = titleAny.length > 0 && matchesAny(title, titleAny) && matchesAll(title, titleAll);
  const titleExcluded = matchesAny(title, titleNone);
  return sourceMatch && topicMatch && titleMatch && !titleExcluded ? 'high' : 'normal';
}

function reject(reason, index) {
  return { index, reason };
}

function normalizeItem(item, source, options, index) {
  const now = options.now;
  const maxAgeMs = options.maxAgeMs || DEFAULT_MAX_AGE_MS;
  const titleResult = sanitizeText(firstValue(item, ['title']));
  if (!titleResult.text) return reject('empty-title', index);
  if (titleResult.instructionLike) return reject('instruction-like-text', index);
  if (byteLength(titleResult.text) > MAX_TITLE_BYTES) return reject('title-too-long', index);

  const canonicalUrl = canonicalizeUrl(firstValue(item, ['link', 'url', 'id', 'guid']));
  if (!canonicalUrl || byteLength(canonicalUrl) > MAX_URL_BYTES) return reject('invalid-url', index);
  const rawId = firstValue(item, ['id', 'guid']) || canonicalUrl;
  const idResult = sanitizeText(rawId);
  if (!idResult.text || byteLength(idResult.text) > MAX_ID_BYTES) return reject('invalid-id', index);

  const publishedTimestamp = parseTimestamp(firstValue(item, ['isoDate', 'pubDate', 'published', 'dcDate', 'date', 'updated']));
  const updatedTimestamp = parseTimestamp(firstValue(item, ['updated', 'isoDate', 'pubDate', 'published', 'dcDate', 'date']));
  if (publishedTimestamp === null) return reject('missing-timestamp', index);
  if (publishedTimestamp > now || (updatedTimestamp !== null && updatedTimestamp > now)) return reject('future-timestamp', index);
  if (now - publishedTimestamp > maxAgeMs) return reject('stale', index);

  const sourceNameResult = sanitizeText(source.name);
  const topicResult = sanitizeText(source.topicFamily);
  if (!sourceNameResult.text || byteLength(sourceNameResult.text) > MAX_SOURCE_BYTES || !topicResult.text || byteLength(topicResult.text) > MAX_TOPIC_BYTES) {
    return reject('source-metadata-invalid', index);
  }
  const confidence = source.trustClass === 'official' ? 0.95 : 0.75;
  const salience = determineSalience(titleResult.text, source);
  return {
    id: idResult.text,
    title: titleResult.text,
    canonicalUrl,
    sourceId: source.id,
    sourceName: sourceNameResult.text,
    publishedAt: toIso(publishedTimestamp),
    updatedAt: toIso(updatedTimestamp === null ? publishedTimestamp : updatedTimestamp),
    fetchedAt: toIso(now),
    topic: topicResult.text,
    confidence,
    basePriority: Number.isFinite(source.basePriority) ? source.basePriority : 0,
    salience,
    iconRole: source.iconRole || 'world',
    safetyDecision: 'accepted',
  };
}

function deduplicateItems(items) {
  const unique = [];
  for (const item of items) {
    const matches = unique.filter(candidate => candidate.id === item.id || candidate.canonicalUrl === item.canonicalUrl);
    if (matches.length === 0) {
      unique.push(item);
      continue;
    }
    const newest = [item, ...matches].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
    for (const match of matches) unique.splice(unique.indexOf(match), 1);
    unique.push(newest);
  }
  return unique.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

async function parseFeedDetailed(xml, source, options) {
  if (!source || typeof source !== 'object') throw new TypeError('source metadata is required');
  const requestedMaxAge = (options && options.maxAgeMs) || source.maxAgeMs;
  const maxAgeMs = Number.isSafeInteger(requestedMaxAge) && requestedMaxAge > 0
    ? requestedMaxAge
    : DEFAULT_MAX_AGE_MS;
  const settings = { now: Date.now(), maxAgeMs, ...(options || {}) };
  settings.maxAgeMs = Number.isSafeInteger(settings.maxAgeMs) && settings.maxAgeMs > 0
    ? settings.maxAgeMs
    : DEFAULT_MAX_AGE_MS;
  if (!Number.isSafeInteger(settings.now) || settings.now < 0) throw new RangeError('now must be a non-negative safe integer');
  let parsed;
  try {
    parsed = await parser.parseString(String(xml));
  } catch (error) {
    const failure = new Error('feed XML is malformed');
    failure.code = 'FEED_XML_INVALID';
    throw failure;
  }
  const items = [];
  const rejected = [];
  for (const [index, item] of (parsed.items || []).entries()) {
    const result = normalizeItem(item, source, settings, index);
    if (result && result.reason) rejected.push(result);
    else items.push(result);
  }
  return { items: deduplicateItems(items), rejected };
}

async function parseFeed(xml, source, options) {
  return (await parseFeedDetailed(xml, source, options)).items;
}

module.exports = {
  DEFAULT_MAX_AGE_MS,
  ALL_TIME_MAX_AGE_MS,
  MAX_ID_BYTES,
  MAX_SOURCE_BYTES,
  MAX_TITLE_BYTES,
  MAX_TOPIC_BYTES,
  MAX_URL_BYTES,
  byteLength,
  canonicalizeUrl,
  determineSalience,
  parseFeed,
  parseFeedDetailed,
  sanitizeText,
};
