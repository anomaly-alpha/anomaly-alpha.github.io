'use strict';

const assert = require('assert');
const { dateFromSlug } = require('../scripts/lib/patch-notes');
const { extractJson, mergeSourceUrls, discoverCodes } = require('../scripts/lib/gemini');
const {
  buildCodeEntry,
  decide,
  findReward,
  htmlToText,
  insertActiveCode,
  isSafeUrl,
  verifyCandidate,
} = require('../scripts/harvest-codes');

// ===== publisher slugs =====

assert.strictEqual(
  dateFromSlug('patch-notes-game-update-3-8-18-nov-26'),
  '2026-11-18',
  'two-digit year slugs must parse',
);
assert.strictEqual(
  dateFromSlug('patch-notes-game-update-3-7-20-oct-2026'),
  '2026-10-20',
  'four-digit year slugs must parse',
);
assert.strictEqual(
  dateFromSlug('patch-notes-version-2-10-07-10-25'),
  '2025-10-07',
  'numeric version slugs must parse',
);
assert.strictEqual(dateFromSlug('patch-notes-1-3-10-hotfix-18-07-24'), '2024-07-18', 'hotfix slugs must parse');
assert.strictEqual(dateFromSlug('patch-notes-multiverse-arena-02-12-24'), '2024-12-02', 'arena slugs must parse');

// ===== reward parsing =====

const gems = findReward('RAC3R8 — Redeem for 500 Gems before it expires.', 'RAC3R8');
assert.ok(gems, 'a code with a gem reward must be found');
assert.strictEqual(gems.gems, 500);
assert.strictEqual(gems.tickets, 0);

const commas = findReward('CODE1: 1,000 Gems + 3 Equipment Tickets', 'CODE1');
assert.ok(commas);
assert.strictEqual(commas.gems, 1000);
assert.strictEqual(commas.tickets, 3);
assert.strictEqual(commas.item, null, 'equipment tickets are a ticket reward, not an item');

const itemAndGems = findReward('CODE3: 500 Gems + 2 x Gold Dossiers', 'CODE3');
assert.ok(itemAndGems);
assert.strictEqual(itemAndGems.gems, 500);
assert.strictEqual(itemAndGems.item, '2 x Gold Dossiers');

const hero = findReward('SPRACE gives 1 x Space Racer for free.', 'SPRACE');
assert.ok(hero);
assert.strictEqual(hero.gems, 0);
assert.strictEqual(hero.item, '1 x Space Racer');

const noItemFalsePositive = findReward('SAVE37: 500 x Gems', 'SAVE37');
assert.ok(noItemFalsePositive);
assert.strictEqual(noItemFalsePositive.item, null, 'gems must not be parsed as an item reward');

assert.strictEqual(findReward('nothing here', 'MISSING'), null, 'absent codes must not match');
assert.strictEqual(findReward('XCODE1 500 Gems', 'CODE1'), null, 'substrings must not match');

// ===== publication rules =====

const official = { date: '2026-11-18', url: 'https://ubisoft.example/faq/1' };
const verified = { reward: { gems: 500, tickets: 0 }, ambiguous: false, itemReward: null, codeSeen: true };

assert.strictEqual(decide({ official, verification: verified }).action, 'add', 'dated + verified reward publishes');
assert.strictEqual(
  decide({ official: null, verification: verified }).action,
  'queue',
  'web-only codes never publish without a publisher date',
);
assert.strictEqual(
  decide({ official: { date: null }, verification: verified }).action,
  'queue',
  'undated publisher articles never publish',
);
assert.strictEqual(
  decide({ official, verification: { reward: null, ambiguous: true, itemReward: null } }).action,
  'queue',
  'disagreeing sources never publish',
);
assert.strictEqual(
  decide({ official, verification: { reward: null, ambiguous: false, itemReward: '1 x Space Racer' } }).action,
  'queue',
  'item rewards wait for a human',
);
assert.strictEqual(
  decide({ official, verification: { reward: { gems: 500, tickets: 0 }, ambiguous: false, itemReward: '2 x Gold Dossiers' } })
    .action,
  'queue',
  'mixed rewards wait for a human rather than understating the reward',
);
assert.strictEqual(
  decide({ official, verification: { reward: null, ambiguous: false, itemReward: null } }).action,
  'queue',
  'an unverified reward never publishes',
);

