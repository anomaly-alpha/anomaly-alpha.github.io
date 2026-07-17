# GSC Analyzer Script + SEO Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js script that reads GSC CSV exports, generates an updated SEO performance report, and produces dashboard data — plus a `/seo/` dashboard page with Chart.js charts.

**Architecture:** A pure-Node.js script (`scripts/analyze-gsc.js`) with no external dependencies. It discovers export folders, parses CSVs, computes metrics, cross-references existing issues, and writes both the Markdown report and dashboard JS data file. The dashboard page loads the generated data + Chart.js and renders inline.

**Tech Stack:** Node.js (no deps — same pattern as `gen-serp-dumps.js`), Chart.js (self-hosted vendor lib), vanilla JS for dashboard rendering.

## Global Constraints

- No external npm dependencies — use only Node.js built-ins (fs, path)
- Follow the pattern of existing scripts: `scripts/gen-serp-dumps.js`, `scripts/generate-codes.js`
- All date parsing must handle both export folder naming conventions (see spec S9)
- Dashboard page must be `noindex, nofollow`
- Dashboard data file uses `window.__SEO_DATA = {...}` pattern (like `promo-codes.js`)
- Never use `fetch()` — all data is inline or pre-generated
- Relative paths for `file://` support

---

### Task 1: Export discovery + CSV parsing

**Covers:** [S4, S9]

**Files:**
- Create: `scripts/analyze-gsc.js`
- Read-reference: `scripts/gen-serp-dumps.js` (for script pattern)

**Interfaces:**
- Consumes: GSC export folders at `data/https___anomaly-alpha*`
- Produces: structured objects for each export: `{ chart: [rows], pages: [rows], queries: [rows], devices: [rows], countries: [rows], searchAppearance: [rows] }`

- [ ] **Step 1: Create script skeleton with export folder discovery**

```js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'docs', 'reports', 'SEO_PERFORMANCE.md');
const DASHBOARD_DATA_PATH = path.join(__dirname, '..', 'data', 'generated', 'seo-data.js');
const OLD_NAMING = /^https___anomaly-alpha-(\d{4})$/;           // e.g. https___anomaly-alpha-0704
const NEW_NAMING = /^https___anomaly-alpha\.github\.io_-Performance-on-Search-(\d{4}-\d{2}-\d{2})$/;

function parseExportDate(folderName) {
  let m = folderName.match(OLD_NAMING);
  if (m) {
    // Old format: MMDD, assume current year (2026)
    const month = parseInt(m[1].slice(0, 2), 10);
    const day = parseInt(m[1].slice(2, 4), 10);
    return new Date(2026, month - 1, day);
  }
  m = folderName.match(NEW_NAMING);
  if (m) return new Date(m[1]);
  return null;
}

function discoverExports() {
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const exports = entries
    .filter(e => e.isDirectory() && (OLD_NAMING.test(e.name) || NEW_NAMING.test(e.name)))
    .map(e => ({ name: e.name, date: parseExportDate(e.name), path: path.join(DATA_DIR, e.name) }))
    .filter(e => e.date !== null)
    .sort((a, b) => b.date - a.date);  // newest first
  return exports;
}

// Test
console.log('Discovering exports...');
const exportsList = discoverExports();
if (exportsList.length === 0) {
  console.log('No GSC exports found in data/');
  process.exit(0);
}
console.log(`Found ${exportsList.length} exports. Newest: ${exportsList[0].name}`);
```

- [ ] **Step 2: Add CSV parsing function**

```js
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.length <= 1) return []; // header only → no data
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      let val = (values[i] || '').trim();
      // Parse numeric values (remove % for CTR)
      if (val.endsWith('%')) {
        row[h.trim()] = parseFloat(val) || 0;
        row[h.trim() + '_raw'] = val; // preserve original
      } else if (!isNaN(val) && val !== '') {
        row[h.trim()] = parseFloat(val);
      } else {
        row[h.trim()] = val;
      }
    });
    return row;
  });
}

function loadExport(exportPath) {
  return {
    chart: parseCSV(path.join(exportPath, 'Chart.csv')),
    pages: parseCSV(path.join(exportPath, 'Pages.csv')),
    queries: parseCSV(path.join(exportPath, 'Queries.csv')),
    devices: parseCSV(path.join(exportPath, 'Devices.csv')),
    countries: parseCSV(path.join(exportPath, 'Countries.csv')),
    searchAppearance: parseCSV(path.join(exportPath, 'Search appearance.csv')),
  };
}
```

