const { searchWeb } = require('../search/searchEngine');
const { db } = require('../../db/database');

const NEWS_QUERY = 'tech and gaming news today';
const MAX_ARTICLES = 10;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchNews() {
  try {
    const { results, source } = await searchWeb(NEWS_QUERY);
    console.log(`[News] Search returned ${results?.length || 0} results from ${source}`);
    if (!results || results.length === 0) return 0;

    const now = Date.now();
    let count = 0;
    for (const r of results.slice(0, MAX_ARTICLES)) {
      if (!r.title) continue;
      db.prepare(
        `INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(r.title, r.snippet || '', r.url || '', r.source || 'web', 'tech_gaming', now);
      count++;
    }

    // Prune old entries
    db.prepare('DELETE FROM daily_news WHERE fetched_at < ?').run(now - MAX_AGE_MS);

    return count;
  } catch (e) {
    console.log(`[News] Fetch failed: ${e.message}`);
    return 0;
  }
}

function getRecentNews(limit = 10) {
  return db.prepare(
    'SELECT * FROM daily_news ORDER BY fetched_at DESC LIMIT ?'
  ).all(limit);
}

module.exports = { fetchNews, getRecentNews };