const entry = buildCodeEntry({ code: 'RAC3R8', official, verification: verified });
assert.deepStrictEqual(entry, {
  code: 'RAC3R8',
  gems: 500,
  tickets: 0,
  tier: 'HIGH',
  dateAdded: '2026-11-18',
});

const list = [
  { code: 'PIN1', position: 1, dateAdded: '2026-10-01' },
  { code: 'PIN2', position: 2, dateAdded: '2026-09-01' },
  { code: 'GONE', position: 1, expired: true, dateAdded: '2025-01-01' },
  { code: 'FREE', dateAdded: '2026-08-01' },
];
insertActiveCode(list, entry);
assert.strictEqual(list[0].code, 'RAC3R8', 'a new code is inserted at the top of the file');
assert.strictEqual(list[0].position, 1, 'a new code leads the page');
assert.strictEqual(list[1].position, 2, 'pinned positions shift down');
assert.strictEqual(list[2].position, 3, 'pinned relative order is preserved');
assert.strictEqual(list[3].position, 1, 'expired codes keep their position');
assert.strictEqual(list[4].position, undefined, 'unpositioned codes stay unpositioned');

// ===== URL safety =====

assert.strictEqual(isSafeUrl('https://www.pockettactics.com/invincible-guarding-the-globe-codes'), true);
assert.strictEqual(isSafeUrl('http://localhost:3000/codes'), false, 'localhost must be blocked');
assert.strictEqual(isSafeUrl('http://127.0.0.1/codes'), false, 'loopback must be blocked');
assert.strictEqual(isSafeUrl('http://192.168.1.10/codes'), false, 'private ranges must be blocked');
assert.strictEqual(isSafeUrl('https://anomaly-alpha.github.io/codes'), false, 'the site itself is not evidence');
assert.strictEqual(isSafeUrl('ftp://example.com/codes'), false, 'only http(s) is fetchable');
assert.strictEqual(isSafeUrl('https://example.com:8080/codes'), false, 'non-standard ports must be blocked');
assert.strictEqual(isSafeUrl('not a url'), false);

// ===== model output =====

assert.deepStrictEqual(extractJson('```json\n{"codes":[]}\n```'), { codes: [] });
assert.deepStrictEqual(extractJson('Here you go: {"codes":[{"code":"ABC1"}]} — done'), {
  codes: [{ code: 'ABC1' }],
});
assert.deepStrictEqual(extractJson('[{"code":"ABC1"}]'), { codes: [{ code: 'ABC1' }] });
assert.throws(() => extractJson('no json at all'), /no JSON object/);
assert.throws(() => extractJson(''), /empty model response/);

assert.deepStrictEqual(
  mergeSourceUrls(['https://a.example/codes'], ['https://b.example/codes', 'https://a.example/codes']),
  ['https://a.example/codes', 'https://b.example/codes'],
  'claimed URLs keep priority and annotations are appended without duplicates',
);
assert.deepStrictEqual(mergeSourceUrls(undefined, ['https://b.example/codes']), ['https://b.example/codes']);
assert.deepStrictEqual(mergeSourceUrls(['https://a.example/codes'], null), ['https://a.example/codes']);

// ===== html =====

const text = htmlToText('<html><script>alert(1)</script><style>.x{}</style><p>500 &amp; Gems</p></html>');
assert.strictEqual(text, '500 & Gems', 'scripts, styles and tags must be stripped');

// ===== verification over stubbed pages =====