- [ ] **Step 3: Verify script runs and finds exports**

Run: `node scripts/analyze-gsc.js`
Expected: "Found 6 exports. Newest: https___anomaly-alpha.github.io_-Performance-on-Search-2026-07-17"

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-gsc.js
git commit -m "feat: add GSC export discovery and CSV parsing"
```

---

### Task 2: Metric computation

**Covers:** [S4] (Step 3 metric computation)

**Files:**
- Modify: `scripts/analyze-gsc.js`

**Interfaces:**
- Consumes: parsed export objects from Task 1
- Produces: computed metrics objects used by Task 3 & 4

- [ ] **Step 1: Add metric computation functions**

```js
function computeMetrics(exp) {
  const chart = exp.chart;
  if (chart.length === 0) return null;

  const totalClicks = chart.reduce((s, r) => s + (r.Clicks || 0), 0);
  const totalImpressions = chart.reduce((s, r) => s + (r.Impressions || 0), 0);
  const avgPosition = chart.reduce((s, r) => s + (r.Position || 0), 0) / chart.length;
  const dates = chart.map(r => r.Date).filter(Boolean).sort();
  const period = { start: dates[0], end: dates[dates.length - 1] };
  const days = (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (1000 * 60 * 60 * 24) + 1;

  // Weekly averages
  const weeklyAverages = [];
  let weekStart = 0;
  while (weekStart < chart.length) {
    const week = chart.slice(weekStart, weekStart + 7);
    const wClicks = week.reduce((s, r) => s + (r.Clicks || 0), 0);
    const wImps = week.reduce((s, r) => s + (r.Impressions || 0), 0);
    const wPos = week.reduce((s, r) => s + (r.Position || 0), 0) / week.length;
    weeklyAverages.push({
      week: week[0] ? week[0].Date : '?',
      avgClicks: +(wClicks / week.length).toFixed(1),
      avgImpressions: +(wImps / week.length).toFixed(1),
      ctr: wImps > 0 ? +(wClicks / wImps * 100).toFixed(2) : 0,
      avgPosition: +wPos.toFixed(1),
    });
    weekStart += 7;
  }

  return {
    totalClicks,
    totalImpressions,
    ctr: totalImpressions > 0 ? +(totalClicks / totalImpressions * 100).toFixed(2) : 0,
    avgPosition: +avgPosition.toFixed(1),
    period,
    days: Math.round(days),
    perDayClicks: +(totalClicks / days).toFixed(1),
    perDayImpressions: +(totalImpressions / days).toFixed(1),
    weeklyAverages,
  };
}

function computePageMetrics(pages) {
  const total = pages.reduce((s, r) => s + (r.Clicks || 0), 0);
  return pages.map(p => ({
    url: (p['Top pages'] || p['Page'] || '?').replace('https://anomaly-alpha.github.io', ''),
    clicks: p.Clicks || 0,
    impressions: p.Impressions || 0,
    ctr: p.CTR || 0,
    position: p.Position || 0,
    share: total > 0 ? +((p.Clicks || 0) / total * 100).toFixed(1) : 0,
  }));
}

function computeCTRLeaks(queries, minImpressions = 5) {
  return queries
    .filter(q => (q.Clicks || 0) === 0 && (q.Impressions || 0) >= minImpressions && (q.Position || 99) < 12)
    .map(q => {
      const pos = q.Position || 99;
      const imps = q.Impressions || 0;
      const score = imps * (11 - Math.min(pos, 10));
      let severity = 'LOW';
      if (score >= 150) severity = 'CRITICAL';
      else if (score >= 80) severity = 'HIGH';
      else if (score >= 30) severity = 'MEDIUM';
      return {
        query: q['Top queries'] || q['Query'] || '?',
        impressions: imps,
        clicks: 0,
        position: pos,
        score,
        severity,
      };
    })
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 2: Integrate into main flow and test**

After the export discovery + loading code, add:
```js
const newest = exportsList[0];
const newestData = loadExport(newest.path);
const newestMetrics = computeMetrics(newestData);

console.log(`Newest export (${newest.name}):`);
console.log(`  Period: ${newestMetrics.period.start} → ${newestMetrics.period.end} (${newestMetrics.days} days)`);
console.log(`  Clicks: ${newestMetrics.totalClicks} (${newestMetrics.perDayClicks}/day)`);
console.log(`  Impressions: ${newestMetrics.totalImpressions} (${newestMetrics.perDayImpressions}/day)`);
console.log(`  CTR: ${newestMetrics.ctr}%`);
console.log(`  Avg Position: ${newestMetrics.avgPosition}`);

const pageMetrics = computePageMetrics(newestData.pages);
console.log(`\nTop page: ${pageMetrics[0].url} — ${pageMetrics[0].clicks} clicks (${pageMetrics[0].share}%)`);

const leaks = computeCTRLeaks(newestData.queries);
console.log(`\nCTR Leaks found: ${leaks.length}`);
if (leaks.length > 0) {
  console.log(`  Worst: "${leaks[0].query}" — ${leaks[0].impressions} imp at pos ${leaks[0].position} (${leaks[0].severity})`);
}
```

- [ ] **Step 3: Run and verify output**

Run: `node scripts/analyze-gsc.js`
Expected: Metrics printed to console, matching the known values from the export.

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-gsc.js
git commit -m "feat: add GSC metric computation (totals, pages, CTR leaks)"
```

---

### Task 3: Issue lifecycle + full report generation

**Covers:** [S4] (Steps 4-5), [S10]

**Files:**
- Modify: `scripts/analyze-gsc.js`

**Interfaces:**
- Consumes: computed metrics + existing SEO_PERFORMANCE.md
- Produces: updated `docs/reports/SEO_PERFORMANCE.md`

- [ ] **Step 1: Add report parsing for existing issues**

```js
function parseExistingIssues(reportPath) {
  if (!fs.existsSync(reportPath)) return { issues: [], improved: [], actions: [], comparisons: [] };
  const text = fs.readFileSync(reportPath, 'utf8');
  
  // Extract open issues from "### Open Issues" table
  const issues = [];
  const issueRegex = /\| (\d+) \| \*\*"(.+?)"\*\*.*?(\d+) imp.*?(\d+) clicks.*?\| (.+?) \| (\w+) \| (\d{4}-\d{2}-\d{2} \|)/g;
  let m;
  while ((m = issueRegex.exec(text)) !== null) {
    issues.push({
      id: parseInt(m[1], 10),
      query: m[2],
      // We'll update impressions/clicks from current data
      severity: m[6],
      firstSeen: m[7].replace(' |', '').trim(),
    });
  }

  // Extract actions taken bullets
  const actions = [];
  const actionRegex = /^- \*\*.+?\*\* — .+$/gm;
  while ((m = actionRegex.exec(text)) !== null) {
    actions.push(m[0]);
  }

  return { issues, actions };
}
```

- [ ] **Step 2: Add report writer**

```js
function generateReport(newest, previous, newestData, previousData, newestMetrics, previousMetrics, existing) {
  const lines = [];
  
  // Header
  lines.push('# SEO Performance Report\n');
  lines.push(`**Generated:** ${newestMetrics.period.end}\n`);
  lines.push('---\n');

  // S1: Quick Summary
  lines.push('## Quick Summary\n');
  lines.push('| Metric | Current | Previous | Raw Δ | Per-Day Δ |');
  lines.push('|--------|---------|---------|-------|-----------|');
  
  const days = newestMetrics.days;
  const prevDays = previousMetrics ? previousMetrics.days : days;
  
  lines.push(formatRow('GSC Period', `${days} days`, previous ? `${prevDays} days` : '—', `${days - prevDays}d`));
  lines.push(formatRow('Total Clicks', String(newestMetrics.totalClicks), previous ? String(previousMetrics.totalClicks) : '—',
    delta(newestMetrics.totalClicks, previousMetrics ? previousMetrics.totalClicks : null, true)));
  lines.push(formatRow('Total Impressions', String(newestMetrics.totalImpressions), previous ? String(previousMetrics.totalImpressions) : '—',
    delta(newestMetrics.totalImpressions, previousMetrics ? previousMetrics.totalImpressions : null, true)));
  lines.push(formatRow('CTR', `${newestMetrics.ctr}%`, previous ? `${previousMetrics.ctr}%` : '—',
    previous ? `${(newestMetrics.ctr - previousMetrics.ctr).toFixed(2)}pp` : '—'));
  lines.push(formatRow('Avg Position', String(newestMetrics.avgPosition), previous ? String(previousMetrics.avgPosition) : '—',
    previous ? `${(newestMetrics.avgPosition - previousMetrics.avgPosition).toFixed(1)}` : '—'));
  lines.push('');
  lines.push('> Per-day comparison...');
  lines.push('');

  // S2: Trend — daily data (newest 60 days)
  lines.push('## Trend (Chart.csv)\n');
  lines.push('| Date | Clicks | Impressions | CTR | Position |');
  lines.push('|------|--------|-------------|-----|----------|');
  const recentDays = newestData.chart.slice(-60);
  for (const row of recentDays) {
    lines.push(`| ${row.Date} | ${row.Clicks} | ${row.Impressions} | ${typeof row.CTR === 'number' ? row.CTR.toFixed(2) + '%' : row.CTR_raw || '—'} | ${typeof row.Position === 'number' ? row.Position.toFixed(1) : row.Position} |`);
  }
  lines.push('');

  // Weekly averages
  lines.push('**Weekly averages:**\n');
  lines.push('| Week Start | Avg Clicks/Day | Avg Impressions/Day | CTR | Avg Position |');
  lines.push('|------------|----------------|--------------------|-----|-------------|');
  for (const w of newestMetrics.weeklyAverages) {
    lines.push(`| ${w.week} | ${w.avgClicks} | ${w.avgImpressions} | ${w.ctr}% | ${w.avgPosition} |`);
  }
  lines.push('');

  // S3: Page Performance
  lines.push('## Page Performance (Pages.csv)\n');
  const pages = computePageMetrics(newestData.pages);
  const prevPages = previous ? computePageMetrics(previousData.pages) : [];
  lines.push('| Page | Clicks | Impressions | CTR | Position | Share |');
  lines.push('|------|--------|-------------|-----|----------|-------|');
  for (const p of pages) {
    const prev = prevPages.find(x => x.url === p.url);
    const deltaStr = prev ? delta(p.clicks, prev.clicks, true) : '—';
    lines.push(`| \`${p.url}\` | ${p.clicks} | ${p.impressions} | ${p.ctr}% | ${p.position.toFixed(2)} | ${p.share}% |`);
  }
  lines.push('');

  // S4: Query Performance
  lines.push('## Query Performance (Queries.csv)\n');
  lines.push('### Top queries by clicks\n');
  lines.push('| Query | Clicks | Impressions | CTR | Position |');
  lines.push('|-------|--------|-------------|-----|----------|');
  const topQueries = newestData.queries.filter(q => (q.Clicks || 0) > 0).sort((a, b) => (b.Clicks || 0) - (a.Clicks || 0)).slice(0, 30);
  for (const q of topQueries) {
    const queryName = (q['Top queries'] || q['Query'] || '').length > 40
      ? (q['Top queries'] || q['Query'] || '').slice(0, 40) + '…'
      : (q['Top queries'] || q['Query'] || '');
    lines.push(`| ${queryName} | ${q.Clicks} | ${q.Impressions} | ${q.CTR}% | ${q.Position.toFixed(2)} |`);
  }
  lines.push('');

  // CTR leaks
  lines.push('### CTR leaks (0 clicks, ≥5 impressions)\n');
  const leaks = computeCTRLeaks(newestData.queries);
  lines.push('| Query | Impressions | Position | Score | Severity |');
  lines.push('|-------|-------------|----------|-------|----------|');
  for (const l of leaks.slice(0, 30)) {
    const qName = l.query.length > 40 ? l.query.slice(0, 40) + '…' : l.query;
    lines.push(`| ${qName} | ${l.impressions} | ${l.position.toFixed(2)} | ${l.score} | ${l.severity} |`);
  }
  lines.push('');

  // S5: Devices
  lines.push('## Devices (Devices.csv)\n');
  lines.push('| Device | Clicks | Impressions | CTR | Position | Share |');
  lines.push('|--------|--------|-------------|-----|----------|-------|');
  const totalDevClicks = newestData.devices.reduce((s, r) => s + (r.Clicks || 0), 0);
  for (const d of newestData.devices) {
    const share = totalDevClicks > 0 ? +((d.Clicks || 0) / totalDevClicks * 100).toFixed(1) : 0;
    lines.push(`| ${d.Device || d['Device'] || '?'} | ${d.Clicks || 0} | ${d.Impressions || 0} | ${d.CTR || 0}% | ${(d.Position || 0).toFixed(2)} | ${share}% |`);
  }
  lines.push('');

  // S6: Countries
  lines.push('## Countries (Countries.csv)\n');
  lines.push('Top 10 by clicks:\n');
  lines.push('| Country | Clicks | Impressions | CTR | Position |');
  lines.push('|---------|--------|-------------|-----|----------|');
  const topCountries = newestData.countries.sort((a, b) => (b.Clicks || 0) - (a.Clicks || 0)).slice(0, 10);
  for (const c of topCountries) {
    lines.push(`| ${c.Country || c['Country'] || '?'} | ${c.Clicks || 0} | ${c.Impressions || 0} | ${c.CTR || 0}% | ${(c.Position || 0).toFixed(2)} |`);
  }
  lines.push('');

  // S7: Rich Results
  lines.push('## Rich Results (Search appearance.csv)\n');
  if (newestData.searchAppearance.length === 0) {
    lines.push('| Feature | Clicks | Impressions | Status |');
    lines.push('|---------|--------|-------------|--------|');
    lines.push('| All | 0 | 0 | No rich results detected |');
  }
  lines.push('');

  // S8: Issues & Opportunities
  lines.push('## Issues & Opportunities\n');

  // Merge existing issues with current leaks
  const mergedIssues = [];
  const leakMap = {};
  for (const l of leaks) leakMap[l.query.toLowerCase()] = l;

  for (const issue of existing.issues) {
    const leak = leakMap[issue.query.toLowerCase()];
    if (leak) {
      // Issue persists — update metrics
      mergedIssues.push({
        id: issue.id,
        query: issue.query,
        impressions: leak.impressions,
        clicks: 0,
        position: leak.position,
        score: leak.score,
        severity: issue.severity,
        firstSeen: issue.firstSeen,
        status: 'open',
      });
    }
    // If not in current leaks, it's resolved (moved to improved)
  }

  // Add new leaks as new issues
  let nextId = existing.issues.length > 0 ? Math.max(...existing.issues.map(i => i.id)) + 1 : 1;
  for (const l of leaks) {
    if (!mergedIssues.find(i => i.query.toLowerCase() === l.query.toLowerCase())) {
      mergedIssues.push({
        id: nextId++,
        query: l.query,
        impressions: l.impressions,
        clicks: 0,
        position: l.position,
        score: l.score,
        severity: l.severity,
        firstSeen: newestMetrics.period.end,
        status: 'open',
      });
    }
  }

  // Write open issues table
  const openIssues = mergedIssues.filter(i => i.status === 'open').sort((a, b) => b.score - a.score);
  lines.push('### Open Issues\n');
  lines.push('| # | Issue | Impact | Severity | First Seen |');
  lines.push('|---|-------|--------|----------|------------|');
  for (const issue of openIssues) {
    lines.push(`| ${issue.id} | **"${issue.query.length > 40 ? issue.query.slice(0, 40) + '…' : issue.query}"** at pos ${issue.position.toFixed(2)} — ${issue.impressions} imp, ${issue.clicks} clicks | Needs triage | ${issue.severity} | ${issue.firstSeen} |`);
  }
  lines.push('');

  // Preserve actions taken from previous report
  lines.push('### Actions Taken\n');
  for (const action of existing.actions) {
    lines.push(action);
  }
  lines.push('');

  // S9: Comparison History
  lines.push('## Comparison History\n');
  lines.push('| Export | Period | Days | Clicks | /day | Impressions | /day | CTR | Position |');
  lines.push('|--------|--------|------|--------|------|-------------|------|-----|----------|');
  for (const comp of existing.comparisons) {
    lines.push(comp);
  }
  // Add newest row
  lines.push(formatRow(
    newest.name.replace('https___anomaly-alpha.github.io_-Performance-on-Search-', '').replace('https___anomaly-alpha-', ''),
    `${newestMetrics.period.start}–${newestMetrics.period.end}`,
    String(newestMetrics.days),
    String(newestMetrics.totalClicks),
    String(newestMetrics.perDayClicks),
    String(newestMetrics.totalImpressions),
    String(newestMetrics.perDayImpressions),
    `${newestMetrics.ctr}%`,
    String(newestMetrics.avgPosition)
  ));
  lines.push('');

  return lines.join('\n');
}

function formatRow(...cells) {
  return '| ' + cells.join(' | ') + ' |';
}

function delta(current, previous, isPositive = false) {
  if (previous === null || previous === undefined || previous === 0) return '—';
  const d = ((current - previous) / previous * 100).toFixed(1);
  const sign = d > 0 ? '+' : '';
  return `${sign}${d}%`;
}
```

- [ ] **Step 2: Wire up the main flow**

```js
function main() {
  const exportsList = discoverExports();
  if (exportsList.length === 0) {
    console.log('No GSC exports found in data/');
    return;
  }

  const newest = exportsList[0];
  const previous = exportsList.length > 1 ? exportsList[1] : null;

  const newestData = loadExport(newest.path);
  const newestMetrics = computeMetrics(newestData);

  let previousData = null, previousMetrics = null;
  if (previous) {
    previousData = loadExport(previous.path);
    previousMetrics = computeMetrics(previousData);
  }

  const existing = parseExistingIssues(REPORT_PATH);
  const report = generateReport(newest, previous, newestData, previousData, newestMetrics, previousMetrics, existing);

  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`Report written: ${REPORT_PATH}`);
  console.log(`Newest: ${newest.name} (${newestMetrics.totalClicks} clicks, ${newestMetrics.ctr}% CTR)`);
}

main();
```

- [ ] **Step 3: Run and verify report is generated**

Run: `node scripts/analyze-gsc.js`
Expected: "Report written: docs/reports/SEO_PERFORMANCE.md" — open the file and verify all 9+ sections are present.

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-gsc.js docs/reports/SEO_PERFORMANCE.md
git commit -m "feat: add GSC report generator with issue lifecycle management"
```

---

### Task 4: Dashboard data generation + dashboard page

**Covers:** [S5, S6, S7]

**Files:**
- Create: `seo/index.html`
- Modify: `scripts/analyze-gsc.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `window.__SEO_DATA` from `data/generated/seo-data.js`
- Produces: Rendered Chart.js dashboard at `/seo/`

- [ ] **Step 1: Add dashboard data writer to the script**

In `main()`, after writing the report, add:
```js
writeDashboardData(newestData, newestMetrics, leaks, pageMetrics, newest.name);
```

```js
function writeDashboardData(data, metrics, leaks, pages, exportName) {
  const dailyData = data.chart.slice(-30).map(r => ({
    date: r.Date,
    clicks: r.Clicks || 0,
    impressions: r.Impressions || 0,
  }));

  const seoData = {
    fetched: metrics.period.end,
    exportName,
    totals: {
      clicks: metrics.totalClicks,
      impressions: metrics.totalImpressions,
      ctr: metrics.ctr,
      position: metrics.avgPosition,
    },
    daily: dailyData,
    pages: pages.map(p => ({
      url: p.url,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.position,
      share: p.share,
    })),
    ctrLeaks: leaks.slice(0, 20).map(l => ({
      query: l.query,
      impressions: l.impressions,
      position: l.position,
      score: l.score,
      severity: l.severity,
    })),
    devices: data.devices.map(d => ({
      name: d.Device || d['Device'] || '?',
      clicks: d.Clicks || 0,
      share: 0, // computed below
    })),
    countries: data.countries.slice(0, 10).map(c => ({
      name: c.Country || c['Country'] || '?',
      clicks: c.Clicks || 0,
    })),
  };

  // Compute device shares
  const totalDC = seoData.devices.reduce((s, d) => s + d.clicks, 0);
  for (const d of seoData.devices) {
    d.share = totalDC > 0 ? +((d.clicks / totalDC) * 100).toFixed(1) : 0;
  }

  const js = `window.__SEO_DATA = ${JSON.stringify(seoData, null, 2)};\n`;
  fs.writeFileSync(DASHBOARD_DATA_PATH, js, 'utf8');
  console.log(`Dashboard data written: ${DASHBOARD_DATA_PATH}`);
}
```

- [ ] **Step 2: Create the dashboard page `seo/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#050a14">
    <meta name="color-scheme" content="dark light">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <link rel="icon" href="../favicon.ico" sizes="any">
    <title>SEO Dashboard — Gem Rewards Calculator</title>
    <link rel="stylesheet" href="../tailwind.css">
    <link rel="stylesheet" href="../styles.css">
</head>
<body class="relative min-h-screen p-5 md:p-10 gem-grid-bg">
    <div class="particles">
        <div class="gem-particle gem-particle--1" style="left:10%;animation-duration:12s;animation-delay:0s"></div>
        <div class="gem-particle gem-particle--2" style="left:30%;animation-duration:18s;animation-delay:2s"></div>
        <div class="gem-particle gem-particle--3" style="left:50%;animation-duration:14s;animation-delay:4s"></div>
        <div class="gem-particle gem-particle--1" style="left:70%;animation-duration:16s;animation-delay:1s"></div>
        <div class="gem-particle gem-particle--2" style="left:90%;animation-duration:20s;animation-delay:3s"></div>
    </div>

    <div class="gem-container">
        <main class="gem-card p-8 md:p-10">
            <div class="gem-hero mb-8">
                <a href="../" class="gem-text--cyan hover:text-white transition-colors text-sm">&larr; Gem Rewards Calculator</a>
                <h1 class="gem-title--hero mt-4">SEO Performance Dashboard</h1>
                <p class="gem-subtitle--hero" id="seoLastUpdated">Loading…</p>
            </div>

            <!-- KPI Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" id="kpiCards">
                <div class="gem-card p-4 text-center">
                    <p class="text-white/50 text-xs uppercase tracking-wider">Total Clicks</p>
                    <p class="text-2xl font-bold gem-text--cyan" id="kpiClicks">—</p>
                </div>
                <div class="gem-card p-4 text-center">
                    <p class="text-white/50 text-xs uppercase tracking-wider">Impressions</p>
                    <p class="text-2xl font-bold gem-text--cyan" id="kpiImpressions">—</p>
                </div>
                <div class="gem-card p-4 text-center">
                    <p class="text-white/50 text-xs uppercase tracking-wider">CTR</p>
                    <p class="text-2xl font-bold gem-text--cyan" id="kpiCtr">—</p>
                </div>
                <div class="gem-card p-4 text-center">
                    <p class="text-white/50 text-xs uppercase tracking-wider">Avg Position</p>
                    <p class="text-2xl font-bold gem-text--cyan" id="kpiPosition">—</p>
                </div>
            </div>

            <!-- Trend Chart -->
            <section class="mb-8">
                <h2 class="text-lg font-bold gem-text--cyan mb-4">Daily Trend (Last 30 Days)</h2>
                <div class="gem-card p-4">
                    <canvas id="trendChart" height="250"></canvas>
                </div>
            </section>

            <!-- Page Performance -->
            <section class="mb-8">
                <h2 class="text-lg font-bold gem-text--cyan mb-4">Page Performance</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm" id="pageTable">
                        <thead>
                            <tr class="text-white/50 text-xs uppercase tracking-wider">
                                <th class="text-left p-2">Page</th>
                                <th class="text-right p-2">Clicks</th>
                                <th class="text-right p-2">Impressions</th>
                                <th class="text-right p-2">CTR</th>
                                <th class="text-right p-2">Position</th>
                                <th class="text-right p-2">Share</th>
                            </tr>
                        </thead>
                        <tbody id="pageBody"></tbody>
                    </table>
                </div>
            </section>

            <!-- CTR Leaks -->
            <section class="mb-8">
                <h2 class="text-lg font-bold gem-text--cyan mb-4">CTR Leaks</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm" id="leakTable">
                        <thead>
                            <tr class="text-white/50 text-xs uppercase tracking-wider">
                                <th class="text-left p-2">Query</th>
                                <th class="text-right p-2">Impressions</th>
                                <th class="text-right p-2">Position</th>
                                <th class="text-right p-2">Severity</th>
                            </tr>
                        </thead>
                        <tbody id="leakBody"></tbody>
                    </table>
                </div>
            </section>

            <!-- Devices -->
            <section class="mb-8">
                <h2 class="text-lg font-bold gem-text--cyan mb-4">Device Breakdown</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm" id="deviceTable">
                        <thead>
                            <tr class="text-white/50 text-xs uppercase tracking-wider">
                                <th class="text-left p-2">Device</th>
                                <th class="text-right p-2">Clicks</th>
                                <th class="text-right p-2">Share</th>
                            </tr>
                        </thead>
                        <tbody id="deviceBody"></tbody>
                    </table>
                </div>
            </section>
        </main>
        <footer class="gem-legal-footer">
            <a href="../terms/" class="gem-legal-footer__link">Terms of Service</a>
            <span class="gem-legal-footer__sep">·</span>
            <a href="../privacy/" class="gem-legal-footer__link">Privacy Policy</a>
        </footer>
    </div>

    <script src="../data/generated/seo-data.js"></script>
    <script src="../vendor/chart.umd.js"></script>
    <script>
    function initSeoDashboard() {
        const data = window.__SEO_DATA;
        if (!data) {
            document.getElementById('seoLastUpdated').textContent = 'No data available';
            return;
        }

        const fmt = (n) => n.toLocaleString();

        // Last updated
        document.getElementById('seoLastUpdated').textContent = 'Updated ' + data.fetched + ' · Export: ' + (data.exportName || '').slice(0, 20);

        // KPI cards
        document.getElementById('kpiClicks').textContent = fmt(data.totals.clicks);
        document.getElementById('kpiImpressions').textContent = fmt(data.totals.impressions);
        document.getElementById('kpiCtr').textContent = data.totals.ctr + '%';
        document.getElementById('kpiPosition').textContent = data.totals.position;

        // Chart
        const ctx = document.getElementById('trendChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.daily.map(d => d.date),
                datasets: [{
                    label: 'Clicks',
                    data: data.daily.map(d => d.clicks),
                    borderColor: '#00e5ff',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                    fill: true,
                    tension: 0.3,
                }, {
                    label: 'Impressions',
                    data: data.daily.map(d => d.impressions),
                    borderColor: '#e91e8a',
                    backgroundColor: 'rgba(233, 30, 138, 0.1)',
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y1',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'rgba(255,255,255,0.8)' } } },
                scales: {
                    x: { ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 10 } },
                    y: { ticks: { color: 'rgba(255,255,255,0.5)' }, beginAtZero: true },
                    y1: { position: 'right', ticks: { color: 'rgba(255,255,255,0.5)' }, beginAtZero: true, grid: { display: false } },
                }
            }
        });

        // Pages table
        const pageBody = document.getElementById('pageBody');
        for (const p of data.pages) {
            const tr = document.createElement('tr');
            tr.className = 'border-t border-white/5';
            tr.innerHTML = `<td class="p-2 gem-text--cyan">${p.url}</td>
                <td class="p-2 text-right text-white/80">${fmt(p.clicks)}</td>
                <td class="p-2 text-right text-white/60">${fmt(p.impressions)}</td>
                <td class="p-2 text-right text-white/60">${p.ctr}%</td>
                <td class="p-2 text-right text-white/60">${p.position.toFixed(2)}</td>
                <td class="p-2 text-right text-white/60">${p.share}%</td>`;
            pageBody.appendChild(tr);
        }

        // Leaks table
        const leakBody = document.getElementById('leakBody');
        for (const l of data.ctrLeaks) {
            const severityColor = l.severity === 'CRITICAL' ? '#ff6b35' : l.severity === 'HIGH' ? '#f39c12' : '#2ecc71';
            const tr = document.createElement('tr');
            tr.className = 'border-t border-white/5';
            tr.innerHTML = `<td class="p-2 text-white/80">${l.query}</td>
                <td class="p-2 text-right text-white/60">${fmt(l.impressions)}</td>
                <td class="p-2 text-right text-white/60">${l.position.toFixed(2)}</td>
                <td class="p-2 text-right" style="color:${severityColor}">${l.severity}</td>`;
            leakBody.appendChild(tr);
        }

        // Devices table
        const deviceBody = document.getElementById('deviceBody');
        for (const d of data.devices) {
            const tr = document.createElement('tr');
            tr.className = 'border-t border-white/5';
            tr.innerHTML = `<td class="p-2 text-white/80">${d.name}</td>
                <td class="p-2 text-right text-white/80">${fmt(d.clicks)}</td>
                <td class="p-2 text-right text-white/60">${d.share}%</td>`;
            deviceBody.appendChild(tr);
        }
    }

    document.addEventListener('DOMContentLoaded', initSeoDashboard);
    </script>
</body>
</html>
```

- [ ] **Step 3: Add npm script to package.json**

```json
"analyze-gsc": "node scripts/analyze-gsc.js"
```

Insert after `"update-assets"` in the `scripts` block.

- [ ] **Step 4: Run full flow and verify**

Run: `npm run analyze-gsc`
Expected: Report updated + dashboard data written.
Open `seo/index.html` in a browser — verify KPI cards, chart renders, tables populate.

- [ ] **Step 5: Run `npm run build` to verify no regressions**

Expected: Build passes cleanly.

- [ ] **Step 6: Commit**

```bash
git add scripts/analyze-gsc.js seo/index.html data/generated/seo-data.js docs/reports/SEO_PERFORMANCE.md package.json
git commit -m "feat: add SEO dashboard page and GSC analyzer script"
```
