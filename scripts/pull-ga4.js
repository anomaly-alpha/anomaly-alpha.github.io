// Pulls Google Analytics 4 data for the same reporting windows as pull-gsc.js.
//
// GSC reports clicks and impressions in Google, but cannot say whether those arrivals
// were real or bounced, how many sessions each user opened, or which acquisition channel
// they came from. GA4 answers those, so the two snapshots are read side by side.
//
// Auth is shared with pull-gsc.js via scripts/lib/google-auth.js, which accepts a
// service-account key only. This API is in fact why: the OAuth client behind user ADC is
// unverified, so Google refuses the sensitive analytics.readonly scope with "This app is
// blocked". The service account must be granted Viewer access on the property in GA4.

const fs = require('fs');
const path = require('path');
const auth = require('./lib/google-auth');

const API_BASE = 'https://analyticsdata.googleapis.com/v1beta/properties';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DEFAULT_PROPERTY = '541253821';
const ROW_LIMIT = 200000;
const CREDENTIAL_PATH = auth.resolveCredentialPath();

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

function gaDate(compact) {
  return compact.slice(0, 4) + '-' + compact.slice(4, 6) + '-' + compact.slice(6, 8);
}

// ===== Data API =====

async function runReport(token, propertyId, payload) {
  const res = await fetch(API_BASE + '/' + propertyId + ':runReport', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(Object.assign({ limit: ROW_LIMIT }, payload)),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ': ' + text.slice(0, 400));
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

// Flattens a GA4 report into the keys+metrics shape pull-gsc.js writes, so the two
// snapshot directories are read the same way.
function flatten(report) {
  const dimensions = (report.dimensionHeaders || []).map(h => h.name);
  const metrics = (report.metricHeaders || []).map(h => h.name);
  return (report.rows || []).map(row => {
    const out = {
      keys: row.dimensionValues.map(v => v.value),
      metrics: {},
    };
    metrics.forEach((name, i) => {
      out.metrics[name] = Number(row.metricValues[i].value);
    });
    return out;
  });
}

function totals(rows) {
  return rows.reduce((acc, row) => {
    Object.keys(row.metrics).forEach(name => {
      acc[name] = (acc[name] || 0) + row.metrics[name];
    });
    return acc;
  }, {});
}

// ===== Main =====

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const propertyId = String(args.property || process.env.GA4_PROPERTY || DEFAULT_PROPERTY).replace('properties/', '');
  if (!/^\d+$/.test(propertyId)) {
    throw new Error('Property must be the numeric GA4 property ID, not the measurement ID (G-XXXXXXX)');
  }

  const end = args.end || addDays(todayUtc(), -1);
  const start = args.start || addDays(end, -34);
  if (new Date(start) > new Date(end)) throw new Error('start must be before end');

  const outDir = args.out || path.join(__dirname, '..', 'data', 'ga4-api', todayUtc());
  fs.mkdirSync(outDir, { recursive: true });

  const credentialPath = args.key || CREDENTIAL_PATH;
  const credential = auth.loadCredential(credentialPath);

  console.log('Property:  ' + propertyId);
  console.log('Window:    ' + start + ' -> ' + end + ' (' + daysBetween(start, end) + ' days)');
  console.log('Output:    ' + outDir);
  console.log('');
  console.log('Credential: ' + path.basename(credentialPath) + ' (' + credential.client_email + ')');
  console.log('');

  const token = await auth.getAccessToken(credential, SCOPE);
  console.log('Access token acquired');
  console.log('');

  const range = [{ startDate: start, endDate: end }];
  const datasets = [];

  function writeJson(name, data) {
    fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  const plans = [
    {
      name: 'daily',
      label: 'date x channel',
      dimensions: ['date', 'sessionDefaultChannelGroup'],
      metrics: ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'engagedSessions', 'engagementRate', 'averageSessionDuration', 'bounceRate'],
    },
    {
      name: 'pages',
      label: 'date x pagePath',
      dimensions: ['date', 'pagePath'],
      metrics: ['sessions', 'screenPageViews', 'engagedSessions', 'engagementRate'],
    },
    {
      name: 'countries',
      label: 'country',
      dimensions: ['country'],
      metrics: ['sessions', 'totalUsers', 'engagedSessions'],
    },
    {
      name: 'events',
      label: 'eventName',
      dimensions: ['eventName'],
      metrics: ['eventCount', 'totalUsers'],
    },
  ];

  for (const plan of plans) {
    try {
      const report = await runReport(token, propertyId, {
        dateRanges: range,
        dimensions: plan.dimensions.map(name => ({ name })),
        metrics: plan.metrics.map(name => ({ name })),
      });
      const rows = flatten(report);
      writeJson(plan.name, rows);
      const days = plan.dimensions[0] === 'date'
        ? ', ' + new Set(rows.map(r => gaDate(r.keys[0]))).size + ' days'
        : '';
      console.log('  ' + plan.label.padEnd(24) + String(rows.length).padStart(7) + ' rows' + days);
      datasets.push({ name: plan.name, ok: true, rows: rows.length, dimensions: plan.dimensions, metrics: plan.metrics });
    } catch (err) {
      console.log('  ' + plan.label.padEnd(24) + ' FAILED: ' + err.message.slice(0, 120));
      datasets.push({ name: plan.name, ok: false, error: err.message.slice(0, 300), dimensions: plan.dimensions });
    }
  }

  const daily = datasets.find(d => d.name === 'daily');
  let summary = null;
  if (daily && daily.ok) {
    const rows = JSON.parse(fs.readFileSync(path.join(outDir, 'daily.json'), 'utf8'));
    const organic = rows.filter(r => r.keys[1] === 'Organic Search');
    const byDay = {};
    rows.forEach(row => {
      const day = gaDate(row.keys[0]);
      byDay[day] = byDay[day] || { sessions: 0, users: 0, engaged: 0 };
      byDay[day].sessions += row.metrics.sessions || 0;
      byDay[day].users += row.metrics.totalUsers || 0;
      byDay[day].engaged += row.metrics.engagedSessions || 0;
    });
    const organicTotals = totals(organic);
    const allTotals = totals(rows);
    summary = {
      property: propertyId,
      start,
      end,
      totals: allTotals,
      organic: organicTotals,
      organicShare: allTotals.sessions ? organicTotals.sessions / allTotals.sessions : null,
      engagementRate: allTotals.sessions ? allTotals.engagedSessions / allTotals.sessions : null,
      daily: byDay,
    };
    writeJson('summary', summary);

    console.log('');
    console.log('Organic Search sessions: ' + (organicTotals.sessions || 0) +
      ' of ' + (allTotals.sessions || 0) + ' total (' +
      (100 * (summary.organicShare || 0)).toFixed(1) + '%)');
    console.log('Engagement rate:         ' + (100 * (summary.engagementRate || 0)).toFixed(1) + '%');
  }

  writeJson('meta', {
    generatedAt: new Date().toISOString(),
    property: propertyId,
    credentialFile: path.basename(credentialPath),
    credentialType: credential.type || 'unknown',
    periods: { start, end, days: daysBetween(start, end) },
    datasets,
  });

  console.log('');
  console.log('Metadata: ' + path.join(outDir, 'meta.json'));
}

main().catch(err => {
  console.error('');
  console.error('FAILED: ' + err.message);
  process.exit(1);
});
