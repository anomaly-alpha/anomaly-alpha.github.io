const { searchWeb } = require('../search/searchEngine');
const { db } = require('../../db/database');
const fetch = require('node-fetch');

const NEWS_QUERY = 'tech and gaming news today';
const MAX_ARTICLES = 10;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// RSS feeds as fallback when search engines fail (no API key needed)
const RSS_FEEDS = [
  'https://hnrss.org/frontpage',
  'https://www.theverge.com/rss/index.xml',
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://www.rockpapershotgun.com/feed',
];

function parseRSSItems(xml) {
  var items = [];
  // Match each <item>...</item> block
  var itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  var match;
  while ((match = itemRegex.exec(xml)) !== null) {
    var block = match[1];
    var title = (block.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/i) || block.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1];
    var desc = (block.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>/i) || block.match(/<description[^>]*>(.*?)<\/description>/i) || [])[1];
    var link = (block.match(/<link[^>]*>(.*?)<\/link>/i) || [])[1];
    if (title && link) {
      // Strip HTML from description
      if (desc) desc = desc.replace(/<[^>]+>/g, '').replace(/\\["']/g, '').trim();
      items.push({ title: title, snippet: (desc || '').slice(0, 200), url: link });
    }
  }
  return items;
}

async function fetchRSS() {
  var allItems = [];
  for (var url of RSS_FEEDS) {
    try {
      var res = await fetch(url, { headers: { 'User-Agent': 'SkarnBot/1.0' }, timeout: 8000 });
      if (!res.ok) continue;
      var xml = await res.text();
      var items = parseRSSItems(xml);
      allItems = allItems.concat(items);
    } catch (e) {
      // feed failed, try next
    }
  }
  // Deduplicate by title similarity
  var seen = new Set();
  var unique = [];
  for (var item of allItems) {
    var key = item.title.toLowerCase().slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

async function fetchNews() {
  var results = [];
  var source = '';

  // Try search engine first (Google CSE → DDG → Wikipedia)
  try {
    var searchResult = await searchWeb(NEWS_QUERY);
    if (searchResult.results && searchResult.results.length > 0) {
      results = searchResult.results;
      source = searchResult.source;
    }
  } catch (e) {
    console.log(`[News] Search failed: ${e.message}`);
  }

  // Fallback to RSS feeds if search returned nothing
  if (results.length === 0) {
    try {
      results = await fetchRSS();
      source = 'rss';
      console.log(`[News] RSS fallback: ${results.length} articles`);
    } catch (e) {
      console.log(`[News] RSS fallback failed: ${e.message}`);
    }
  }

  if (results.length === 0) {
    console.log('[News] No articles from any source');
    return 0;
  }

  const now = Date.now();
  let count = 0;
  for (const r of results.slice(0, MAX_ARTICLES)) {
    if (!r.title) continue;
    db.prepare(
      `INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(r.title, r.snippet || '', r.url || '', r.source || source, 'tech_gaming', now);
    count++;
  }

  // Prune old entries
  db.prepare('DELETE FROM daily_news WHERE fetched_at < ?').run(now - MAX_AGE_MS);

  return count;
}

function getRecentNews(limit = 10) {
  return db.prepare(
    'SELECT * FROM daily_news ORDER BY fetched_at DESC LIMIT ?'
  ).all(limit);
}

module.exports = { fetchNews, getRecentNews };
