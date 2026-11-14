// Run PageSpeed Insights audit for all 8 pages
// Usage: node scripts/run-psi-audit.js
//
// The API requires a key: the anonymous shared quota is exhausted most days and
// answers HTTP 429 "Quota exceeded ... Queries per day". The key is read from
// PSI_API_KEY, else from %APPDATA%\gcloud\psi-api-key.txt (or
// ~/.config/gcloud/psi-api-key.txt). It is never read from inside the repo and
// never committed — see the credential patterns in .gitignore.

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CATEGORIES = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'];

function loadApiKey() {
  if (process.env.PSI_API_KEY) return process.env.PSI_API_KEY.trim();
  const candidates = [
    process.env.APPDATA && path.join(process.env.APPDATA, 'gcloud', 'psi-api-key.txt'),
    path.join(os.homedir(), '.config', 'gcloud', 'psi-api-key.txt'),
  ].filter(Boolean);
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  }
  throw new Error(
    'No PageSpeed Insights API key. Set PSI_API_KEY, or write the key to ' +
    candidates.join(' or ') + '. Create one at https://console.cloud.google.com/apis/credentials'
  );
}

const pages = [
  { name: 'home', url: 'https://anomaly-alpha.github.io/' },
  { name: 'code', url: 'https://anomaly-alpha.github.io/guide/code/' },
  { name: 'event', url: 'https://anomaly-alpha.github.io/guide/event/' },
  { name: 'pvp', url: 'https://anomaly-alpha.github.io/guide/pvp/' },
  { name: 'login', url: 'https://anomaly-alpha.github.io/guide/login/' },
  { name: 'faq', url: 'https://anomaly-alpha.github.io/guide/faq/' },
  { name: 'beginners', url: 'https://anomaly-alpha.github.io/guide/beginners/' },
  { name: 'xp', url: 'https://anomaly-alpha.github.io/guide/xp/' },
];

function fetchPSI(page, apiKey) {
  return new Promise((resolve, reject) => {
    // URLSearchParams built from an object literal keeps only the last duplicate
    // key, so each category has to be appended or the response carries none of
    // the requested category blocks and every score read below is undefined.
    const params = new URLSearchParams({ url: page.url, strategy: 'mobile', key: apiKey });
    for (const category of CATEGORIES) params.append('category', category);
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`${page.name}: HTTP ${res.statusCode} — ${data.slice(0, 200)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const lh = json.lighthouseResult;
          const audits = lh.audits;
          const cats = lh.categories;
          resolve({
            name: page.name,
            url: page.url,
            scores: {
              performance: Math.round(cats.performance.score * 100),
              accessibility: Math.round(cats.accessibility.score * 100),
              'best-practices': Math.round(cats['best-practices'].score * 100),
              seo: Math.round(cats.seo.score * 100),
            },
            metrics: {
              lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
              tbt: audits['total-blocking-time']?.displayValue || 'N/A',
              cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
              fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
              si: audits['speed-index']?.displayValue || 'N/A',
            },
          });
        } catch (e) {
          reject(new Error(`${page.name}: Parse error — ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  let apiKey;
  try {
    apiKey = loadApiKey();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const results = [];
  for (const page of pages) {
    process.stdout.write(`Auditing ${page.name}... `);
    try {
      const result = await fetchPSI(page, apiKey);
      results.push(result);
      process.stdout.write(`Perf=${result.scores.performance} A11y=${result.scores.accessibility} SEO=${result.scores.seo}\n`);
    } catch (e) {
      console.error(`FAILED — ${e.message}`);
      // Don't push, continue
    }
    // Delay to avoid rate limiting
    if (page !== pages[pages.length - 1]) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Print summary table
  console.log('\n\n## PageSpeed Insights Report — ' + new Date().toISOString().slice(0, 10));
  console.log('| Page | Perf | A11y | BP | SEO | LCP | TBT | CLS | FCP | SI |');
  console.log('|------|------|------|-----|-----|-----|-----|-----|-----|-----|');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.scores.performance} | ${r.scores.accessibility} | ${r.scores['best-practices']} | ${r.scores.seo} | ${r.metrics.lcp} | ${r.metrics.tbt} | ${r.metrics.cls} | ${r.metrics.fcp} | ${r.metrics.si} |`);
  }

  // Print detailed issues
  console.log('\n## Issues Summary\n');
  for (const r of results) {
    const issues = [];
    if (r.scores.performance < 90) issues.push(`Performance ${r.scores.performance}`);
    if (r.scores.accessibility < 95) issues.push(`Accessibility ${r.scores.accessibility}`);
    if (r.scores.seo < 100) issues.push(`SEO ${r.scores.seo}`);
    if (r.scores['best-practices'] < 95) issues.push(`Best Practices ${r.scores['best-practices']}`);
    const metricFlags = [];
    if (r.metrics.cls !== 'N/A') {
      const clsVal = parseFloat(r.metrics.cls);
      if (clsVal > 0.25) metricFlags.push(`CLS=${r.metrics.cls} (FAIL)`);
      else if (clsVal > 0.1) metricFlags.push(`CLS=${r.metrics.cls} (WARN)`);
    }
    if (metricFlags.length || issues.length) {
      console.log(`**${r.name}** — ${issues.join(', ') || 'All scores OK'} ${metricFlags.join(', ')}`);
    }
  }

  // Save JSON
  fs.mkdirSync('./lighthouse-reports', { recursive: true });
  fs.writeFileSync('./lighthouse-reports/psi-summary.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to lighthouse-reports/psi-summary.json');
}

run().catch(console.error);
