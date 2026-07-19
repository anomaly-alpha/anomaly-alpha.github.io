const { search } = require('duck-duck-scrape');
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

// ===== LRU cache =====
const cache = new Map(); // normalizedQuery → { results, cachedAt }
const CACHE_MAX = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS = 5;
const GOOGLE_CSE_URL = 'https://www.googleapis.com/customsearch/v1';
const DDG_THROTTLE_MS = 3000;
let lastDdgCall = 0;

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
  const now = Date.now();
  const elapsed = now - lastDdgCall;
  if (elapsed < DDG_THROTTLE_MS) {
    await new Promise(resolve => setTimeout(resolve, DDG_THROTTLE_MS - elapsed));
  }

  const result = await search(query, { safeSearch: -1 });
  lastDdgCall = Date.now();
  return (result.results || []).slice(0, MAX_RESULTS).map(r => ({
    title: r.title || '',
    snippet: r.description || '',
    url: r.url || '',
  }));
}

async function searchWikipedia(query) {
  const url = `${WIKIPEDIA_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=${MAX_RESULTS}&format=json`;
  const res = await fetch(url);
  const data = await res.json();

  // opensearch returns [query, [titles...], [descriptions...], [urls...]]
  if (!Array.isArray(data) || data.length < 4) return [];

  const titles = data[1] || [];
  const descriptions = data[2] || [];
  const urls = data[3] || [];

  return titles.map((title, i) => ({
    title,
    snippet: descriptions[i] || '',
    url: urls[i] || '',
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

  // Fresh search: Google CSE → DuckDuckGo → Wikipedia (reliable fallback)
  let results = null;
  let source = '';
  try { results = await searchGoogle(query); source = 'google'; } catch {}
  if (!results || results.length === 0) {
    try { results = await searchDuckDuckGo(query); source = 'duckduckgo'; } catch {}
  }
  if (!results || results.length === 0) {
    try { results = await searchWikipedia(query); source = 'wikipedia'; } catch {}
  }
  if (!results || results.length === 0) {
    return { results: [], source: 'error', error: 'All search backends failed' };
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
