const { search } = require('duck-duck-scrape');

// ===== LRU cache =====
const cache = new Map(); // normalizedQuery → { results, cachedAt }
const CACHE_MAX = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS = 5;
const GOOGLE_CSE_URL = 'https://www.googleapis.com/customsearch/v1';

function normalizeQuery(query) {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function searchGoogle(query) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return null;

  const url = `${GOOGLE_CSE_URL}?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    // Quota exceeded or invalid key — return null so caller falls back
    if (res.status === 403 || res.status === 429) return null;
    throw new Error(data.error?.message || `Google CSE returned ${res.status}`);
  }

  return (data.items || []).slice(0, MAX_RESULTS).map(r => ({
    title: r.title || '',
    snippet: r.snippet || '',
    url: r.link || '',
  }));
}

async function searchDuckDuckGo(query) {
  const result = await search(query, { safeSearch: -1 });
  return (result.results || []).slice(0, MAX_RESULTS).map(r => ({
    title: r.title || '',
    snippet: r.description || '',
    url: r.url || '',
  }));
}

async function searchWeb(query) {
  const key = normalizeQuery(query);

  // Cache hit — reorder for LRU
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    cache.delete(key);
    cache.set(key, cached);
    return { results: cached.results, source: 'cache' };
  }

  // Fresh search: try Google CSE first, fall back to DuckDuckGo
  let results;
  let source;
  try {
    results = await searchGoogle(query);
    if (results) {
      source = 'google';
    } else {
      // Google not configured or quota exceeded — use DDG
      results = await searchDuckDuckGo(query);
      source = 'duckduckgo';
    }
  } catch (error) {
    return { results: [], source: 'error', error: error.message || 'Unknown search error' };
  }

  // Store in cache
  cache.set(key, { results, cachedAt: Date.now() });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }

  return { results, source };
}

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > CACHE_TTL) cache.delete(key);
  }
  // Also enforce max size
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

module.exports = { searchWeb, cleanCache };
