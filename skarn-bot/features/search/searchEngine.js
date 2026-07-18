const { search } = require('duck-duck-scrape');

// ===== LRU cache =====
const cache = new Map(); // normalizedQuery → { results, cachedAt }
const CACHE_MAX = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function normalizeQuery(query) {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
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

  // Fresh search
  try {
    const result = await search(query, { safeSearch: -1 });
    const results = (result.results || []).slice(0, 5).map(r => ({
      title: r.title || '',
      snippet: r.description || '',
      url: r.url || '',
    }));

    // Store in cache
    cache.set(key, { results, cachedAt: Date.now() });
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }

    return { results, source: 'duckduckgo' };
  } catch (error) {
    return { results: [], source: 'error', error: error.message || 'Unknown search error' };
  }
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
