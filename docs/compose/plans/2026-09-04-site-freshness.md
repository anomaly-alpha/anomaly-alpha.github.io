# September 2026 Site Freshness Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Refresh the public Invincible GTG site’s codes, creators, guide/policy copy, SEO metadata, indexation, dates, and structured data for the 2026-09-04 snapshot.

**Architecture:** Keep JSON source files authoritative and regenerate every derived page from its existing generator. Add one lightweight static structured-data regression test, use stable absolute schema IDs, and finish with a site-wide indexability/freshness/browser audit.

**Tech Stack:** Static HTML, vanilla JavaScript, JSON source data, Node.js custom tests, existing code/creator/music generators, Tavily search/extract, Playwright browser inspection, Tailwind build, and Lighthouse.

## Global Constraints

- Edit only data/codes.json for promo-code records; generated code bundles and page sections must come from npm run update-codes.
- Edit only data/youtube-creators.json for creator/video records; generated creator outputs must come from npm run generate-creators.
- Use 2026-09-04 as the refresh snapshot; preserve every page’s original datePublished.
- Add the exact supplied RAID02 record; do not substitute RAID26.
- Use Tavily for discovery, but publish only facts verified by direct first-party or corroborated sources.
- Rewrite prose, headings, FAQs, examples, and policy copy; preserve calculators, JavaScript behavior, inline configs, payout tables, and numeric data unless verified evidence requires a correction.
- Every JSON-LD block must independently include the schema.org context and parse as JSON.
- Use stable absolute IDs for the game, Anomaly Person, and Anomaly Alpha Organization.
- FAQPage entries must match visible FAQ content on the same page.
- Keep seo/ and skarn-bot/ out of the public freshness rewrite.
- Do not add YouTube Shorts or unverifiable creator/video records.
- Never claim legal compliance merely because automated checks pass.
- Do not hand-edit generated outputs as the durable source of a change.
- Follow the repository rule to run npm run build and the full Lighthouse audit after major HTML/CSS/JS changes.

---

### Task 1: Research ledger and content inventory

**Covers:** S1, S4, S5, S6, S7

