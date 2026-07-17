const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORT_PATH = path.join(__dirname, '..', 'docs', 'reports', 'SEO_PERFORMANCE.md');
const DASHBOARD_DATA_PATH = path.join(__dirname, '..', 'data', 'generated', 'seo-data.js');

// ===== Export Discovery =====

const OLD_NAMING = /^https___anomaly-alpha-(\d{4})$/;
const NEW_NAMING = /^https___anomaly-alpha\.github\.io_-Performance-on-Search-(\d{4}-\d{2}-\d{2})$/;

function parseExportDate(folderName) {
  let m = folderName.match(OLD_NAMING);
  if (m) {
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
    .sort((a, b) => b.date - a.date);
  return exports;
}

// ===== CSV Parsing =====

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      let val = (values[i] || '').trim();
      if (val.endsWith('%')) {
        row[h.trim() + '_raw'] = val;
        row[h.trim()] = parseFloat(val) || 0;
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

// ===== Metric Computation =====

function computeMetrics(exp) {
  const chart = exp.chart;
  if (chart.length === 0) return null;

  const totalClicks = chart.reduce((s, r) => s + (r.Clicks || 0), 0);
  const totalImpressions = chart.reduce((s, r) => s + (r.Impressions || 0), 0);
  const avgPosition = chart.reduce((s, r) => s + (r.Position || 0), 0) / chart.length;
  const dates = chart.map(r => r.Date).filter(Boolean).sort();
  const days = dates.length > 1
    ? Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / (1000 * 60 * 60 * 24)) + 1
    : 1;

  const weeklyAverages = [];
  for (let i = 0; i < chart.length; i += 7) {
    const week = chart.slice(i, i + 7);
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
  }

  return {
    totalClicks,
    totalImpressions,
    ctr: totalImpressions > 0 ? +(totalClicks / totalImpressions * 100).toFixed(2) : 0,
    avgPosition: +avgPosition.toFixed(1),
    period: { start: dates[0], end: dates[dates.length - 1] },
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

function computeCTRLeaks(queries, minImpressions) {
  if (minImpressions === undefined) minImpressions = 5;
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

// ===== Helpers =====

function delta(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return '—';
  const d = ((current - previous) / previous * 100).toFixed(1);
  return d > 0 ? `+${d}%` : `${d}%`;
}

function fmtRow(...cells) {
  return '| ' + cells.join(' | ') + ' |';
}

function truncate(str, max) {
  return str && str.length > max ? str.slice(0, max) + '\u2026' : str || '';
}

function fmtDate(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dt = new Date(d + 'T00:00:00');
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

// ===== Report Generation =====

function generateReport(newest, previous, newestData, previousData, newestMetrics, previousMetrics) {
  const lines = [];
  const l = (s) => lines.push(s);
  const nl = () => lines.push('');

  l('# SEO Performance Report');
  nl();
  l(`**Generated:** ${fmtDate(newestMetrics.period.end)}`);
  l('**Export:** ' + newest.name);
  nl();
  l('---');
  nl();

  // ---- Quick Summary ----
  l('## Quick Summary');
  nl();
  l('| Metric | Current | Previous | Raw \u0394 | Per-Day \u0394 |');
  l('|--------|---------|---------|-------|-----------|');
  const pd = previousMetrics;
  const lm = newestMetrics;
  l(fmtRow('GSC Period', `${lm.days} days`, pd ? `${pd.days} days` : '\u2014', pd ? `${lm.days - pd.days}d` : '\u2014', '\u2014'));
  l(fmtRow('Total Clicks', String(lm.totalClicks), pd ? String(pd.totalClicks) : '\u2014', pd ? delta(lm.totalClicks, pd.totalClicks) : '\u2014',
    pd ? delta(lm.perDayClicks, pd.perDayClicks) : '\u2014'));
  l(fmtRow('Total Impressions', String(lm.totalImpressions), pd ? String(pd.totalImpressions) : '\u2014', pd ? delta(lm.totalImpressions, pd.totalImpressions) : '\u2014',
    pd ? delta(lm.perDayImpressions, pd.perDayImpressions) : '\u2014'));
  l(fmtRow('CTR', `${lm.ctr}%`, pd ? `${pd.ctr}%` : '\u2014', pd ? `${(lm.ctr - pd.ctr).toFixed(2)}pp` : '\u2014', '\u2014'));
  l(fmtRow('Avg Position', String(lm.avgPosition), pd ? String(pd.avgPosition) : '\u2014', pd ? `${(lm.avgPosition - pd.avgPosition).toFixed(1)}` : '\u2014', '\u2014'));
  nl();

  // ---- Trend ----
  l('## Trend (Chart.csv)');
  nl();
  l('| Date | Clicks | Impressions | CTR | Position |');
  l('|------|--------|-------------|-----|----------|');
  const recentDays = newestData.chart;
  for (const row of recentDays) {
    const ctr = typeof row.CTR === 'number' ? row.CTR.toFixed(2) + '%' : (row.CTR_raw || '\u2014');
    l(`| ${row.Date} | ${row.Clicks || 0} | ${row.Impressions || 0} | ${ctr} | ${(row.Position || 0).toFixed(1)} |`);
  }
  nl();

  l('**Weekly averages:**');
  nl();
  l('| Week Start | Avg Clicks/Day | Avg Impressions/Day | CTR | Avg Position |');
  l('|------------|----------------|--------------------|-----|-------------|');
  for (const w of lm.weeklyAverages) {
    l(`| ${w.week} | ${w.avgClicks} | ${w.avgImpressions} | ${w.ctr}% | ${w.avgPosition} |`);
  }
  nl();

  // ---- Page Performance ----
  l('## Page Performance (Pages.csv)');
  nl();
  const pages = computePageMetrics(newestData.pages);
  const prevPages = previousData ? computePageMetrics(previousData.pages) : [];
  l('| Page | Clicks | Impressions | CTR | Position | Share | Trend');
  l('|------|--------|-------------|-----|----------|-------|-------|');
  for (const p of pages) {
    const prev = prevPages.find(x => x.url === p.url);
    const trend = prev ? delta(p.clicks, prev.clicks) : '\u2014';
    l(`| \`${p.url}\` | ${p.clicks} | ${p.impressions} | ${p.ctr}% | ${p.position.toFixed(2)} | ${p.share}% | ${trend} |`);
  }
  nl();

  // ---- Query Performance ----
  l('## Query Performance (Queries.csv)');
  nl();
  l('### Top queries by clicks');
  nl();
  l('| Query | Clicks | Impressions | CTR | Position |');
  l('|-------|--------|-------------|-----|----------|');
  const topQueries = newestData.queries
    .filter(q => (q.Clicks || 0) > 0)
    .sort((a, b) => (b.Clicks || 0) - (a.Clicks || 0))
    .slice(0, 30);
  for (const q of topQueries) {
    l(`| ${truncate(q['Top queries'] || q['Query'] || '', 45)} | ${q.Clicks} | ${q.Impressions} | ${q.CTR}% | ${(q.Position || 0).toFixed(2)} |`);
  }
  nl();

  l('### CTR leaks (0 clicks, \u22655 impressions)');
  nl();
  const leaks = computeCTRLeaks(newestData.queries);
  l('| Query | Impressions | Position | Score | Severity |');
  l('|-------|-------------|----------|-------|----------|');
  let nextIssueId = 1;
  for (const lk of leaks.slice(0, 30)) {
    l(`| ${truncate(lk.query, 45)} | ${lk.impressions} | ${lk.position.toFixed(2)} | ${lk.score} | ${lk.severity} |`);
  }
  nl();

  // ---- Devices ----
  l('## Devices (Devices.csv)');
  nl();
  l('| Device | Clicks | Impressions | CTR | Position | Share |');
  l('|--------|--------|-------------|-----|----------|-------|');
  const totalDevClicks = newestData.devices.reduce((s, r) => s + (r.Clicks || 0), 0);
  for (const d of newestData.devices) {
    const share = totalDevClicks > 0 ? +((d.Clicks || 0) / totalDevClicks * 100).toFixed(1) : 0;
    l(`| ${d.Device || d['Device'] || '?'} | ${d.Clicks || 0} | ${d.Impressions || 0} | ${d.CTR || 0}% | ${(d.Position || 0).toFixed(2)} | ${share}% |`);
  }
  nl();

  // ---- Countries ----
  l('## Countries (Countries.csv)');
  nl();
  l('**Top 10 by clicks:**');
  nl();
  l('| Country | Clicks | Impressions | CTR | Position |');
  l('|---------|--------|-------------|-----|----------|');
  const topCountries = newestData.countries
    .sort((a, b) => (b.Clicks || 0) - (a.Clicks || 0))
    .slice(0, 10);
  for (const c of topCountries) {
    l(`| ${c.Country || c['Country'] || '?'} | ${c.Clicks || 0} | ${c.Impressions || 0} | ${c.CTR || 0}% | ${(c.Position || 0).toFixed(2)} |`);
  }
  nl();

  // ---- Rich Results ----
  l('## Rich Results (Search appearance.csv)');
  nl();
  if (newestData.searchAppearance.length === 0) {
    l('| Feature | Clicks | Impressions | Status |');
    l('|---------|--------|-------------|--------|');
    l('| All | 0 | 0 | No rich results detected |');
  }
  nl();

  // ---- Issues & Opportunities ----
  l('## Issues & Opportunities');
  nl();
  l('### Open Issues');
  nl();
  if (leaks.length > 0) {
    l('| # | Issue | Impact | Severity | First Seen |');
    l('|---|-------|--------|----------|------------|');
    nextIssueId = 1;
    for (const lk of leaks.slice(0, 20)) {
      l(`| ${nextIssueId++} | **"${truncate(lk.query, 40)}"** at pos ${lk.position.toFixed(2)} \u2014 ${lk.impressions} imp, 0 clicks | 0 clicks at pos ${lk.position.toFixed(2)}, ${lk.impressions} impressions | ${lk.severity} | ${fmtDate(lm.period.end)} |`);
    }
  }
  nl();

  // ---- Comparison History ----
  l('## Comparison History');
  nl();
  l('| Export | Period | Days | Clicks | /day | Impressions | /day | CTR | Position |');
  l('|--------|--------|------|--------|------|-------------|------|-----|----------|');

  // Preserve previous comparison rows
  if (fs.existsSync(REPORT_PATH)) {
    const oldText = fs.readFileSync(REPORT_PATH, 'utf8');
    const histMatch = oldText.match(/## Comparison History[\s\S]*?(?=## |$)/);
    if (histMatch) {
      const histLines = histMatch[0].split('\n');
      let inTable = false;
      for (const hl of histLines) {
        if (hl.startsWith('| ') && !hl.includes('Export | Period')) {
          if (hl.includes('| ---')) continue;
          l(hl);
          inTable = true;
        }
      }
    }
  }

  // Append newest row
  l(`| ${newest.name.replace(/^.*?(\d{4}(?:-\d{2})?(?:\d{2})?)$/, '$1')} | ${lm.period.start} \u2013 ${lm.period.end} | ${lm.days} | ${lm.totalClicks} | ${lm.perDayClicks} | ${lm.totalImpressions} | ${lm.perDayImpressions} | ${lm.ctr}% | ${lm.avgPosition} |`);
  nl();

  return lines.join('\n');
}

// ===== Dashboard Data Generation =====

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
    ctrLeaks: leaks.slice(0, 20).map(lk => ({
      query: lk.query,
      impressions: lk.impressions,
      position: lk.position,
      score: lk.score,
      severity: lk.severity,
    })),
    devices: data.devices.map(d => ({
      name: d.Device || d['Device'] || '?',
      clicks: d.Clicks || 0,
      share: 0,
    })),
    countries: data.countries.slice(0, 10).map(c => ({
      name: c.Country || c['Country'] || '?',
      clicks: c.Clicks || 0,
    })),
  };

  const totalDC = seoData.devices.reduce((s, d) => s + d.clicks, 0);
  for (const d of seoData.devices) {
    d.share = totalDC > 0 ? +((d.clicks / totalDC) * 100).toFixed(1) : 0;
  }

  const js = 'window.__SEO_DATA = ' + JSON.stringify(seoData, null, 2) + ';\n';
  const dir = path.dirname(DASHBOARD_DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DASHBOARD_DATA_PATH, js, 'utf8');
  console.log('Dashboard data written: ' + DASHBOARD_DATA_PATH);
}

// ===== Main =====

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

  const pageMetrics = computePageMetrics(newestData.pages);
  const leaks = computeCTRLeaks(newestData.queries);

  // Generate and write report
  const report = generateReport(newest, previous, newestData, previousData, newestMetrics, previousMetrics);
  const reportDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log('Report written: ' + REPORT_PATH);

  // Generate dashboard data
  writeDashboardData(newestData, newestMetrics, leaks, pageMetrics, newest.name);

  // Summary
  console.log(`\nSummary:`);
  console.log(`  Newest: ${newest.name}`);
  console.log(`  Period: ${newestMetrics.period.start} \u2192 ${newestMetrics.period.end} (${newestMetrics.days} days)`);
  console.log(`  Clicks: ${newestMetrics.totalClicks} (${newestMetrics.perDayClicks}/day)`);
  console.log(`  CTR: ${newestMetrics.ctr}%`);
  console.log(`  Top page: ${pageMetrics[0] ? pageMetrics[0].url + ' \u2014 ' + pageMetrics[0].clicks + ' clicks' : 'none'}`);
  console.log(`  CTR Leaks: ${leaks.length} found`);
}

main();