(async () => {
  const pages = {
    'https://official.example/faq/1': '<p>Reward Code: ABCDE</p>',
    'https://agg-one.example/codes': '<p>ABCDE — 500 Gems</p>',
    'https://agg-two.example/codes': '<p>ABCDE — 300 Gems</p>',
    'https://both-one.example/codes': '<p>ABCDE — 500 Gems + 3 Equipment Tickets</p>',
    'https://both-two.example/codes': '<p>ABCDE — 500 Gems + 3 Equipment Tickets</p>',
    'https://mixed.example/codes': '<p>ABCDE — 500 Gems + 2 x Gold Dossiers</p>',
    'https://empty.example/codes': '<p>No codes today.</p>',
  };
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const body = pages[url] || '';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    };
  };

  try {
    const single = await verifyCandidate({
      code: 'ABCDE',
      official: { url: 'https://official.example/faq/1' },
      llm: { sourceUrls: ['https://agg-one.example/codes'] },
    });
    assert.strictEqual(single.codeSeen, true);
    assert.deepStrictEqual(single.reward, { gems: 500, tickets: 0 });
    assert.strictEqual(single.ambiguous, false);

    const both = await verifyCandidate({
      code: 'ABCDE',
      official: { url: 'https://official.example/faq/1' },
      llm: { sourceUrls: ['https://agg-one.example/codes', 'https://agg-two.example/codes'] },
    });
    assert.strictEqual(both.ambiguous, true, 'disagreeing rewards must be ambiguous');
    assert.strictEqual(both.reward, null);

    const combined = await verifyCandidate({
      code: 'ABCDE',
      official: null,
      llm: { sourceUrls: ['https://both-one.example/codes', 'https://both-two.example/codes'] },
    });
    assert.deepStrictEqual(combined.reward, { gems: 500, tickets: 3 }, 'gems and tickets may ship together');
    assert.strictEqual(combined.ambiguous, false, 'identical combined rewards are not a disagreement');

    const mixed = await verifyCandidate({
      code: 'ABCDE',
      official: null,
      llm: { sourceUrls: ['https://mixed.example/codes'] },
    });
    assert.deepStrictEqual(mixed.reward, { gems: 500, tickets: 0 });
    assert.strictEqual(mixed.itemReward, '2 x Gold Dossiers');

    const missing = await verifyCandidate({
      code: 'ZZZZZ',
      official: { url: 'https://official.example/faq/1' },
      llm: { sourceUrls: ['https://agg-one.example/codes'] },
    });
    assert.strictEqual(missing.codeSeen, false, 'a code absent from every page is not verified');

    const blocked = await verifyCandidate({
      code: 'ABCDE',
      official: null,
      llm: { sourceUrls: ['http://127.0.0.1/codes'] },
    });
    assert.strictEqual(blocked.results.length, 0, 'private URLs are never fetched');

    // The Interactions response puts citations on the text block, not in the JSON body.
    global.fetch = async (url) => {
      assert.ok(String(url).includes('/v1beta/interactions'), 'the client must call the documented endpoint');
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ codes: [{ code: 'NEWC0DE', reward: '500 Gems', sourceUrls: [] }] }),
                  annotations: [{ type: 'url_citation', url: 'https://cited.example/codes' }],
                },
              ],
            },
          ],
        }),
      };
    };
    const discovered = await discoverCodes({ apiKey: 'dummy', today: '2026-11-19' });
    assert.strictEqual(discovered.codes.length, 1);
    assert.deepStrictEqual(
      discovered.codes[0].sourceUrls,
      ['https://cited.example/codes'],
      'annotation citations must fill in missing source URLs',
    );

    // Gemini 2.5 may reject response_format combined with tools; the client must
    // retry once without the schema instead of dropping the web-search step.
    let attempts = 0;
    global.fetch = async (url, options) => {
      attempts += 1;
      const body = JSON.parse(options.body);
      if (body.response_format) {
        return {
          ok: false,
          status: 400,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              error: { message: 'response_format is not supported with tools', status: 'INVALID_ARGUMENT' },
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ codes: [{ code: 'FALLB4CK', reward: '500 Gems', sourceUrls: [] }] }),
                },
              ],
            },
          ],
        }),
      };
    };
    const fallback = await discoverCodes({ apiKey: 'dummy', today: '2026-11-19' });
    assert.strictEqual(fallback.codes.length, 1);
    assert.strictEqual(attempts, 2, 'a 400 must retry exactly once without response_format');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('Harvest-code tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
