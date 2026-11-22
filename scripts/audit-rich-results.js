#!/usr/bin/env node
// Audits every page in sitemap.xml with Google's live Rich Results Test.
//
// Google publishes no API for the Rich Results Test, so this drives the real UI. The
// submission goes through one batchexecute RPC guarded by reCAPTCHA: a self-launched
// headless browser gets scored as automated and refused ("Something went wrong / Log
// in and try again") after a few pages, regardless of pacing. The reliable route is to
// drive the Chrome *app* itself over CDP — a real window with a real profile passes the
// check and needs no sign-in. Prefer --cdp; treat the self-launched modes as best-effort.
//
// Usage:
//   # Recommended: launch the Chrome app once, then drive it
//   chrome --remote-debugging-port=9222 --user-data-dir=<repo>/.rrt-profile
//   npm run audit-rich-results -- --cdp http://127.0.0.1:9222 --scope editorial
//
//   npm run audit-rich-results -- --scope watch --sample 6
//   npm run audit-rich-results -- --url https://anomaly-alpha.github.io/
//   npm run audit-rich-results -- --scope all --resume
//
// Flags: --cdp endpoint  --scope all|editorial|watch  --limit N  --sample N  --url URL
//        --gap ms  --cooldown ms  --out path  --resume  --headed

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Launcher } = require('chrome-launcher');
const puppeteer = require('puppeteer-core');

// ===== CONFIG =====