**Files:**
- Create: docs/reports/2026-09-04/unknown/site-freshness-evidence.md
- Read: data/codes.json
- Read: data/youtube-creators.json
- Read: data/playlists.json
- Read: all nine /guide/*/index.html files, index.html, authors/anomaly/index.html, music/index.html, privacy/index.html, terms/index.html, sitemap.xml, CHANGELOG.md

**Interfaces:**
- Consumes: current source JSON, current HTML copy/schema, Tavily search and extraction results.
- Produces: a populated evidence ledger and a page/title/content inventory consumed by Tasks 2–8.

- [ ] **Step 1: Create the evidence ledger with complete columns**

Use this exact Markdown structure and populate every row before changing source or page files:

    # September 2026 Site Freshness Evidence
    Snapshot: 2026-09-04

    | Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
    | --- | --- | --- | --- | --- | --- | --- | --- |

Include rows for each changed code, creator/video record, guide fact, policy fact, title, indexability change, and schema repair. A row with no changed value records a reviewed-and-retained disposition.

- [ ] **Step 2: Search current code and game facts with Tavily**

Use tavily_tavily-search for these query families and record the result URLs before using tavily_tavily-extract on selected pages:

    Invincible Guarding the Globe RAID02 Bulletproof Powerplex code
    Invincible Guarding the Globe active promo codes September 2026
    site:ubisoft.com Invincible Guarding the Globe redeem codes
    Invincible Guarding the Globe current event rewards September 2026
    Invincible Guarding the Globe PvP arena payouts current
    Invincible Guarding the Globe login rewards current
    Invincible Guarding the Globe XP hero rank costs current

Prefer official Ubisoft/game/redemption sources. Use multiple reputable community sources only for strategy or interpretation that official sources do not document.

- [ ] **Step 3: Search and extract creator/video evidence**

For every visible creator and candidate source, verify the direct YouTube channel/video page, identity, standard-video format, title, published date, canonical URL, and availability. Record rejected Shorts and unresolved records with their reason; do not promote a record from a search snippet alone.

- [ ] **Step 4: Build the page/title inventory**

For each in-scope page, record current title, canonical, robots directive, visible freshness text, JSON-LD types, datePublished/dateModified values, and proposed primary search intent. Mark whether the page receives a prose rewrite, schema change, indexability change, or only a reviewed-and-retained result.

- [ ] **Step 5: Commit the evidence artifact**

    git add docs/reports/2026-09-04/unknown/site-freshness-evidence.md
    git commit -m "docs: record September freshness evidence"

Expected result: the ledger is complete enough to explain every later data, prose, title, date, and schema change.

### Task 2: Add structured-data regression tests first

**Covers:** S8, S11

**Files:**
- Create: tests/structured-data.test.js
- Modify: package.json

**Interfaces:**
- Consumes: the 14 target page paths, their rendered/static JSON-LD blocks, sitemap.xml, and visible FAQ text.
- Produces: npm run test:structured-data, a nonzero exit code for schema/indexation drift, and a zero exit code for the completed refresh.

- [ ] **Step 1: Write the failing test harness**

Create tests/structured-data.test.js with Node built-ins only. The initial test must fail against the current repository because music has no JSON-LD, the author profile lacks mainEntity, the creator ItemList lacks a context, and noindex pages are absent from the target indexable set.

    'use strict';
    const assert = require('assert');
    const fs = require('fs');
    const path = require('path');

    const ROOT = path.resolve(__dirname, '..');
    const PAGES = [
      'index.html',
      'guide/code/index.html',
      'guide/beginners/index.html',
      'guide/event/index.html',
      'guide/pvp/index.html',
      'guide/login/index.html',
      'guide/faq/index.html',
      'guide/xp/index.html',
      'guide/redeem/index.html',
      'guide/creators/index.html',
      'authors/anomaly/index.html',
      'music/index.html',
      'privacy/index.html',
      'terms/index.html'
    ];

    function blocksFor(file) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
        .map(match => JSON.parse(match[1]));
    }

    const INDEXABLE = [
      'authors/anomaly/index.html',
      'music/index.html',
      'privacy/index.html',
      'terms/index.html'
    ];

    function nodesFor(blocks) {
      return blocks.flatMap(block => block['@graph'] || [block]);
    }

    function typesFor(nodes) {
      return nodes.flatMap(node => Array.isArray(node['@type']) ? node['@type'] : [node['@type']]);
    }

    for (const file of PAGES) {
      const blocks = blocksFor(file);
      assert(blocks.length > 0, file + ': expected JSON-LD');
      blocks.forEach((block, index) => {
        assert.strictEqual(block['@context'], 'https://schema.org', file + ' block ' + index + ': missing schema.org context');
      });
    }

    const authorNodes = nodesFor(blocksFor('authors/anomaly/index.html'));
    const profile = authorNodes.find(node => node['@type'] === 'ProfilePage');
    assert(profile && profile.mainEntity, 'author: ProfilePage.mainEntity is required');
    assert.strictEqual(profile.mainEntity['@type'], 'Person', 'author: mainEntity must be Person');
    assert.strictEqual(profile.mainEntity['@id'], 'https://anomaly-alpha.github.io/authors/anomaly/#person', 'author: Person ID must be stable');
    assert.strictEqual(profile.mainEntity.url, 'https://anomaly-alpha.github.io/authors/anomaly/', 'author: Person URL must be profile URL');

    const canonicalUrls = {
      'index.html': 'https://anomaly-alpha.github.io/',
      'guide/code/index.html': 'https://anomaly-alpha.github.io/guide/code/',
      'guide/beginners/index.html': 'https://anomaly-alpha.github.io/guide/beginners/',
      'guide/event/index.html': 'https://anomaly-alpha.github.io/guide/event/',
      'guide/pvp/index.html': 'https://anomaly-alpha.github.io/guide/pvp/',
      'guide/login/index.html': 'https://anomaly-alpha.github.io/guide/login/',
      'guide/faq/index.html': 'https://anomaly-alpha.github.io/guide/faq/',
      'guide/xp/index.html': 'https://anomaly-alpha.github.io/guide/xp/',
      'guide/redeem/index.html': 'https://anomaly-alpha.github.io/guide/redeem/',
      'guide/creators/index.html': 'https://anomaly-alpha.github.io/guide/creators/',
      'authors/anomaly/index.html': 'https://anomaly-alpha.github.io/authors/anomaly/',
      'music/index.html': 'https://anomaly-alpha.github.io/music/',
      'privacy/index.html': 'https://anomaly-alpha.github.io/privacy/',
      'terms/index.html': 'https://anomaly-alpha.github.io/terms/'
    };
    const requiredTypes = {
      'index.html': ['WebPage'],
      'guide/code/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'HowTo', 'FAQPage', 'DefinedTerm'],
      'guide/beginners/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
      'guide/event/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
      'guide/pvp/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
      'guide/login/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
      'guide/faq/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage', 'DefinedTerm'],
      'guide/xp/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'DefinedTerm'],
      'guide/redeem/index.html': ['BreadcrumbList', 'VideoGame', 'Article', 'FAQPage'],
      'guide/creators/index.html': ['CollectionPage', 'ItemList'],
      'authors/anomaly/index.html': ['ProfilePage'],
      'music/index.html': ['CollectionPage', 'BreadcrumbList', 'ItemList'],
      'privacy/index.html': ['Article'],
      'terms/index.html': ['Article']
    };
    for (const file of PAGES) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
      assert(canonical && canonical[1] === canonicalUrls[file], file + ': canonical URL mismatch');
      const types = typesFor(nodesFor(blocksFor(file)));
      for (const required of requiredTypes[file]) {
        assert(types.includes(required), file + ': missing expected ' + required);
      }
      for (const node of nodesFor(blocksFor(file))) {
        if (node['@type'] === 'VideoGame' && node.name === 'Invincible Guarding the Globe') {
          assert.strictEqual(node['@id'], 'https://anomaly-alpha.github.io/#game', file + ': game ID must be stable');
        }
        if (node['@type'] === 'Organization' && node.name === 'Anomaly Alpha') {
          assert.strictEqual(node['@id'], 'https://anomaly-alpha.github.io/#organization', file + ': organization ID must be stable');
        }
      }
    }

    for (const file of PAGES) {
      for (const node of nodesFor(blocksFor(file)).filter(node => node['@type'] === 'Article')) {
        ['headline', 'author', 'publisher', 'image', 'datePublished', 'dateModified'].forEach(key => {
          assert(node[key], file + ': Article missing ' + key);
        });
      }
    }

    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    ['/music/', '/privacy/', '/terms/', '/authors/anomaly/'].forEach(url => {
      assert(sitemap.includes('https://anomaly-alpha.github.io' + url), 'sitemap missing ' + url);
    });
    INDEXABLE.forEach(file => {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert(!/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html), file + ': indexable page still has noindex');
    });

    for (const file of PAGES) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const visible = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
      for (const page of nodesFor(blocksFor(file)).filter(node => node['@type'] === 'FAQPage')) {
        for (const question of page.mainEntity || []) {
          assert(visible.includes(question.name), file + ': FAQ question is not visible');
          assert(visible.includes(question.acceptedAnswer.text), file + ': FAQ answer is not visible');
        }
      }
    }

    console.log('Structured-data checks passed for ' + PAGES.length + ' pages');

    The test must retain the stable Person ID and visible FAQ assertions above; do not weaken them to syntax-only checks.

- [ ] **Step 2: Run the failing test**

    node tests/structured-data.test.js

Expected: FAIL with at least one of the named current-schema gaps.

- [ ] **Step 3: Register the test command**

Add this package script without changing existing commands:

    "test:structured-data": "node tests/structured-data.test.js"

- [ ] **Step 4: Commit the red test**

    git add tests/structured-data.test.js package.json
    git commit -m "test: add structured data freshness checks"

### Task 3: Update promo-code source and generator-owned freshness

**Covers:** S3, S7, S10, S11

**Files:**
- Modify: data/codes.json:2 and the JUL4TH, DINOSR, GLOB34, and new RAID02 records
- Modify: scripts/generate-codes.js: freshness marker replacements
- Modify: guide/code/index.html: add generator-owned freshness markers only
- Generated: data/generated/promo-codes.js, index.html, guide/code/index.html

**Interfaces:**
- Consumes: the exact code state in S3 and the evidence ledger from Task 1.
- Produces: one active RAID02 record, corrected GLOB34 expiry, source date 2026-09-04, and consistent generated code surfaces.

- [ ] **Step 1: Update only data/codes.json**

Make these exact JSON changes and preserve all other records:

    "updated": "2026-09-04"

    {
      "code": "RAID02",
      "gems": 0,
      "tickets": 0,
      "reward": "1 x Bulletproof, 1 x Powerplex",
      "dateAdded": "2026-08-31"
    }

Set the existing GLOB34 record’s expiredDate to 2026-08-28. Preserve its existing gems, tickets, and reward fields unchanged. Do not duplicate JUL4TH or DINOSR and do not rename RAID26.

- [ ] **Step 2: Add durable code-page freshness markers**

Add marker pairs for the code guide’s date meta, Article modified timestamp, and JSON-LD dateModified. The generator replacement shape must remain source-driven. Re-enable the existing GUIDE_ARTICLE_MODIFIED replacement, which is currently disabled in scripts/generate-codes.js because the previous policy excluded code-list changes from Article freshness. This release explicitly treats the code source update as a substantive page update.

    const articleModified = updated + 'T00:00:00Z';
    const freshnessReplacements = [
      [/<!--GUIDE_DATE_META_START-->.*?<!--GUIDE_DATE_META_END-->/,
        '<!--GUIDE_DATE_META_START--> <meta name="date" content="' + updated + '"> <!--GUIDE_DATE_META_END-->'],
      [/<!--GUIDE_ARTICLE_MODIFIED_START-->.*?<!--GUIDE_ARTICLE_MODIFIED_END-->/,
        '<!--GUIDE_ARTICLE_MODIFIED_START--> <meta property="article:modified_time" content="' + articleModified + '"> <!--GUIDE_ARTICLE_MODIFIED_END-->']
    ];

Add a GUIDE_LD_DATEMODIFIED_START/END marker pair around the code page’s JSON-LD dateModified property and add its concrete replacement to the same replacements array:

    [/<!--GUIDE_LD_DATEMODIFIED_START-->.*?<!--GUIDE_LD_DATEMODIFIED_END-->/,
      '<!--GUIDE_LD_DATEMODIFIED_START--> "dateModified": "' + updated + '" <!--GUIDE_LD_DATEMODIFIED_END-->']

Use the existing generator style, assert each new marker occurs exactly once, and preserve datePublished.

- [ ] **Step 3: Run code generation and inspect counts**

    npm run update-codes
    Select-String -Path data/generated/promo-codes.js -Pattern 'RAID02|DINOSR|GLOB34|JUL4TH'
    Select-String -Path guide/code/index.html,index.html -Pattern 'RAID02|Sep 2026|2026-09-04'
    node -e "const fs=require('fs'); const d=require('./data/codes.json'); const g=d.codes.find(c=>c.code==='GLOB34'); const r=d.codes.filter(c=>c.code==='RAID02'); const active=d.codes.filter(c=>!c.expired); const generated=fs.readFileSync('data/generated/promo-codes.js','utf8'); if(!g||g.expiredDate!=='2026-08-28'||g.gems!==500||r.length!==1||r[0].expired||active.filter(c=>c.code==='RAID02').length!==1||!generated.includes('RAID02')||generated.includes('GLOB34')) process.exit(1); console.log('Code source and generated invariants passed; active='+active.length)"

Expected: RAID02 appears once in the active generated payload, GLOB34 is expired with 2026-08-28, the code page uses Sep 2026, and root/code counts match.

- [ ] **Step 4: Commit code data and generator changes**

    git add data/codes.json scripts/generate-codes.js data/generated/promo-codes.js index.html guide/code/index.html
    git commit -m "content: refresh September promo codes"

### Task 4: Re-audit creators and regenerate the directory

**Covers:** S4, S5, S8, S10, S11

**Files:**
- Modify: data/youtube-creators.json
- Modify: scripts/generate-youtube-creators.js: ItemList context and collection date output
- Generated: data/generated/youtube-creators.js, guide/creators/index.html

**Interfaces:**
- Consumes: verified YouTube evidence and creator rows from Task 1.
- Produces: refreshed source records, valid generated creator feed, stable eligibility, and independently contextualized ItemList JSON-LD.

- [ ] **Step 1: Update creator source records from the ledger**

Set data/youtube-creators.json updated to 2026-09-04. Recheck every active and pending creator; update rechecked lastChecked fields; add only verified standard videos; mark unavailable records with statusReason; and demote creators when the existing six-eligible, three-recent, six-featured gate no longer passes.

- [ ] **Step 2: Add context to every generated JSON-LD block**

Update the generator’s ItemList output so it starts with the same schema context as the page graph:

    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Invincible GTG YouTube creator videos"
    }

Merge these required properties into the existing generated ItemList object without removing its existing itemListElement array.

Keep generated uploadDate equal to each video’s published date, not 2026-09-04. Add collection datePublished 2026-08-23 and dateModified 2026-09-04 to the CollectionPage output.

- [ ] **Step 3: Run creator validation and generation**

    npm run test:creators
    npm run generate-creators
    npm run test:creators

Expected: validation passes, generation is idempotent, no Short is rendered, active/pending thresholds hold, and generated ItemList has its own context.

- [ ] **Step 4: Commit the creator refresh**

    git add data/youtube-creators.json scripts/generate-youtube-creators.js data/generated/youtube-creators.js guide/creators/index.html
    git commit -m "content: refresh September YouTube creators"

### Task 5: Rewrite guide and policy content from verified evidence

**Covers:** S2, S4, S6, S7, S12

**Files:**
- Modify: guide/code/index.html
- Modify: guide/beginners/index.html
- Modify: guide/event/index.html
- Modify: guide/pvp/index.html
- Modify: guide/login/index.html
- Modify: guide/faq/index.html
- Modify: guide/xp/index.html
- Modify: guide/redeem/index.html
- Modify: guide/creators/index.html or its generator-maintained template area
- Modify: privacy/index.html
- Modify: terms/index.html

**Interfaces:**
- Consumes: Task 1 evidence ledger, source data from Tasks 3–4, and the existing interactive DOM/config contracts.
- Produces: current prose/headings/FAQs/examples without changing app behavior or unverified numeric data.

- [ ] **Step 1: Rewrite each guide’s human-facing copy**

Use the existing page structure and these page intents:

    code      active codes, official portal, verification steps, reward interpretation
    beginners first-day progression, free gem sources, safe early spending
    event     current event loop, rewards, timing, and resource planning
    pvp       arena types, payout reading, demotion threshold, weekly planning
    login     streak behavior, daily cadence, and missed-day handling
    faq       current user questions and answers represented visibly and in FAQPage
    xp        hero rank-up flow, resource planning, and calculator interpretation
    redeem    official portal, verification-code flow, and redemption troubleshooting
    creators  directory purpose, eligibility, freshness, and YouTube disclosure

Rewrite prose, headings, FAQs, and examples only. Leave calculator controls, inline JSON configs, payout tables, and scripts untouched unless a ledger row proves a factual numeric correction.

- [ ] **Step 2: Reconcile FAQ schema with visible copy**

For every FAQPage node, ensure the Question name and acceptedAnswer text describe a question and answer visibly rendered on that same page. Delete stale schema entries when the visible FAQ no longer contains them.

- [ ] **Step 3: Rewrite privacy and terms from current policy plus repository behavior**

Retain the current policy page structure, but update substantive operational, rights, analytics, storage, embed, liability, and contact language only when the repository proves the behavior. Do not add claims about features, data collection, or user rights that the site does not implement. Keep the automated release gate from Task 9 and record every changed clause in the ledger.

- [ ] **Step 4: Commit content changes**

    git add guide privacy terms
    git commit -m "content: refresh September guide and policy copy"

### Task 6: Repair SEO metadata, shared entities, and page schema

**Covers:** S2, S7, S8, S9, S10, S11

**Files:**
- Modify: index.html
- Modify: guide/code/index.html
- Modify: guide/beginners/index.html
- Modify: guide/event/index.html
- Modify: guide/pvp/index.html
- Modify: guide/login/index.html
- Modify: guide/faq/index.html
- Modify: guide/xp/index.html
- Modify: guide/redeem/index.html
- Modify: guide/creators/index.html
- Modify: authors/anomaly/index.html
- Modify: privacy/index.html
- Modify: terms/index.html

**Interfaces:**
- Consumes: title matrix and page inventory from Task 1, content changes from Task 5, and stable entity IDs from S8.
- Produces: synchronized titles/social/headlines, valid page graphs, correct profile semantics, and no unresolved local references.

- [ ] **Step 1: Write the title matrix before editing metadata**

Add each final title, primary intent, character count, and synchronized variants to the Task 1 ledger. Use concise query-first wording, unique titles, and [Sep 2026] on home plus all nine guide routes. Keep author, music, privacy, and terms titles evergreen. Do not use unsupported numeric claims.

- [ ] **Step 2: Normalize stable IDs and page dates**

Use these exact identifiers consistently:

    https://anomaly-alpha.github.io/#game
    https://anomaly-alpha.github.io/authors/anomaly/#person
    https://anomaly-alpha.github.io/#organization

Preserve datePublished. Set dateModified and visible review/update dates to 2026-09-04 for rewritten or technically refreshed pages. Add missing original datePublished values for creators 2026-08-23, privacy 2026-07-17, and terms 2026-07-17. Task 7 owns music’s datePublished 2026-07-17 and dateModified/reviewed-date output.

- [ ] **Step 3: Repair the author profile**

Remove noindex. Change ProfilePage.author to ProfilePage.mainEntity and define the Person as follows, adding the existing description and sameAs values:

    "mainEntity": {
      "@type": "Person",
      "@id": "https://anomaly-alpha.github.io/authors/anomaly/#person",
      "name": "Anomaly",
      "url": "https://anomaly-alpha.github.io/authors/anomaly/",
      "description": "Creator of the Invincible GTG Gem Calculator, a community-driven fan site for Invincible Guarding the Globe players.",
      "sameAs": ["https://github.com/anomaly-alpha"]
    }

Add complete OG/Twitter metadata with profile type, image, and image alt text.

- [ ] **Step 4: Repair guide and legal graphs**

Ensure every JSON-LD script has its own context. Add homepage WebPage dateModified. Align redeem and XP VideoGame nodes with the fuller guide definition, including verified description, offers, and genre. Give redeem’s publisher logo the same attribution fields as the standard publisher. Define or inline typed Person, Organization, WebApplication, or VideoGame nodes for every legal-page reference instead of leaving #game or external author IDs unresolved.

- [ ] **Step 5: Commit metadata and schema repairs**

    git add index.html guide/code guide/beginners guide/event guide/pvp guide/login guide/faq guide/xp guide/redeem guide/creators authors/anomaly privacy terms
    git commit -m "seo: repair September metadata and structured data"

### Task 7: Make music indexable with separate review freshness

**Covers:** S2, S7, S8, S9, S10, S11

**Files:**
- Modify: data/playlists.json
- Modify: scripts/generate-music.js
- Modify: music/index.html
- Test: tests/structured-data.test.js

**Interfaces:**
- Consumes: current playlist source and the music review result from Task 1.
- Produces: an indexable, schema-complete page with separate playlist-content and page-review dates.

- [ ] **Step 1: Add the source review date without changing playlist content date**

Add this top-level field to data/playlists.json:

    "reviewed": "2026-09-04"

Leave updated at 2026-07-17 unless a playlist ID, description, or link actually changes.

- [ ] **Step 2: Update the music generator**

- [ ] **Step 2a: Validate the reviewed source field**

Replace the existing validatePlaylists(playlists) signature with validatePlaylists(data) so the generator validates the top-level reviewed field and then validates data.playlists:

    function isDateOnly(value) {
      return typeof value === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && !isNaN(new Date(value + 'T00:00:00Z').getTime());
    }

    function validatePlaylists(data) {
      if (!isDateOnly(data.reviewed)) {
        console.error('Error: data/playlists.json reviewed must be a valid YYYY-MM-DD date');
        return false;
      }
      var playlists = data.playlists;
      for (var i = 0; i < playlists.length; i++) {
        var playlist = playlists[i];
        if (!playlist.id || !playlist.name || !playlist.color || !playlist.page) {
          console.error('Error: playlist ' + i + ' missing required field (id, name, color, page)');
          return false;
        }
      }
      return true;
    }

    if (!validatePlaylists(playlistData)) process.exit(1);

The generator must fail when reviewed is missing or invalid instead of silently ignoring it.

- [ ] **Step 2b: Add durable review-date output**

Add a MUSIC_REVIEWED_START/END marker around the page’s review label and replace it from playlistData.reviewed:

    var reviewedLabel = '<!--MUSIC_REVIEWED_START-->Reviewed ' + formatDate(playlistData.reviewed) + '<!--MUSIC_REVIEWED_END-->';
    pageHtml = pageHtml.replace(/<!--MUSIC_REVIEWED_START-->.*?<!--MUSIC_REVIEWED_END-->/, reviewedLabel);

Preserve the existing Updated label as the playlist-content date derived from playlistData.updated.

- [ ] **Step 2c: Add durable generated JSON-LD**

Add a MUSIC_SCHEMA_START/END marker to music/index.html and replace it with one JSON-LD block containing the following graph. Build the playlist ItemList from playlistData.playlists so names, URLs, positions, and descriptions cannot drift from the visible grid:

    var schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://anomaly-alpha.github.io/' },
            { '@type': 'ListItem', 'position': 2, 'name': 'Music & Playlists', 'item': 'https://anomaly-alpha.github.io/music/' }
          ]
        },
        {
          '@id': 'https://anomaly-alpha.github.io/music/#page',
          '@type': 'CollectionPage',
          'name': 'Music & Playlists — Invincible GTG',
          'url': 'https://anomaly-alpha.github.io/music/',
          'datePublished': '2026-07-17',
          'dateModified': playlistData.reviewed,
          'isPartOf': {
            '@type': 'WebSite',
            '@id': 'https://anomaly-alpha.github.io/#website',
            'name': 'Invincible GTG',
            'url': 'https://anomaly-alpha.github.io/'
          }
        },
        {
          '@type': 'ItemList',
          'name': 'Invincible GTG playlists',
          'itemListElement': playlistData.playlists.map(function (playlist, index) {
            return {
              '@type': 'ListItem',
              'position': index + 1,
              'name': playlist.name,
              'description': playlist.description,
              'url': 'https://open.spotify.com/playlist/' + playlist.id
            };
          })
        }
      ]
    };

var schemaHtml = '<script type="application/ld+json">' + JSON.stringify(schema).replace(/<[/]script/gi, '<' + String.fromCharCode(92) + '/script') + '</script>';
pageHtml = pageHtml.replace(/<!--MUSIC_SCHEMA_START-->[^]*?<!--MUSIC_SCHEMA_END-->/, '<!--MUSIC_SCHEMA_START-->' + schemaHtml + '<!--MUSIC_SCHEMA_END-->');

Preserve the existing MUSIC_GRID markers and file:// relative-link behavior. The generated schema block must include its own context and remain idempotent.

- [ ] **Step 3: Make the page indexable and verify metadata**

Remove noindex from music/index.html, add og:image:alt, synchronize evergreen title/description/social tags, and ensure every emitted JSON-LD block has its own context. Keep the visible playlist content date tied to updated and the page review text tied to reviewed.

- [ ] **Step 4: Regenerate and commit**

    npm run update-music
    npm run test:structured-data
    git add data/playlists.json scripts/generate-music.js music/index.html
    git commit -m "seo: make music page indexable and review-aware"

### Task 8: Finalize sitemap, robots, changelog, and freshness surfaces

**Covers:** S2, S7, S9, S10, S11, S12

**Files:**
- Modify: sitemap.xml
- Verify: robots.txt
- Modify: CHANGELOG.md
- Modify: static page date/meta fields not owned by generators

**Interfaces:**
- Consumes: actual changed-page list from Tasks 3–7.
- Produces: sitemap and changelog signals aligned with the final indexable page set.

- [ ] **Step 1: Update sitemap membership**

Keep the 11 existing indexable entries and add exactly /music/, /privacy/, and /terms/. Retain /authors/anomaly/ now that it is indexable. The resulting sitemap has 14 URLs. Set lastmod to 2026-09-04 for pages changed in this release; use each page’s existing real lastmod only for a reviewed-and-retained page with no content or technical change. Do not add seo/ or skarn-bot/.

- [ ] **Step 2: Verify robots directives**

Keep robots.txt as Allow: / with the existing sitemap URL. Confirm no in-scope page retains noindex and seo/index.html remains noindex/nofollow.

- [ ] **Step 3: Add the September changelog entry**

Add a top CHANGELOG.md section titled Sep 2026 that records the promo-code refresh, creator/video refresh, guide and policy rewrite, indexability expansion, SEO title refresh, and structured-data repair.

- [ ] **Step 4: Commit sitemap and release notes**

    git add sitemap.xml robots.txt CHANGELOG.md index.html guide authors/anomaly music privacy terms
    git commit -m "docs: finalize September freshness release surfaces"

### Task 9: Run the complete integration gate

**Covers:** S1, S3, S5, S7, S8, S9, S11, S12

**Files:**
- Test: tests/structured-data.test.js
- Verify: all generated outputs, all 14 indexable pages, sitemap.xml, robots.txt, and the evidence ledger

**Interfaces:**
- Consumes: all source, generated, content, SEO, schema, and sitemap changes from Tasks 1–8.
- Produces: verified release evidence or a concrete failure requiring the owning task to be reopened.

- [ ] **Step 1: Run all generators from source**

    npm run update-codes
    npm run generate-creators
    npm run update-music

Expected: all commands exit zero and repeated runs produce no additional diff.

- [ ] **Step 2: Run focused tests**

    npm run test:creators
    npm run test:structured-data
    npm run test:ads-txt
    npm run test:ads-fallback

Expected: all tests pass.

- [ ] **Step 3: Run the production build**

    npm run build

Expected: code, creator, music, Tailwind, CSS, and JS build stages exit zero.

- [ ] **Step 4: Run the stale-reference and source-consistency audit**

Check target pages and generated outputs with these commands:

    Select-String -Path index.html,guide/*/index.html,authors/anomaly/index.html,music/index.html,privacy/index.html,terms/index.html -Pattern 'Aug 2026|2026-08-22|2026-08-23|noindex'
    Select-String -Path data/generated/promo-codes.js,index.html,guide/code/index.html -Pattern 'RAID02|GLOB34|DINOSR|JUL4TH'
    Select-String -Path music/index.html -Pattern 'Reviewed Sep 4, 2026|datePublished.*2026-07-17|dateModified.*2026-09-04|CollectionPage|BreadcrumbList|ItemList'
    Select-String -Path privacy/index.html,terms/index.html -Pattern 'datePublished.*2026-07-17|dateModified.*2026-09-04'
    git diff --exit-code -- data/generated/promo-codes.js data/generated/youtube-creators.js guide/creators/index.html music/index.html

