const TAVILY_URL = 'https://api.tavily.com/search';

// ===== LRU cache =====
const cache = new Map(); // normalizedQuery → { results, cachedAt }
const CACHE_MAX = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS = 5;

function normalizeQuery(query) {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function searchTavily(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [], source: 'error', error: 'Tavily API key not configured' };

  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({
      query: query,
      max_results: MAX_RESULTS,
      search_depth: 'basic', // 1 API credit
    }),
  });

  if (!res.ok) {
    // 401 bad key, 429 rate limit, 432 plan limit, 433 paygo limit — all fail closed
    return { results: [], source: 'error', error: 'Tavily returned ' + res.status };
  }

  const data = await res.json();
  const results = (data.results || []).map(r => ({
    title: r.title || '',
    snippet: r.content || '',
    url: r.url || '',
  }));
  return { results, source: 'tavily' };
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

  let result;
  try {
    result = await searchTavily(query);
  } catch (e) {
    console.log(`[Search] Tavily error: ${e.message}`);
    return { results: [], source: 'error', error: 'Tavily search failed' };
  }
  if (result.source === 'error') {
    console.log(`[Search] Tavily failed for query: ${query} (${result.error})`);
    return result;
  }

  // Store in cache
  cache.set(key, { results: result.results, cachedAt: Date.now() });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  return result;
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