const RRT_URL = 'https://search.google.com/test/rich-results';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const RESULT_MARKER = /Detected structured data|Detected items|No items detected|isn't eligible/i;
const BLOCK_MARKER = /Something went wrong/i;
const MAX_ATTEMPTS = 3;

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const SCOPE = opt('scope', 'editorial');
const LIMIT = Number(opt('limit', 0));
const SAMPLE = Number(opt('sample', 0));
const GAP = Number(opt('gap', 15000));
const COOLDOWN = Number(opt('cooldown', 660000));
const SINGLE = opt('url', '');
const CDP = opt('cdp', '');
const RESUME = args.includes('--resume');
const HEADED = args.includes('--headed');
const OUT = path.resolve(
  ROOT,
  opt('out', path.join('data', 'rrt', new Date().toISOString().slice(0, 10), 'results.json'))
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== TARGETS =====

function sitemapUrls() {
  const file = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(file)) throw new Error('sitemap.xml not found at ' + file);
  const xml = fs.readFileSync(file, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function targets() {
  if (SINGLE) {
    return SINGLE.split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  }
  const all = sitemapUrls();
  let selected = all;
  if (SCOPE === 'editorial') selected = all.filter((u) => !u.includes('/watch/'));
  else if (SCOPE === 'watch') selected = all.filter((u) => u.includes('/watch/'));
  else if (SCOPE !== 'all') throw new Error('unknown --scope: ' + SCOPE);
  if (SAMPLE && selected.length > SAMPLE) {
    const step = selected.length / SAMPLE;
    selected = Array.from({ length: SAMPLE }, (_, i) => selected[Math.floor(i * step)]);
  }
  return selected;
}

// ===== RESULT PARSING =====

function parseResults(text) {
  const region = (text.split(/Detected structured data|Detected items/)[1] || '').split(
    'Additional resources'
  )[0];

  const summaryMatch = text.match(/(\d+ (?:valid )?items? detected[^\n]*)/);

  const types = [];
  for (const chunk of region.split(/\n(?=check_circle|error|warning)\b/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!/^(check_circle|error|warning)$/.test(lines[0] || '')) continue;
    if (!lines[1]) continue;
    const detail = lines.slice(2).filter((l) => /item|issue|valid|invalid|detected/i.test(l));
    types.push({ kind: lines[0], name: lines[1], detail: detail.join(' / ') });
  }

  let verdict = 'unknown';
  if (types.some((t) => t.kind === 'error')) verdict = 'invalid';
  else if (types.length) verdict = 'valid';
  else if (/No items detected/i.test(text)) verdict = 'none';

  return { summary: summaryMatch ? summaryMatch[1].trim() : null, verdict, types };
}

// ===== DRIVER =====

async function cdpReady(endpoint) {
  try {
    const res = await fetch(endpoint.replace(/\/$/, '') + '/json/version');
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForCdp(endpoint, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cdpReady(endpoint)) return true;
    await sleep(500);
  }
  return false;
}

// Detached so Chrome outlives this process; a Chrome started as a child of the run
// is killed when the run exits, which is what produced detached-frame errors mid-audit.
function spawnChromeApp(port) {
  const installs = Launcher.getInstallations();
  if (!installs.length) throw new Error('no Chrome installation found');
  const child = spawn(
    installs[0],
    [
      '--remote-debugging-port=' + port,
      '--user-data-dir=' + path.join(ROOT, '.rrt-profile'),
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      RRT_URL,
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

async function open() {
  if (CDP) {
    const port = Number((CDP.match(/:(\d+)/) || [])[1] || 9222);
    if (!(await cdpReady(CDP))) {
      console.log('no Chrome app on ' + CDP + ' — launching one');
      spawnChromeApp(port);
      if (!(await waitForCdp(CDP, 25000))) {
        throw new Error('Chrome app did not expose CDP at ' + CDP);
      }
    }
    const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
    const page = await browser.newPage();
    return { browser, page, owned: false };
  }

  const installs = Launcher.getInstallations();
  if (!installs.length) throw new Error('no Chrome installation found');
  const browser = await puppeteer.launch({
    executablePath: installs[0],
    headless: !HEADED,
    userDataDir: path.join(ROOT, '.rrt-profile'),
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1440, height: 1400 },
  });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  return { browser, page, owned: true };
}

async function testUrl(page, url) {
  const started = Date.now();
  const record = { url, state: 'unknown', checkedAt: new Date().toISOString() };

  await page.goto(RRT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type=url]', { timeout: 20000 });
  await sleep(1000);

  await page.type('input[type=url]', url, { delay: 30 });
  await sleep(400);

  const submitted = await page.evaluate(() => {
    for (const button of document.querySelectorAll('[role=button],button')) {
      if (/test url/i.test((button.innerText || '').trim())) {
        button.click();
        return true;
      }
    }
    return false;
  });
  if (!submitted) throw new Error('TEST URL button not found');

  let text = '';
  for (let tick = 0; tick < 55; tick++) {
    await sleep(2000);
    text = await page.evaluate(() => document.body.innerText);
    if (BLOCK_MARKER.test(text)) {
      record.state = 'blocked';
      break;
    }
    if (RESULT_MARKER.test(text)) {
      Object.assign(record, parseResults(text));
      record.state = 'ok';
      break;
    }
  }
  if (record.state === 'unknown') record.state = 'timeout';

  record.elapsedMs = Date.now() - started;
  return record;
}

// ===== STORE =====

function loadPrior() {
  if (!RESUME || !fs.existsSync(OUT)) return { meta: null, results: [] };
  const parsed = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  if (Array.isArray(parsed)) return { meta: null, results: parsed };
  return { meta: parsed.meta || null, results: parsed.results || [] };
}

function save(results) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Last record per URL wins, so a resumed run replaces earlier error/blocked entries
  // instead of accumulating duplicates.
  const byUrl = new Map();
  for (const record of results) byUrl.set(record.url, record);
  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      scope: SCOPE,
      gapMs: GAP,
      cooldownMs: COOLDOWN,
      source: 'Google Rich Results Test (driven headlessly, no official API)',
    },
    results: [...byUrl.values()],
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
}

// ===== MAIN =====

async function main() {
  const all = targets();
  const prior = loadPrior();
  const seen = new Set(prior.results.filter((r) => r.state === 'ok').map((r) => r.url));
  const queue = all.filter((u) => !seen.has(u));
  const batch = LIMIT ? queue.slice(0, LIMIT) : queue;

  console.log(
    `scope=${SCOPE} queued=${batch.length}/${all.length} gap=${GAP}ms cooldown=${Math.round(
      COOLDOWN / 1000
    )}s`
  );
  console.log('output: ' + path.relative(ROOT, OUT) + (RESUME ? ' (resuming)' : ''));
  console.log(
    'route: ' +
      (CDP
        ? 'attached to Chrome app at ' + CDP
        : HEADED
          ? 'self-launched headed (may be refused)'
          : 'self-launched headless (likely refused — prefer --cdp)')
  );

  let { browser, page, owned } = await open();

  const results = prior.results.filter((r) => r.state !== 'blocked');
  let blocked = 0;

  const flush = () => save(results);
  process.on('SIGINT', () => {
    flush();
    console.log('\ninterrupted — partial results saved');
    process.exit(130);
  });

  for (let i = 0; i < batch.length; i++) {
    const url = batch[i];
    const short = url.replace(/^https?:\/\/[^/]+/, '') || '/';
    let record;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        record = await testUrl(page, url);
      } catch (error) {
        record = {
          url,
          state: 'error',
          error: error.message,
          checkedAt: new Date().toISOString(),
          elapsedMs: 0,
        };
        if (CDP && attempt < MAX_ATTEMPTS) {
          try {
            ({ browser, page } = await open());
            console.log('  browser went away — re-attached, retrying');
            continue;
          } catch (reopenError) {
            console.log('  re-attach failed: ' + reopenError.message);
          }
        }
      }
      if (record.state !== 'blocked') break;
      if (attempt === MAX_ATTEMPTS) break;
      console.log(`  blocked — cooling down ${Math.round(COOLDOWN / 1000)}s then retrying`);
      await sleep(COOLDOWN);
    }

    results.push(record);
    flush();

    const invalid = (record.types || []).filter((t) => t.kind !== 'check_circle');
    console.log(
      `[${i + 1}/${batch.length}] ${short} -> ${record.state}/${record.verdict || '-'} ` +
        `${record.summary ? '| ' + record.summary : ''}` +
        (invalid.length ? ' !! ' + invalid.map((t) => `${t.name} (${t.detail})`).join('; ') : '')
    );

    if (record.state === 'blocked') {
      blocked++;
      if (blocked >= 3) {
        console.log('blocked 3x — Google is refusing this IP; stopping. Re-run with --resume later.');
        break;
      }
    } else {
      blocked = 0;
    }

    if (i < batch.length - 1) await sleep(GAP);
  }

  if (owned) await browser.close();
  else await browser.disconnect();
  flush();

  const ok = results.filter((r) => r.state === 'ok');
  const invalid = ok.filter((r) => r.verdict === 'invalid');
  console.log(`\ncomplete: ${ok.length} tested, ${invalid.length} with invalid items`);
  for (const r of invalid) {
    const bad = r.types.filter((t) => t.kind !== 'check_circle');
    console.log(`  ${r.url.replace(/^https?:\/\/[^/]+/, '') || '/'}: ` + bad.map((t) => t.name).join(', '));
  }
  console.log('written: ' + path.relative(ROOT, OUT));
}

main().catch((error) => {
  console.error('failed: ' + error.message);
  process.exit(1);
});