Expected: no unintended August freshness references, no noindex on the 14 target pages, exact code records, music review/schema/date fields, legal publication/modified dates, and no generator drift.

- [ ] **Step 5: Inspect rendered pages in a browser**

Serve the workspace locally, inspect all 14 target pages with Playwright, and record in the evidence ledger:

    document.title
    document.querySelector('link[rel="canonical"]').href
    document.querySelector('meta[name="robots"]')?.content
    [...document.scripts].filter(script => script.type === 'application/ld+json').map(script => JSON.parse(script.textContent))

Confirm each page’s title, canonical, robots directive, visible review date, JSON-LD contexts, author/mainEntity relationship, and FAQ parity. Confirm music contains CollectionPage with datePublished 2026-07-17 and dateModified 2026-09-04, BreadcrumbList, and playlist ItemList. Confirm privacy and terms contain datePublished 2026-07-17 and dateModified 2026-09-04.

- [ ] **Step 6: Run Lighthouse and inspect the score table**

    npm run lighthouse:all
    npm run lighthouse:report
    npm run lighthouse:budget

Expected: all pages complete, budgets pass, and any regression is fixed before release.

- [ ] **Step 7: Commit verified integration state**

    git status --short
    git commit -m "release: verify September site freshness update"

Expected: the worktree contains only intentional release changes and the evidence ledger records all verification commands and outcomes.
