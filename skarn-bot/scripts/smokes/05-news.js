// ===== NEWS =====
// Ported from README.md — news fetcher (offline; fetch stubbed, temp DB):
// parsing, dedupe, categories.
require('../../db/database');
const nf = require('../../features/news/newsFetcher');
// Fixture pubDate must be "now" — the cache prunes >72h-old articles, so the
// README's anchored date (Sat, 02 Aug 2026) would be pruned on later runs.
const pubDate = new Date().toUTCString();
global.fetch = async () => ({ ok: true, text: async () => '<rss><channel><item><title>Alpha</title><link>https://a.com/1</link><description>d</description><pubDate>' + pubDate + '</pubDate></item><item><title>Alpha</title><link>https://a.com/1</link><description>dup</description><pubDate>' + pubDate + '</pubDate></item></channel></rss>' });
(async () => {
  const count = await nf.fetchNews('tech');
  const rows = nf.getRecentNews(10, 'tech');
  const ok = count === 1 && rows.length === 1 && rows[0].headline === 'Alpha';
  console.log('news parses + dedupes:', ok);
  if (!ok) process.exitCode = 1;
})();