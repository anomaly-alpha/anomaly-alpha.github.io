// ===== News Fetcher =====
// RSS+Atom headline cache fed by 38 curated sources across 5 categories.
// Scheduler-populated every 15 min; readers query daily_news by category.
// Per-feed isolation: one dead/blocked feed costs only that feed. (spec [S3]/[S8])

const { db } = require('../../db/database');

const MAX_ARTICLES = 200;
const MAX_PER_CATEGORY = Math.floor(MAX_ARTICLES / 5); // 40 — every category survives the total cap
const MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72h by published_at
const FEED_TIMEOUT_MS = 8000;
const FETCH_UA = 'SkarnBot/1.0 (news-fetch)';

// 38 validated sources, tested live 2026-08-02 (HTTP 200, real items, pubDate).
// Single source of truth for feeds. (spec [S4])
const FEEDS = [
  // tech (11)
  { category: 'tech', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { category: 'tech', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { category: 'tech', name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { category: 'tech', name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { category: 'tech', name: 'Lifehacker', url: 'https://lifehacker.com/rss' },
  { category: 'tech', name: 'MacRumors', url: 'https://www.macrumors.com/macrumors.xml' },
  { category: 'tech', name: 'Gizmodo', url: 'https://www.gizmodo.com/rss' },
  { category: 'tech', name: '9to5Mac', url: 'https://9to5mac.com/feed/' },
  { category: 'tech', name: 'Android Authority', url: 'https://www.androidauthority.com/feed/' },
  { category: 'tech', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }, // Atom
  { category: 'tech', name: 'CNET', url: 'https://www.cnet.com/rss/news/' }, // Atom
  // gaming (6)
  { category: 'gaming', name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed' },
  { category: 'gaming', name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },
  { category: 'gaming', name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
  { category: 'gaming', name: 'Eurogamer', url: 'https://www.eurogamer.net/feed' },
  { category: 'gaming', name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/' },
  { category: 'gaming', name: 'Kotaku', url: 'https://kotaku.com/rss' },
  // world (9)
  { category: 'world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'world', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { category: 'world', name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { category: 'world', name: 'Guardian World', url: 'https://feeds.guardian.co.uk/theguardian/world/rss' },
  { category: 'world', name: 'CBS World', url: 'https://www.cbsnews.com/latest/rss/world' },
  { category: 'world', name: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' },
  { category: 'world', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { category: 'world', name: 'SCMP', url: 'https://www.scmp.com/rss/91/feed' },
  { category: 'world', name: 'France 24', url: 'https://www.france24.com/en/rss' },
  // science (7)
  { category: 'science', name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/all.xml' },
  { category: 'science', name: 'Phys.org', url: 'https://phys.org/rss-feed/' },
  { category: 'science', name: 'NASA', url: 'https://www.nasa.gov/feed/' },
  { category: 'science', name: 'Space.com', url: 'https://www.space.com/feeds/all' },
  { category: 'science', name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/' },
  { category: 'science', name: 'Science News', url: 'https://www.sciencenews.org/feed' },
  { category: 'science', name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/' },
  // business (5)
  { category: 'business', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { category: 'business', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { category: 'business', name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { category: 'business', name: 'Forbes Innovation', url: 'https://www.forbes.com/innovation/feed/' },
  { category: 'business', name: 'Forbes Business', url: 'https://www.forbes.com/business/feed/' },
];

const CATEGORIES = [...new Set(FEEDS.map(function(f) { return f.category; }))];

// ===== Parsing (RSS <item> + Atom <entry>, spec [S5.2]/[S11] Formats) =====

function tagContent(block, tag) {
  var m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function parseRSSItem(block) {
  var title = tagContent(block, 'title');
  var link = tagContent(block, 'link');
  var desc = stripHtml(tagContent(block, 'description'));
  var pub = Date.parse(tagContent(block, 'pubDate'));
  if (!title || !link) return null;
  return { title: title, snippet: desc.slice(0, 200), url: link, publishedAt: isNaN(pub) ? Date.now() : pub };
}

function parseAtomEntry(block) {
  var title = tagContent(block, 'title');
  var linkM = block.match(/<link[^>]*href="([^"]+)"/i);
  var summary = stripHtml(tagContent(block, 'summary') || tagContent(block, 'content'));
  var pub = Date.parse(tagContent(block, 'published') || tagContent(block, 'updated'));
  if (!title || !linkM) return null;
  return { title: title, snippet: summary.slice(0, 200), url: linkM[1], publishedAt: isNaN(pub) ? Date.now() : pub };
}

function parseFeed(xml) {
  if (/<item[\s>]/i.test(xml)) {
    var items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    return items.map(parseRSSItem).filter(Boolean);
  }
  if (/<entry[\s>]/i.test(xml)) {
    var entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    return entries.map(parseAtomEntry).filter(Boolean);
  }
  return [];
}

async function fetchFeed(feed) {
  var res = await fetch(feed.url, {
    headers: { 'User-Agent': FETCH_UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(feed.url + ' -> ' + res.status);
  var xml = await res.text();
  var parsed = parseFeed(xml);
  return parsed.map(function(item) {
    return { category: feed.category, source: feed.name, title: item.title, snippet: item.snippet, url: item.url, publishedAt: item.publishedAt };
  });
}

// ===== Dedupe (URL wins, then normalized title-60 — grill Q4) =====

function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
}

// ===== Fetch + store =====

async function fetchNews(category) {
  var feeds = category ? FEEDS.filter(function(f) { return f.category === category; }) : FEEDS;

  // Parallel per-feed fetch with per-feed isolation (spec [S8])
  var batches = await Promise.all(feeds.map(async function(feed) {
    try {
      return await fetchFeed(feed);
    } catch (e) {
      console.log('[News] Feed failed (' + feed.name + '): ' + e.message);
      return [];
    }
  }));
  var items = batches.reduce(function(a, b) { return a.concat(b); }, []);

  // Dedupe: exact URL wins, then normalized-title-60 (grill Q4)
  var seenUrl = new Set();
  var seenTitle = new Set();
  var unique = [];
  for (var item of items) {
    if (!item.title || !item.url) continue;
    if (seenUrl.has(item.url)) continue;
    var nt = normalizeTitle(item.title);
    if (nt && seenTitle.has(nt)) continue; // non-Latin titles normalize to '' -> URL-only dedupe
    seenUrl.add(item.url);
    if (nt) seenTitle.add(nt);
    unique.push(item);
  }

  if (unique.length === 0) return 0;

  // Upsert + prune (spec [S5.4-5]). Per-category cap so the total 200-article
  // cap cannot starve any category (tech-first registry order would otherwise
  // fill the cap entirely within the tech block — spec [S1] criterion 3).
  var now = Date.now();
  var count = 0;
  var byCat = {};
  for (var item of unique) {
    (byCat[item.category] = byCat[item.category] || []).push(item);
  }
  var capped = [];
  for (var cat of Object.keys(byCat)) {
    byCat[cat].sort(function(a, b) { return b.publishedAt - a.publishedAt; });
    capped = capped.concat(byCat[cat].slice(0, MAX_PER_CATEGORY));
  }
  var upsert = db.transaction(function() {
    for (var item of capped) {
      var existing = db.prepare('SELECT id FROM daily_news WHERE url = ?').get(item.url);
      if (existing) {
        db.prepare('UPDATE daily_news SET headline = ?, snippet = ?, source = ?, category = ?, published_at = ? WHERE id = ?')
          .run(item.title, item.snippet, item.source, item.category, item.publishedAt, existing.id);
      } else {
        db.prepare('INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(item.title, item.snippet, item.url, item.source, item.category, now, item.publishedAt);
      }
      count++;
    }
    db.prepare('DELETE FROM daily_news WHERE published_at < ?').run(now - MAX_AGE_MS);
  });
  upsert();

  return count;
}

function getRecentNews(limit = 10, category) {
  if (category) {
    return db.prepare('SELECT * FROM daily_news WHERE category = ? ORDER BY published_at DESC LIMIT ?').all(category, limit);
  }
  return db.prepare('SELECT * FROM daily_news ORDER BY published_at DESC LIMIT ?').all(limit);
}

module.exports = { fetchNews, getRecentNews, FEEDS, CATEGORIES };
