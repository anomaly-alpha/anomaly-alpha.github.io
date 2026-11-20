// Daily code sync: harvest the publisher, search the web, verify, then either publish
// or queue for review.
//
// Publication rules (see docs/plans/2026-11-19/deepseek-v4.1-flash-free/auto-update-codes.md):
// - a code is published automatically only when the publisher dated it AND a fetched
//   page shows a gem/ticket reward next to it
// - web-only codes are queued: no source publishes a trustworthy release date for them
// - nothing is ever expired automatically

const fs = require('fs');
const path = require('path');
const { harvestPatchNotes, daysSince } = require('./lib/patch-notes');
const { discoverCodes, DEFAULT_MODEL } = require('./lib/gemini');

const rootDir = path.resolve(__dirname, '..');
const codesPath = path.join(rootDir, 'data', 'codes.json');
const candidatesPath = path.join(rootDir, 'data', 'code-candidates.json');

const ACTIONABLE_DAYS = 120;
const STALE_DAYS = 120;
const MAX_SOURCES = 4;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_PENDING = 50;
const KEEP_ADDED_DAYS = 90;
const CODE_RE = /^[A-Z0-9]{4,12}$/;

// Verification fetches URLs chosen by a model, so keep it off the runner's own network.
const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
const OWN_HOSTS = new Set(['anomaly-alpha.github.io', 'www.anomaly-alpha.github.io']);

// ===== ARGUMENTS =====

function parseArgs(argv) {
  const args = {
    dryRun: false,
    useLlm: true,
    reportPath: null,
    summaryPath: null,
    today: new Date().toISOString().slice(0, 10),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-llm') args.useLlm = false;
    else if (arg === '--report') args.reportPath = argv[++i];
    else if (arg === '--summary') args.summaryPath = argv[++i];
    else if (arg === '--today') args.today = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

// ===== IO =====

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ===== FETCH =====

function isSafeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (OWN_HOSTS.has(url.hostname.toLowerCase())) return false;
  if (url.hostname.includes(':')) return false;
  if (PRIVATE_HOST_RE.test(url.hostname)) return false;
  if (url.port && url.port !== '80' && url.port !== '443') return false;
  return true;
}

function hostOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'invalid';
  }
}

