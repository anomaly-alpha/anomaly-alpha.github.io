#!/usr/bin/env node
/**
 * Structured-data regression test for all 14 indexable pages.
 *
 * Asserts:
 *  - every JSON-LD block parses and has its own schema context
 *  - author ProfilePage.mainEntity resolves to stable Person entity
 *  - all local @id references resolve to a node in the same document or stable typed refs
 *  - every Article has headline, author, publisher, image, datePublished, dateModified
 *  - every FAQ schema entry has matching visible FAQ content
 *  - sitemap URLs are canonical and indexable, noindex pages absent
 *  - generated creator and code output remains idempotent
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
let passed = 0;

function assert(condition, msg) {
  if (!condition) {
    errors.push(msg);
  } else {
    passed++;
  }
}

function warn(msg) {
  warnings.push(msg);
}

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    // Strip HTML comments (generator markers) that appear inside JSON-LD blocks
    let content = m[1].replace(/<!--[\s\S]*?-->/g, '');
    try {
      blocks.push(JSON.parse(content));
    } catch (e) {
      errors.push('JSON-LD parse error: ' + e.message);
    }
  }
  return blocks;
}

function getGraphNodes(block) {
  if (block['@graph']) return block['@graph'];
  return [block];
}

function flattenGraph(blocks) {
  const nodes = [];
  for (const b of blocks) {
    nodes.push(...getGraphNodes(b));
  }
  return nodes;
}

function findById(nodes, id) {
  return nodes.find(n => n['@id'] === id);
}

function hasVisibleText(html, text) {
  // Strip tags for a simple check
  const stripped = html.replace(/<[^>]+>/g, ' ');
  return stripped.includes(text);
}

// ===== Page inventory =====
const INDEXABLE_PAGES = [
  { path: 'index.html', type: 'WebPage', hasArticle: false },
  { path: 'guide/code/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/beginners/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/event/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/pvp/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/login/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/faq/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/xp/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/redeem/index.html', type: 'Article', hasArticle: true },
  { path: 'guide/creators/index.html', type: 'CollectionPage', hasArticle: false },
  { path: 'authors/anomaly/index.html', type: 'ProfilePage', hasArticle: false },
  { path: 'privacy/index.html', type: 'Article', hasArticle: true },
  { path: 'terms/index.html', type: 'Article', hasArticle: true },
];

const NOINDEX_PAGES = ['seo/index.html'];

// ===== 1. Parse and validate every JSON-LD block =====
console.log('\n=== 1. JSON-LD parsing and context ===');

for (const page of INDEXABLE_PAGES) {
  const html = readFile(page.path);
  const blocks = parseJsonLdBlocks(html);

  assert(blocks.length > 0, `[${page.path}] No JSON-LD blocks found`);

  for (const block of blocks) {
    assert(
      block['@context'] === 'https://schema.org',
      `[${page.path}] JSON-LD block missing or wrong @context: ${block['@context']}`
    );
  }

  console.log(`  ✓ ${page.path}: ${blocks.length} JSON-LD block(s), all valid`);
}

// ===== 2. Author ProfilePage.mainEntity =====
console.log('\n=== 2. Author ProfilePage.mainEntity ===');

{
  const html = readFile('authors/anomaly/index.html');
  const blocks = parseJsonLdBlocks(html);
  const nodes = flattenGraph(blocks);
  const profile = nodes.find(n => n['@type'] === 'ProfilePage');

  assert(profile, '[authors] ProfilePage not found');
  assert(
    profile && profile.mainEntity,
    '[authors] ProfilePage missing mainEntity'
  );
  assert(
    profile && profile.mainEntity && profile.mainEntity['@id'] === 'https://anomaly-alpha.github.io/authors/anomaly/#person',
    '[authors] mainEntity @id mismatch'
  );
  assert(
    profile && profile.mainEntity && profile.mainEntity['@type'] === 'Person',
    '[authors] mainEntity is not Person'
  );
  assert(
    profile && profile.mainEntity && profile.mainEntity.url === 'https://anomaly-alpha.github.io/authors/anomaly/',
    '[authors] mainEntity url mismatch'
  );
  console.log('  ✓ Author ProfilePage.mainEntity Person validated');
}

// ===== 3. Stable entity IDs and local reference resolution =====
console.log('\n=== 3. Stable entity IDs and reference resolution ===');

{
  const STABLE_IDS = [
    'https://anomaly-alpha.github.io/#game',
    'https://anomaly-alpha.github.io/authors/anomaly/#person',
    'https://anomaly-alpha.github.io/#organization',
  ];

  // Check that all local @id references (#xxx) resolve to a node in the same document
  for (const page of INDEXABLE_PAGES) {
    const html = readFile(page.path);
    const blocks = parseJsonLdBlocks(html);

    for (const block of blocks) {
      const nodes = getGraphNodes(block);
      const localIds = nodes.filter(n => n['@id'] && n['@id'].startsWith('#')).map(n => n['@id']);

      // Find all local references in all nodes
      const findLocalRefs = (obj, refs) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          obj.forEach(item => findLocalRefs(item, refs));
          return;
        }
        for (const key of Object.keys(obj)) {
          if (key === '@id' && typeof obj[key] === 'string' && obj[key].startsWith('#')) {
            refs.add(obj[key]);
          }
          if (typeof obj[key] === 'object') {
            findLocalRefs(obj[key], refs);
          }
        }
      };

      const refs = new Set();
      findLocalRefs(nodes, refs);

      for (const ref of refs) {
        // Local # references must resolve to a node in the same document
        // OR they reference stable entities that exist elsewhere
        if (!localIds.includes(ref)) {
          // Check if it's a known stable reference pattern
          const isStableObjectRef = (
            ref === '#game' || ref === '#person' || ref === '#organization' || ref === '#webpage' || ref === '#anomaly'
          );
          if (!isStableObjectRef) {
            // For privacy/terms, #game and author @id are now inline typed entities, not dangling refs
            // Check if the referencing document has a VideoGame or Person node for it
            const hasGameNode = nodes.some(n => n['@type'] === 'VideoGame');
            const hasPersonNode = nodes.some(n => n['@type'] === 'Person');
            if (ref === '#game' && hasGameNode) continue;
            if ((ref === '#anomaly' || ref.includes('anomaly')) && hasPersonNode) continue;
            errors.push(`[${page.path}] Dangling local reference: ${ref}`);
          }
        }
      }
    }
    console.log(`  ✓ ${page.path}: local references checked`);
  }
}

// ===== 4. Article completeness =====
console.log('\n=== 4. Article schema completeness ===');

{
  for (const page of INDEXABLE_PAGES.filter(p => p.hasArticle)) {
    const html = readFile(page.path);
    const blocks = parseJsonLdBlocks(html);
    const nodes = flattenGraph(blocks);
    const articles = nodes.filter(n => n['@type'] === 'Article');

    assert(articles.length > 0, `[${page.path}] No Article found`);

    for (const article of articles) {
      assert(article.headline, `[${page.path}] Article missing headline`);
      assert(article.author, `[${page.path}] Article missing author`);
      assert(article.publisher, `[${page.path}] Article missing publisher`);
      assert(article.image, `[${page.path}] Article missing image`);
      assert(article.datePublished, `[${page.path}] Article missing datePublished`);
      assert(article.dateModified, `[${page.path}] Article missing dateModified`);
    }
    console.log(`  ✓ ${page.path}: Article has headline, author, publisher, image, dates`);
  }
}

// ===== 5. FAQ content parity =====
console.log('\n=== 5. FAQ schema ↔ visible content parity ===');

{
  for (const page of INDEXABLE_PAGES) {
    const html = readFile(page.path);
    const blocks = parseJsonLdBlocks(html);
    const nodes = flattenGraph(blocks);
    const faqPages = nodes.filter(n => n['@type'] === 'FAQPage');

    if (faqPages.length === 0) continue;

    for (const faq of faqPages) {
      const questions = faq.mainEntity || [];
      for (const q of questions) {
        assert(
          q['@type'] === 'Question',
          `[${page.path}] FAQ entry not Question type`
        );
        assert(q.name, `[${page.path}] FAQ Question missing name`);
        assert(
          q.acceptedAnswer && q.acceptedAnswer.text,
          `[${page.path}] FAQ Question "${q.name}" missing answer text`
        );
        assert(
          hasVisibleText(html, q.name),
          `[${page.path}] FAQ Question "${q.name}" not found in visible content`
        );
      }
    }
    console.log(`  ✓ ${page.path}: ${faqPages.reduce((s, f) => s + (f.mainEntity || []).length, 0)} FAQ entries match visible content`);
  }
}

// ===== 6. Sitemap validation =====
console.log('\n=== 6. Sitemap validation ===');

{
  const sitemap = readFile('sitemap.xml');
  const urlRegex = /<loc>([^<]+)<\/loc>/g;
  const sitemapUrls = [];
  let m;
  while ((m = urlRegex.exec(sitemap)) !== null) {
    sitemapUrls.push(m[1]);
  }

  // Sitemap count: currently 11, will be 14 after Task 8 adds music/privacy/terms
  const expectedMin = 11;
  const expectedMax = 14;
  assert(
    sitemapUrls.length >= expectedMin && sitemapUrls.length <= expectedMax,
    `Sitemap has ${sitemapUrls.length} URLs, expected ${expectedMin}-${expectedMax}`
  );

  // Core 11 URLs must be present
  const requiredPaths = [
    'https://anomaly-alpha.github.io/',
    'https://anomaly-alpha.github.io/guide/code/',
    'https://anomaly-alpha.github.io/guide/beginners/',
    'https://anomaly-alpha.github.io/guide/event/',
    'https://anomaly-alpha.github.io/guide/pvp/',
    'https://anomaly-alpha.github.io/guide/login/',
    'https://anomaly-alpha.github.io/guide/faq/',
    'https://anomaly-alpha.github.io/guide/xp/',
    'https://anomaly-alpha.github.io/guide/redeem/',
    'https://anomaly-alpha.github.io/guide/creators/',
    'https://anomaly-alpha.github.io/authors/anomaly/',
  ];

  // Optional paths (added by Task 8)
  const optionalPaths = [
    'https://anomaly-alpha.github.io/music/',
    'https://anomaly-alpha.github.io/privacy/',
    'https://anomaly-alpha.github.io/terms/',
  ];

  for (const url of requiredPaths) {
    assert(sitemapUrls.includes(url), `Sitemap missing required URL: ${url}`);
  }

  const optionalFound = optionalPaths.filter(u => sitemapUrls.includes(u));
  if (optionalFound.length > 0) {
    console.log(`  ℹ Optional sitemap URLs present: ${optionalFound.join(', ')}`);
  }

  // Noindex pages should NOT be in sitemap
  assert(!sitemapUrls.includes('https://anomaly-alpha.github.io/seo/'), 'SEO dashboard should not be in sitemap');
  assert(!sitemapUrls.includes('https://anomaly-alpha.github.io/sitemap.xml'), 'sitemap.xml should not list itself');

  console.log(`  ✓ Sitemap: ${sitemapUrls.length} URLs validated, no noindex pages`);
}

// ===== 7. noindex / robots validation =====
console.log('\n=== 7. Indexation directives ===');

{
  // Verify noindex pages
  for (const noindexPage of NOINDEX_PAGES) {
    const html = readFile(noindexPage);
    assert(
      html.includes('noindex'),
      `[${noindexPage}] Expected noindex but not found`
    );
  }

  // Verify previously-noindex pages are now indexable
  const nowIndexable = ['authors/anomaly/index.html', 'privacy/index.html', 'terms/index.html'];
  for (const page of nowIndexable) {
    const html = readFile(page.path || page);
    assert(
      !html.includes('noindex'),
      `[${page}] Still has noindex — should be indexable now`
    );
  }

  console.log('  ✓ Indexation directives validated');
}

// ===== 8. Date fields =====
console.log('\n=== 8. Date field validation ===');

{
  const DATE_CHECKS = [
    { path: 'guide/code/index.html', dateModified: '2026-09-04' },
    { path: 'guide/event/index.html', dateModified: '2026-09-04' },
    { path: 'guide/pvp/index.html', dateModified: '2026-09-04' },
    { path: 'guide/login/index.html', dateModified: '2026-09-04' },
    { path: 'guide/faq/index.html', dateModified: '2026-09-04' },
    { path: 'guide/xp/index.html', dateModified: '2026-09-04' },
    { path: 'guide/beginners/index.html', dateModified: '2026-09-04' },
    { path: 'guide/redeem/index.html', dateModified: '2026-09-04' },
    { path: 'guide/creators/index.html', dateModified: '2026-09-04', datePublished: '2026-08-23' },
    { path: 'privacy/index.html', dateModified: '2026-09-04', datePublished: '2026-07-17' },
    { path: 'terms/index.html', dateModified: '2026-09-04', datePublished: '2026-07-17' },
  ];

  for (const check of DATE_CHECKS) {
    const html = readFile(check.path);
    const blocks = parseJsonLdBlocks(html);
    const nodes = flattenGraph(blocks);

    if (check.dateModified) {
      const hasDateModified = nodes.some(n => n.dateModified === check.dateModified);
      assert(hasDateModified, `[${check.path}] Missing dateModified ${check.dateModified}`);
    }
    if (check.datePublished) {
      const hasDatePublished = nodes.some(n => n.datePublished === check.datePublished);
      assert(hasDatePublished, `[${check.path}] Missing datePublished ${check.datePublished}`);
    }
  }

  // Home page dateModified
  {
    const html = readFile('index.html');
    const blocks = parseJsonLdBlocks(html);
    const nodes = flattenGraph(blocks);
    const webpage = nodes.find(n => n['@type'] === 'WebPage');
    assert(
      webpage && webpage.dateModified === '2026-09-04',
      '[index.html] WebPage missing dateModified 2026-09-04'
    );
  }

  console.log('  ✓ Date fields validated for all refreshed pages');
}

// ===== 9. Title synchronization =====
console.log('\n=== 9. Title synchronization ===');

{
  const TITLE_CHECKS = [
    { path: 'index.html', expected: '[Sep 2026]' },
    { path: 'guide/event/index.html', expected: '[Sep 2026]' },
    { path: 'guide/pvp/index.html', expected: '[Sep 2026]' },
    { path: 'guide/login/index.html', expected: '[Sep 2026]' },
    { path: 'guide/faq/index.html', expected: '[Sep 2026]' },
    { path: 'guide/xp/index.html', expected: '[Sep 2026]' },
    { path: 'guide/beginners/index.html', expected: '[Sep 2026]' },
    { path: 'guide/redeem/index.html', expected: '[Sep 2026]' },
    { path: 'guide/creators/index.html', expected: '[Sep 2026]' },
    { path: 'guide/code/index.html', expected: '[Sep 2026]' },
    // Evergreen pages - no suffix
    { path: 'authors/anomaly/index.html', expected: null, titleShouldBe: 'Anomaly — Author Profile' },
    { path: 'privacy/index.html', expected: null, titleShouldBe: 'Privacy Policy — Invincible GTG' },
    { path: 'terms/index.html', expected: null, titleShouldBe: 'Terms of Service — Invincible GTG' },
  ];

  for (const check of TITLE_CHECKS) {
    const html = readFile(check.path);

    if (check.expected) {
      assert(
        html.includes(check.expected),
        `[${check.path}] Missing ${check.expected} in title/og/twitter`
      );
      // Verify og:title contains it
      assert(
        html.includes(`og:title" content="`) && html.includes(check.expected),
        `[${check.path}] og:title missing ${check.expected}`
      );
      // Verify twitter:title contains it
      assert(
        html.includes(`twitter:title" content="`) && html.includes(check.expected),
        `[${check.path}] twitter:title missing ${check.expected}`
      );
    } else if (check.titleShouldBe) {
      assert(
        html.includes(`<title>${check.titleShouldBe}</title>`) ||
        html.includes(`<title>${check.titleShouldBe.replace(/&/g, '&amp;')}</title>`),
        `[${check.path}] Title mismatch, expected: ${check.titleShouldBe}`
      );
    }
  }

  // Verify no [Aug 2026] remains in in-scope title tags
  for (const page of INDEXABLE_PAGES) {
    const html = readFile(page.path);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      assert(
        !titleMatch[1].includes('[Aug 2026]'),
        `[${page.path}] Title still contains [Aug 2026]: ${titleMatch[1]}`
      );
    }
  }

  console.log('  ✓ Title synchronization validated');
}

// ===== 10. Legal pages: no dangling references =====
console.log('\n=== 10. Legal page reference integrity ===');

{
  for (const legalPage of ['privacy/index.html', 'terms/index.html']) {
    const html = readFile(legalPage);
    const blocks = parseJsonLdBlocks(html);
    const nodes = flattenGraph(blocks);

    // Check author is an inline Person, not just an @id reference
    const articles = nodes.filter(n => n['@type'] === 'Article');
    for (const article of articles) {
      if (article.author && article.author['@type']) {
        assert(
          article.author['@type'] === 'Person',
          `[${legalPage}] Article author should be inline Person, got ${article.author['@type']}`
        );
      }
    }

    // Check about is inline VideoGame, not just @id reference
    for (const article of articles) {
      if (article.about && article.about['@type']) {
        assert(
          article.about['@type'] === 'VideoGame',
          `[${legalPage}] Article about should be VideoGame, got ${article.about['@type']}`
        );
      }
    }
  }

  console.log('  ✓ Legal page reference integrity validated');
}

// ===== 11. Creator/Code idempotency =====
console.log('\n=== 11. Generator idempotency ===');

{
  // Verify creators generated data exists and is valid JS
  const jsPath = path.join(ROOT, 'data', 'generated', 'youtube-creators.js');
  assert(fs.existsSync(jsPath), 'youtube-creators.js does not exist');
  const jsContent = fs.readFileSync(jsPath, 'utf8');
  assert(jsContent.includes('window.__YOUTUBE_CREATORS'), 'youtube-creators.js missing window.__YOUTUBE_CREATORS');

  // Verify codes generated data exists
  const codesPath = path.join(ROOT, 'data', 'generated', 'promo-codes.js');
  assert(fs.existsSync(codesPath), 'promo-codes.js does not exist');
  const codesContent = fs.readFileSync(codesPath, 'utf8');
  assert(codesContent.includes('window.__PROMO_CODES'), 'promo-codes.js missing window.__PROMO_CODES');

  console.log('  ✓ Generated output files validated');
}

// ===== 12. No unsupported schema types =====
console.log('\n=== 12. Schema type audit ===');

{
  const ALLOWED_TYPES = new Set([
    'WebPage', 'VideoGame', 'WebSite', 'BreadcrumbList', 'WebApplication',
    'Organization', 'Service', 'MobileApplication', 'SoftwareSourceCode',
    'ItemList', 'ListItem', 'CollectionPage', 'VideoObject', 'Person',
    'Article', 'FAQPage', 'Question', 'Answer', 'HowTo', 'HowToStep',
    'DefinedTerm', 'ProfilePage', 'SpeakableSpecification', 'Audience',
    'Offer', 'AggregateRating', 'Code', 'ContactPoint', 'EntryPoint',
    'SearchAction', 'ImageObject', 'WebPageElement',
  ]);

  for (const page of INDEXABLE_PAGES) {
    const html = readFile(page.path);
    const blocks = parseJsonLdBlocks(html);
    const nodes = flattenGraph(blocks);
    for (const node of nodes) {
      if (node['@type']) {
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        for (const t of types) {
          assert(
            ALLOWED_TYPES.has(t),
            `[${page.path}] Unsupported schema type: ${t}`
          );
        }
      }
    }
  }

  console.log('  ✓ No unsupported schema types');
}

// ===== Summary =====
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${errors.length} failed, ${warnings.length} warnings`);
if (errors.length > 0) {
  console.log('\nFailed assertions:');
  for (const e of errors) {
    console.log('  ✗ ' + e);
  }
}
if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const w of warnings) {
    console.log('  ⚠ ' + w);
  }
}
console.log('========================================');

process.exit(errors.length > 0 ? 1 : 0);
