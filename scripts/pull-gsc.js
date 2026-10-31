const fs = require('fs');
const path = require('path');

const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_SITE = 'https://anomaly-alpha.github.io/';
const ADC_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(process.env.HOME || '', '.config', 'gcloud', 'application_default_credentials.json');
const ROW_LIMIT = 25000;

// ===== CLI =====

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[arg.slice(2)] = next;
        i++;
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

// ===== Dates =====

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const ms = new Date(end + 'T00:00:00Z') - new Date(start + 'T00:00:00Z');
  return Math.round(ms / 86400000) + 1;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

// ===== Auth =====

function loadAdc(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('ADC file not found: ' + filePath + ' (run: gcloud auth application-default login --no-launch-browser)');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function getAccessToken(adc) {
  if (adc.type !== 'authorized_user' || !adc.refresh_token) {
    throw new Error('Unsupported ADC type: ' + (adc.type || 'unknown') + ' (expected authorized_user)');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: adc.client_id,
    client_secret: adc.client_secret,
    refresh_token: adc.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Token refresh failed: HTTP ' + res.status + ' ' + text.slice(0, 200));
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error('Token refresh returned no access_token');
  return json.access_token;
}

// ===== Search Analytics API =====

function authHeaders(token, quotaProject) {
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'x-goog-user-project': quotaProject,
  };
}

function queryUrl(site) {
  return API_BASE + '/' + encodeURIComponent(site) + '/searchAnalytics/query';
}

async function queryAll(token, site, quotaProject, payload) {
  const rows = [];
  let startRow = 0;
  let pages = 0;
  while (true) {
    const body = Object.assign({}, payload, { rowLimit: ROW_LIMIT, startRow });
    const res = await fetch(queryUrl(site), {
      method: 'POST',
      headers: authHeaders(token, quotaProject),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
      err.status = res.status;
      err.body = text;
      throw err;
    }
    const json = JSON.parse(text);
    const batch = json.rows || [];
    for (const row of batch) {
      rows.push({
        keys: row.keys,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      });
    }
    pages++;
    if (batch.length < ROW_LIMIT) break;
    startRow += ROW_LIMIT;
    if (pages >= 20) throw new Error('Pagination safety limit reached');
  }
  return rows;
}

// ===== Sitemaps API =====

function sitemapsUrl(site) {
  return API_BASE + '/' + encodeURIComponent(site) + '/sitemaps';
}

async function fetchSitemaps(token, quotaProject, site) {
  const res = await fetch(sitemapsUrl(site), { headers: authHeaders(token, quotaProject) });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
  return JSON.parse(text).sitemap || [];
}

// ===== URL Inspection API =====

const INSPECT_URL = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const INSPECT_LIMIT = 25;

function sitemapUrlsFromRepo() {
  const file = path.join(__dirname, '..', 'sitemap.xml');
  if (!fs.existsSync(file)) return [];
  return [...fs.readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

function richResultIssues(detectedItems) {
  return (detectedItems || []).flatMap(item =>
    (item.items || []).flatMap(entry => (entry.issues || []).map(issue => ({
      type: item.richResultType || null,
      message: issue.issueMessage || null,
      severity: issue.severity || null,
    })))
  );
}

async function inspectUrl(token, quotaProject, site, inspectionUrl) {
  const res = await fetch(INSPECT_URL, {
    method: 'POST',
    headers: authHeaders(token, quotaProject),
    body: JSON.stringify({ inspectionUrl, siteUrl: site, languageCode: 'en-US' }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
  const result = JSON.parse(text).inspectionResult || {};
  const index = result.indexStatusResult || {};
  const mobile = result.mobileUsabilityResult || {};
  const rich = result.richResultsResult || {};
  const issues = richResultIssues(rich.detectedItems);
  return {
    url: inspectionUrl,
    verdict: index.verdict || null,
    coverageState: index.coverageState || null,
    robotsTxtState: index.robotsTxtState || null,
    indexingState: index.indexingState || null,
    pageFetchState: index.pageFetchState || null,
    lastCrawlTime: index.lastCrawlTime || null,
    crawledAs: index.crawledAs || null,
    googleCanonical: index.googleCanonical || null,
    userCanonical: index.userCanonical || null,
    canonicalMatches: !index.googleCanonical || !index.userCanonical || index.googleCanonical === index.userCanonical,
    referringUrls: index.referringUrls || [],
    sitemaps: index.sitemaps || [],
    mobileUsabilityVerdict: mobile.verdict || null,
    richResultsVerdict: rich.verdict || null,
    richResultTypes: (rich.detectedItems || []).map(item => item.richResultType).filter(Boolean),
    richResultIssues: issues,
    richResultErrors: issues.filter(issue => issue.severity === 'ERROR').length,
  };
}

// ===== Aggregation =====

function totals(rows) {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0,
    position: impressions > 0 ? +(weightedPosition / impressions).toFixed(2) : 0,
    rows: rows.length,
  };
}

function deltaPct(current, previous) {
  if (!previous) return null;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

// ===== Main =====

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const site = args.site || DEFAULT_SITE;
  const quotaProject = args['quota-project'] || loadAdc(args.adc || ADC_PATH).quota_project_id;
  if (!quotaProject) throw new Error('No quota project in ADC; pass --quota-project');

  const end = args.end || addDays(todayUtc(), -2);
  const start = args.start || addDays(end, -180);
  const currentStart = addDays(end, -27);
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -27);

  if (new Date(start) > new Date(end)) throw new Error('start must be before end');

  const outDir = args.out || path.join(__dirname, '..', 'data', 'gsc-api', todayUtc());
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Site:     ' + site);
  console.log('Full:     ' + start + ' -> ' + end + ' (' + daysBetween(start, end) + ' days)');
  console.log('Current:  ' + currentStart + ' -> ' + end);
  console.log('Previous: ' + previousStart + ' -> ' + previousEnd);
  console.log('Output:   ' + outDir);
  console.log('');

  const adc = loadAdc(args.adc || ADC_PATH);
  const token = await getAccessToken(adc);
  console.log('Access token acquired from ADC');
  console.log('');

  function writeJson(name, data) {
    fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  async function pull(name, dimensions, startDate, endDate, extra) {
    process.stdout.write('  ' + name.padEnd(30) + ' ');
    try {
      const payload = Object.assign({
        startDate,
        endDate,
        dimensions,
        type: 'web',
        dataState: 'all',
      }, extra || {});
      const rows = await queryAll(token, site, quotaProject, payload);
      writeJson(name, rows);
      console.log(String(rows.length).padStart(6) + ' rows');
      return { name, ok: true, rows: rows.length, startDate, endDate, dimensions, type: payload.type };
    } catch (err) {
      console.log('FAILED: ' + err.message);
      writeJson(name, { error: err.message, status: err.status || null });
      return { name, ok: false, error: err.message, startDate, endDate, dimensions, type: (extra && extra.type) || 'web' };
    }
  }

  const datasets = [];
  datasets.push(await pull('daily-full', ['date'], start, end));
  datasets.push(await pull('queries-current', ['query'], currentStart, end));
  datasets.push(await pull('queries-previous', ['query'], previousStart, previousEnd));
  datasets.push(await pull('queries-full', ['query'], start, end));
  datasets.push(await pull('pages-current', ['page'], currentStart, end));
  datasets.push(await pull('pages-previous', ['page'], previousStart, previousEnd));
  datasets.push(await pull('pages-full', ['page'], start, end));
  datasets.push(await pull('countries-current', ['country'], currentStart, end));
  datasets.push(await pull('countries-previous', ['country'], previousStart, previousEnd));
  datasets.push(await pull('countries-full', ['country'], start, end));
  datasets.push(await pull('devices-current', ['device'], currentStart, end));
  datasets.push(await pull('devices-previous', ['device'], previousStart, previousEnd));
  datasets.push(await pull('devices-full', ['device'], start, end));
  datasets.push(await pull('query-pages-current', ['query', 'page'], currentStart, end));
  datasets.push(await pull('query-pages-previous', ['query', 'page'], previousStart, previousEnd));
  datasets.push(await pull('search-appearance-current', ['searchAppearance'], currentStart, end));
  datasets.push(await pull('search-appearance-full', ['searchAppearance'], start, end));
  datasets.push(await pull('discover-daily-full', ['date'], start, end, { type: 'discover' }));
  datasets.push(await pull('image-daily-full', ['date'], start, end, { type: 'image' }));

  process.stdout.write('  ' + 'sitemaps'.padEnd(30) + ' ');
  let sitemaps = [];
  let sitemapsOk = true;
  try {
    sitemaps = await fetchSitemaps(token, quotaProject, site);
    writeJson('sitemaps', sitemaps);
    console.log(sitemaps.length ? String(sitemaps.length).padStart(6) + ' registered' : 'none registered');
  } catch (err) {
    sitemapsOk = false;
    console.log('FAILED: ' + err.message);
    writeJson('sitemaps', { error: err.message });
  }
  datasets.push({
    name: 'sitemaps',
    ok: sitemapsOk,
    kind: 'sitemap-status',
    count: sitemaps.length,
    errors: sitemaps.reduce((sum, s) => sum + Number(s.errors || 0), 0),
    warnings: sitemaps.reduce((sum, s) => sum + Number(s.warnings || 0), 0),
  });

  let inspections = [];
  if (args['skip-inspection']) {
    console.log('  ' + 'url-inspection'.padEnd(30) + ' skipped (--skip-inspection)');
  } else {
    const limit = Number(args['inspect-limit'] || INSPECT_LIMIT);
    const targets = [...new Set([site, ...sitemapUrlsFromRepo()])].slice(0, limit);
    console.log('  ' + 'url-inspection'.padEnd(30) + String(targets.length).padStart(6) + ' urls');
    for (const target of targets) {
      try {
        const row = await inspectUrl(token, quotaProject, site, target);
        inspections.push(row);
        console.log('    ' + String(row.verdict || '?').padEnd(13) + (row.coverageState || '').padEnd(30) +
          target.replace(site, '/').padEnd(26) + (row.canonicalMatches ? '' : 'CANONICAL MISMATCH'));
      } catch (err) {
        inspections.push({ url: target, error: err.message });
        console.log('    ' + 'FAILED'.padEnd(13) + target.replace(site, '/') + '  ' + err.message.slice(0, 80));
      }
    }
    writeJson('url-inspection', inspections);
    datasets.push({
      name: 'url-inspection',
      ok: inspections.every(row => !row.error),
      kind: 'url-inspection',
      count: inspections.length,
      failures: inspections.filter(row => row.error).length,
      verdicts: inspections.reduce((counts, row) => {
        const key = row.verdict || 'UNKNOWN';
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
      canonicalMismatches: inspections.filter(row => row.canonicalMatches === false).map(row => row.url),
      richResultErrors: inspections.reduce((sum, row) => sum + (row.richResultErrors || 0), 0),
    });
  }

  const daily = datasets.find(d => d.name === 'daily-full');
  let summary = null;
  if (daily && daily.ok) {
    const rows = JSON.parse(fs.readFileSync(path.join(outDir, 'daily-full.json'), 'utf8'));
    const full = totals(rows);
    const current = totals(rows.filter(r => r.keys[0] >= currentStart && r.keys[0] <= end));
    const previous = totals(rows.filter(r => r.keys[0] >= previousStart && r.keys[0] <= previousEnd));
    summary = {
      site,
      quotaProject,
      generatedAt: new Date().toISOString(),
      periods: {
        full: { start, end, days: daysBetween(start, end) },
        current: { start: currentStart, end, days: 28 },
        previous: { start: previousStart, end: previousEnd, days: 28 },
      },
      totals: { full, current, previous },
      change: {
        clicksPct: deltaPct(current.clicks, previous.clicks),
        impressionsPct: deltaPct(current.impressions, previous.impressions),
        ctrPct: previous.ctr ? +(current.ctr - previous.ctr).toFixed(2) : null,
        positionDelta: previous.position ? +(current.position - previous.position).toFixed(2) : null,
      },
      datasets,
      firstDate: rows.length ? rows[0].keys[0] : null,
      lastDate: rows.length ? rows[rows.length - 1].keys[0] : null,
      note: 'Search Analytics API (web type unless named otherwise). Queries are anonymized in aggregate; row sums may be below daily totals.',
    };
    writeJson('summary', summary);
  }

  console.log('');
  if (summary) {
    const t = summary.totals;
    console.log('Totals (daily-full):');
    console.log('  Full:     ' + t.full.clicks + ' clicks / ' + t.full.impressions + ' impressions / ' + t.full.ctr + '% CTR / pos ' + t.full.position);
    console.log('  Current:  ' + t.current.clicks + ' clicks / ' + t.current.impressions + ' impressions / ' + t.current.ctr + '% CTR / pos ' + t.current.position);
    console.log('  Previous: ' + t.previous.clicks + ' clicks / ' + t.previous.impressions + ' impressions / ' + t.previous.ctr + '% CTR / pos ' + t.previous.position);
    console.log('  Change:   ' + summary.change.clicksPct + '% clicks, ' + summary.change.impressionsPct + '% impressions, ' + summary.change.ctrPct + 'pp CTR, ' + summary.change.positionDelta + ' position');
    console.log('');
  }
  const unhealthy = inspections.filter(row => !row.error && (row.verdict !== 'PASS' || row.canonicalMatches === false));
  console.log('Index checks:');
  console.log('  Sitemaps:  ' + (sitemapsOk
    ? (sitemaps.length ? sitemaps.map(s => s.path).join(', ') : 'none registered (submit in Search Console UI; API PUT needs the webmasters write scope)')
    : 'FAILED'));
  console.log('  Inspected: ' + inspections.length + ' urls, ' + unhealthy.length + ' not healthy, ' +
    inspections.filter(row => row.canonicalMatches === false).length + ' canonical mismatches');
  const failed = datasets.filter(d => !d.ok);
  console.log('Metadata: ' + path.join(outDir, 'meta.json'));
  if (failed.length) console.log('Warnings: ' + failed.map(f => f.name).join(', '));
  writeJson('meta', {
    generatedAt: new Date().toISOString(),
    site,
    quotaProject,
    adc: args.adc || ADC_PATH,
    periods: {
      full: { start, end },
      current: { start: currentStart, end },
      previous: { start: previousStart, end: previousEnd },
    },
    datasets,
  });
}

main().catch(err => {
  console.error('Error: ' + err.message);
  process.exit(1);
});