async function fetchPage(url, depth = 0) {
  if (depth > 3) throw new Error('too many redirects');
  const res = await fetch(url, {
    headers: {
      'user-agent': 'anomaly-alpha code-check (+https://anomaly-alpha.github.io/)',
      accept: 'text/html,text/plain,application/xhtml+xml',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });

  // Follow redirects by hand so a public URL cannot bounce the fetch into a private one.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error(`HTTP ${res.status} without a location header`);
    const next = new URL(location, url).href;
    if (!isSafeUrl(next)) throw new Error('redirect to a blocked host');
    return fetchPage(next, depth + 1);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (type && !/text|html|json/i.test(type)) throw new Error(`unsupported content-type ${type}`);
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_PAGE_BYTES) throw new Error('page too large');
  return new TextDecoder('utf-8').decode(buffer);
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ===== REWARD PARSING =====

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNumber(value) {
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Reward text sits next to the code on aggregator pages, but a page can list many
// codes, so only look in a window around this one.
function findReward(text, code) {
  const match = new RegExp(`\\b${escapeRegExp(code)}\\b`, 'i').exec(text);
  if (!match) return null;

  const start = Math.max(0, match.index - 250);
  const end = Math.min(text.length, match.index + code.length + 250);
  const window = text.slice(start, end);

  const gemsMatch = window.match(/(\d[\d,]*)\s*(?:[xX]\s*)?gems?\b/i);
  const ticketsMatch = window.match(/(\d[\d,]*)\s*(?:[xX]\s*)?(?:equipment\s+)?tickets?\b/i);
  const itemMatch = window.match(/(\d[\d,]*)\s*[xX]\s+([A-Z][A-Za-z'’\-]*(?:\s+[A-Z][A-Za-z'’\-]*){0,2})/);

  let item = null;
  if (itemMatch) {
    const name = itemMatch[2].trim();
    if (!/^(gems?|tickets?|equipment(\s+tickets?)?)$/i.test(name)) {
      item = `${itemMatch[1]} x ${name}`;
    }
  }

  return {
    gems: gemsMatch ? toNumber(gemsMatch[1]) : 0,
    tickets: ticketsMatch ? toNumber(ticketsMatch[1]) : 0,
    item,
    snippet: window.trim(),
  };
}

// ===== VERIFICATION =====

async function verifyCandidate(entry) {
  const urls = [];
  const claimed = Array.isArray(entry.llm?.sourceUrls) ? entry.llm.sourceUrls : [];
  for (const url of claimed) if (isSafeUrl(url)) urls.push(url);
  if (entry.official?.url) urls.push(entry.official.url);

  const unique = [...new Set(urls)].slice(0, MAX_SOURCES);
  const results = await Promise.all(unique.map(async (url) => {
    const official = url === entry.official?.url;
    try {
      const text = htmlToText(await fetchPage(url));
      const reward = findReward(text, entry.code);
      return {
        url,
        official,
        domain: hostOf(url),
        codeSeen: Boolean(reward),
        gems: reward ? reward.gems : 0,
        tickets: reward ? reward.tickets : 0,
        item: reward ? reward.item : null,
      };
    } catch (error) {
      return { url, official, domain: hostOf(url), codeSeen: false, error: error.message };
    }
  }));

  // Patch notes carry the code but not the reward, so they never supply a reward value.
  // Sources agree only when the whole gem/ticket pair matches; a page may legitimately
  // list both kinds in one reward.
  const withNumbers = results.filter((r) => r.codeSeen && !r.official && (r.gems > 0 || r.tickets > 0));
  const tuples = [
    ...new Map(withNumbers.map((r) => [`${r.gems}:${r.tickets}`, { gems: r.gems, tickets: r.tickets }])).values(),
  ];
  const itemReward = results.find((r) => r.codeSeen && !r.official && r.item)?.item || null;
  const ambiguous = tuples.length > 1;
  const reward = !ambiguous && tuples.length === 1 ? tuples[0] : null;

  return { results, reward, ambiguous, itemReward, codeSeen: results.some((r) => r.codeSeen) };
}

// ===== DECISIONS =====

function decide(entry) {
  const verification = entry.verification;
  if (!entry.official) {
    return { action: 'queue', reason: 'no publisher date - aggregator dates are not publishable' };
  }
  if (!entry.official.date) {
    return { action: 'queue', reason: 'publisher article has no parseable date' };
  }
  if (verification.ambiguous) {
    return { action: 'queue', reason: 'sources disagree on the reward' };
  }
  // Publishing only the gem half of "500 Gems + 2 Gold Dossiers" understates the reward.
  if (verification.reward && verification.itemReward) {
    return { action: 'queue', reason: 'mixed gem/item reward needs a human' };
  }
  if (verification.reward) {
    return { action: 'add', reason: 'publisher-dated code with a verified gem/ticket reward' };
  }
  if (verification.itemReward) {
    return { action: 'queue', reason: 'item or hero reward needs a human' };
  }
  return { action: 'queue', reason: 'no reward found next to the code' };
}

function buildCodeEntry(entry) {
  return {
    code: entry.code,
    gems: entry.verification.reward.gems,
    tickets: entry.verification.reward.tickets,
    tier: 'HIGH',
    dateAdded: entry.official.date,
  };
}

// A freshly published code leads the page. Shifting the hand-pinned positions keeps
// their relative order and avoids the generator's "newer than the pinned codes" warning.
function insertActiveCode(codes, entry) {
  for (const code of codes) {
    if (!code.expired && typeof code.position === 'number') code.position += 1;
  }
  codes.unshift({ ...entry, position: 1 });
}

function describeReward(entry) {
  if (entry.verification.reward) {
    const { gems, tickets } = entry.verification.reward;
    if (gems > 0) return `${gems.toLocaleString('en-US')} Gems`;
    return `${tickets.toLocaleString('en-US')} Tickets`;
  }
  if (entry.verification.itemReward) return entry.verification.itemReward;
  if (entry.llm?.reward) return `${entry.llm.reward} (unverified)`;
  return '(unknown)';
}

// ===== REPORT =====

function buildReport({ today, articles, failures, withCode, llm, added, dateFixed, pending, flags }) {
  const lines = [`## Promo code sync — ${today}`, ''];
  lines.push(`- Publisher patch notes: ${articles} scanned, ${withCode} with codes, ${failures} fetch failures`);
  lines.push(
    llm.used
      ? `- Gemini (${llm.model}): ${llm.candidates} candidate(s)${llm.error ? `, error: ${llm.error}` : ''}`
      : `- Gemini: skipped${llm.error ? ` (${llm.error})` : ' (no GEMINI_API_KEY)'}`,
  );
  lines.push(`- Auto-added: ${added.length} · Dates corrected: ${dateFixed.length} · Needs review: ${pending.length} · Flags: ${flags.length}`);

  if (added.length) {
    lines.push('', '### Auto-added', '', '| Code | Reward | Publisher date | Evidence |', '|---|---|---|---|');
    for (const item of added) {
      lines.push(`| \`${item.code}\` | ${item.reward} | ${item.dateAdded} | ${item.evidence} |`);
    }
  }

  if (dateFixed.length) {
    lines.push('', '### Dates corrected', '', '| Code | Was | Publisher date |', '|---|---|---|');
    for (const item of dateFixed) lines.push(`| \`${item.code}\` | ${item.from || '(none)'} | ${item.to} |`);
  }

  if (pending.length) {
    lines.push('', '### Needs review', '', '| Code | Reward | Publisher date | Evidence | Why |', '|---|---|---|---|---|');
    for (const item of pending) {
      lines.push(`| \`${item.code}\` | ${item.reward} | ${item.officialDate || '-'} | ${item.evidence} | ${item.reason} |`);
    }
  }

  if (flags.length) {
    lines.push('', '### Flags');
    for (const flag of flags) lines.push(`- ${flag}`);
  }

  if (!added.length && !dateFixed.length && !pending.length && !flags.length) {
    lines.push('', 'No changes. Everything tracked still matches the publisher.');
  }

  return lines.join('\n') + '\n';
}

// ===== MAIN =====

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const codesData = readJson(codesPath, null);
  if (!codesData || !Array.isArray(codesData.codes)) throw new Error('data/codes.json is missing or malformed');

  const candidatesData = readJson(candidatesPath, { updated: args.today, candidates: [] });
  if (!Array.isArray(candidatesData.candidates)) candidatesData.candidates = [];
  const candidatesBefore = JSON.stringify(candidatesData.candidates);

  const tracked = new Map(codesData.codes.map((c) => [String(c.code).toUpperCase(), c]));

  // A queued code that is now in codes.json was resolved by hand; clear it from the queue.
  for (const candidate of candidatesData.candidates) {
    if (candidate.status === 'pending' && tracked.has(candidate.code)) {
      candidate.status = 'resolved';
      candidate.resolvedAt = args.today;
    }
  }

  const articles = await harvestPatchNotes();
  if (!articles.length) throw new Error('publisher patch-notes page returned no articles - the source may have moved');

  const failures = articles.filter((a) => a.error);
  const withCode = articles.filter((a) => a.code);
  const officialByCode = new Map();
  for (const article of withCode) {
    const current = officialByCode.get(article.code);
    if (!current || String(article.date) > String(current.date)) officialByCode.set(article.code, article);
  }

  const dateFixed = [];
  for (const [code, article] of officialByCode) {
    const record = tracked.get(code);
    if (!record || record.expired || !article.date) continue;
    if (String(record.dateAdded || '') !== article.date) {
      dateFixed.push({ code, from: record.dateAdded || null, to: article.date });
      if (!args.dryRun) record.dateAdded = article.date;
    }
  }

  const officialNew = [...officialByCode.values()].filter((a) => !tracked.has(a.code));

  let llm = { used: false, model: DEFAULT_MODEL, candidates: 0, error: null };
  let llmCodes = [];
  if (args.useLlm) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    llm.model = model;
    if (!apiKey) {
      llm.error = 'GEMINI_API_KEY is not set';
    } else {
      try {
        const result = await discoverCodes({
          apiKey,
          model,
          knownCodes: [...tracked.keys()],
          today: args.today,
        });
        llmCodes = result.codes;
        llm.used = true;
        llm.candidates = result.codes.length;
      } catch (error) {
        llm.error = error.message;
      }
    }
  } else {
    llm.error = 'disabled by --no-llm';
  }

  const candidates = new Map();
  for (const article of officialNew) {
    candidates.set(article.code, { code: article.code, official: article, llm: null });
  }
  for (const raw of llmCodes) {
    const code = String(raw.code || '').toUpperCase().trim();
    if (!CODE_RE.test(code) || tracked.has(code)) continue;
    const entry = candidates.get(code) || { code, official: null, llm: null };
    entry.llm = raw;
    candidates.set(code, entry);
  }

  const entries = [...candidates.values()];
  await mapLimit(entries, 3, async (entry) => {
    entry.verification = await verifyCandidate(entry);
  });

  const added = [];
  for (const entry of entries) {
    const decision = decide(entry);
    const evidence = entry.verification.results
      .filter((r) => r.codeSeen)
      .map((r) => r.domain)
      .filter((value, index, list) => list.indexOf(value) === index)
      .join(', ') || 'none';

    if (decision.action === 'add') {
      added.push({
        code: entry.code,
        reward: describeReward(entry),
        dateAdded: entry.official.date,
        evidence,
        source: entry.verification.results.find((r) => r.codeSeen && r.gems + r.tickets > 0)?.url || '',
      });
      if (!args.dryRun) insertActiveCode(codesData.codes, buildCodeEntry(entry));
    }

    const existing = candidatesData.candidates.find((c) => c.code === entry.code);
    const record = existing || { code: entry.code, firstSeen: args.today };
    record.status = decision.action === 'add' ? 'added' : 'pending';
    record.lastSeen = args.today;
    record.officialDate = entry.official?.date || record.officialDate || null;
    record.officialUrl = entry.official?.url || record.officialUrl || null;
    record.reward = describeReward(entry);
    record.evidence = evidence;
    record.sources = entry.verification.results.filter((r) => r.codeSeen).map((r) => r.url);
    record.reason = decision.reason;
    if (decision.action === 'add') record.addedAt = args.today;
    if (!existing) candidatesData.candidates.push(record);
  }

  const flags = [];
  const stale = [];
  for (const code of codesData.codes) {
    if (code.expired || !code.dateAdded) continue;
    const age = daysSince(code.dateAdded);
    if (age > STALE_DAYS) stale.push({ code: code.code, dateAdded: code.dateAdded, age });
  }
  if (stale.length) {
    stale.sort((a, b) => b.age - a.age);
    const oldest = stale.slice(0, 5).map((c) => `${c.code} (${c.age}d)`).join(', ');
    const more = stale.length > 5 ? ` and ${stale.length - 5} more` : '';
    flags.push(`${stale.length} active code(s) older than ${STALE_DAYS} days — oldest: ${oldest}${more}. Review for expiry.`);
  }
  for (const article of withCode) {
    const record = tracked.get(article.code);
    if (record && record.expired && article.date && daysSince(article.date) <= ACTIONABLE_DAYS) {
      flags.push(`\`${article.code}\` is marked expired but the publisher shipped it on ${article.date}.`);
    }
  }

  const changed = added.length > 0 || dateFixed.length > 0;
  if (changed) {
    codesData.updated = args.today;
    codesData.seoMonth = args.today.slice(0, 7);
  }

  const openCandidates = candidatesData.candidates.filter((c) => c.status === 'pending').slice(-MAX_PENDING);
  const keptHistory = candidatesData.candidates.filter((c) => {
    if (c.status === 'pending') return false;
    const stamp = c.addedAt || c.resolvedAt;
    return !stamp || daysSince(stamp) <= KEEP_ADDED_DAYS;
  });
  candidatesData.candidates = [...keptHistory, ...openCandidates];
  const candidatesChanged = JSON.stringify(candidatesData.candidates) !== candidatesBefore;
  if (candidatesChanged) candidatesData.updated = args.today;

  if (!args.dryRun) {
    if (changed) writeJson(codesPath, codesData);
    if (candidatesChanged) writeJson(candidatesPath, candidatesData);
  }

  const report = buildReport({
    today: args.today,
    articles: articles.length,
    failures: failures.length,
    withCode: withCode.length,
    llm,
    added,
    dateFixed,
    pending: openCandidates,
    flags,
  });

  if (args.reportPath) fs.writeFileSync(args.reportPath, report, 'utf8');
  if (args.summaryPath) {
    writeJson(args.summaryPath, {
      date: args.today,
      official: { articles: articles.length, withCode: withCode.length, failures: failures.length },
      llm,
      added: added.map((a) => a.code),
      dateFixed: dateFixed.map((a) => a.code),
      pending: openCandidates.map((p) => p.code),
      flags: flags.length,
    });
  }

  console.log(report);
  if (args.dryRun) console.log('(dry run — no files written)');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`harvest-codes failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildCodeEntry,
  decide,
  describeReward,
  findReward,
  htmlToText,
  insertActiveCode,
  isSafeUrl,
  main,
  parseArgs,
  verifyCandidate,
};
