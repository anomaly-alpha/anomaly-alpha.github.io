# SEO Growth & Marketing Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 highest-impact CTR leaks, rewrite underperforming guide metas, add cross-promotion links, fill content gaps, and add marketing distribution features.

**Architecture:** Small, independent changes across HTML meta tags, content additions, CSS, JS, and one generator script update. No new pages or dependencies.

**Tech Stack:** Vanilla HTML/CSS/JS, Node.js (generator script), existing Chart.js for infographic card.

## Global Constraints

- Meta descriptions must be ≤155 characters (Google truncation limit)
- JS additions to `script.js` use `function` declarations (no arrow functions), consistent with project conventions
- CSS additions appended to `styles.css` (minified file — edit the last closing brace)
- Generator script `scripts/generate-codes.js` follows existing pattern: reads `data/codes.json`, writes chip HTML via markers
- All pages must remain valid HTML (verify with browser open)
- Run `npm run build` after all tasks to regenerate minified assets

---

### Task 1: Phase A — Homepage fixes + guide meta rewrites + cross-links

**Covers:** [S4] (A1, A2, A3, A4)

**Files:**
- Modify: `index.html`
- Modify: `guide/faq/index.html`
- Modify: `guide/login/index.html`
- Modify: `guide/code/index.html`

- [ ] **Step 1: Add gems definition paragraph to homepage hero**

In `index.html`, after `">Calculate Your Full Gem Income</p>`:

```html
                    <p class="text-white/60 text-sm max-w-2xl mx-auto mt-2">Gems are the premium currency in Invincible: Guarding the Globe — used for energy refills, hero pulls, and shop items. Earn up to ~4,043 free gems every week from all sources combined.</p>
```

Insert this line right after `">Calculate Your Full Gem Income</p>`.

- [ ] **Step 2: Rewrite homepage meta description**

In `index.html`, replace the meta description (and OG/Twitter descriptions):

Current:
```html
    <meta name="description" content="Get all free gems in Invincible Guarding the Globe — promo codes, PvP rewards, login bonuses, and weekly events. See how many gems you earn.">
```

Replace with:
```html
    <meta name="description" content="Calculate your exact weekly gem income in Invincible Guarding the Globe — 4,043/week from promo codes, PvP rewards, login bonuses, and weekly events. Free gem calculator.">
```

Also update `og:description` (line 12) and `twitter:description` (line 27) with the same text.

- [ ] **Step 3: Rewrite FAQ meta description**

In `guide/faq/index.html`, replace:
```html
    <meta name="description" content="All your Invincible Guarding the Globe questions answered — gem earnings, PvP leagues, promo codes, login rewards, and events. Updated weekly.">
```
With:
```html
    <meta name="description" content="How many gems per week in Invincible Guarding the Globe? ~4,043 from PvP, events, login streaks, and 28 active promo codes. Complete FAQ with payout tables and redemption guide.">
```

Also update `og:description` and `twitter:description` to match.

- [ ] **Step 4: Rewrite Login meta description**

In `guide/login/index.html`, replace:
```html
    <meta name="description" content="Plan your 1,393 weekly login gems — daily (910), weekly (460), and monthly bonuses explained. Login rewards are your most reliable gem source.">
```
With:
```html
    <meta name="description" content="Login rewards give you 1,393 free gems every week in Invincible Guarding the Globe — daily logins (910), weekly streaks (460), and monthly bonuses. Your most reliable gem income source.">
```

Also update `og:description` and `twitter:description` to match.

- [ ] **Step 5: Add cross-links to code guide**

In `guide/code/index.html`, navigate to the `promo codes` section content area. After the active codes section and before the tips section, add:

```html
            <!-- Cross-links -->
            <div class="gem-card p-4 mt-6 gem-card--code">
                <p class="text-white/80 text-sm">
                    Already grabbed your codes? Check your <a href="../pvp/" class="gem-text--pvp hover:text-white transition-colors font-semibold">PvP earnings</a>
                    and <a href="../login/" class="gem-text--login hover:text-white transition-colors font-semibold">login rewards</a>
                    to see your full weekly total.
                </p>
            </div>
```

Find the right insertion point by searching for the tips/troubleshooting section heading in the file.

- [ ] **Step 6: Verify and commit**

Run: `npm run build`
Open each modified page in browser — check meta tags in devtools, verify cross-links render.

```bash
git add index.html guide/faq/index.html guide/login/index.html guide/code/index.html
git commit -m "feat: fix CTR leaks with meta rewrites, gems content, and cross-links"
```

---

### Task 2: Phase B — XP title fix, PvP league table, expired code CSS

**Covers:** [S5] (B1, B3, B4)

**Files:**
- Modify: `guide/xp/index.html`
- Modify: `guide/pvp/index.html`
- Modify: `styles.css`

- [ ] **Step 1: Change XP guide title from "Calculator" to "Guide"**

In `guide/xp/index.html`, find all 3 occurrences of `"Invincible Guarding the Globe XP Calculator — Leveling & Progression"` (og:title, twitter:title, `<title>`) and replace with:
```
Invincible Guarding the Globe XP Guide — Hero Rank-Up Costs Rare to Omnipotent+
```

- [ ] **Step 2: Add league comparison JS to PvP guide**

In `guide/pvp/index.html`, after the "Alliance War" payout table section and before the "Related Guides" section, add:

```html
            <!-- League Comparison -->
            <section class="mt-8">
                <h2 class="text-lg font-bold gem-text--pvp mb-4">League Comparison — Gem Jumps</h2>
                <p class="text-white/60 text-sm mb-4">Moving up a league increases your weekly gem payout. Here's how much each promotion is worth:</p>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm" id="leagueJumps">
                        <thead>
                            <tr class="text-white/50 text-xs uppercase tracking-wider border-b border-white/10">
                                <th class="text-left p-2">League Promotion</th>
                                <th class="text-right p-2">Gem Increase/Week</th>
                            </tr>
                        </thead>
                        <tbody id="leagueJumpsBody"></tbody>
                    </table>
                </div>
            </section>
```

- [ ] **Step 3: Add inline JS to render the league table**

In `guide/pvp/index.html`, before `</body>`, after the `script.js` include, add:

```html
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        var tbody = document.getElementById('leagueJumpsBody');
        if (!tbody || typeof GAME === 'undefined') return;
        var leagues = GAME.pvp.leagues;
        if (!leagues) return;
        for (var i = 1; i < leagues.length; i++) {
            var prev = leagues[i - 1];
            var curr = leagues[i];
            // Estimate gem increase from Restricted Arena rank 1 payouts
            var prevGems = GAME.pvp.arenas.restricted.payouts[prev.id] ? GAME.pvp.arenas.restricted.payouts[prev.id][0] : 0;
            var currGems = GAME.pvp.arenas.restricted.payouts[curr.id] ? GAME.pvp.arenas.restricted.payouts[curr.id][0] : 0;
            var increase = currGems - prevGems;
            var tr = document.createElement('tr');
            tr.className = 'border-t border-white/5';
            tr.innerHTML = '<td class="p-2 text-white/80">' + prev.name + ' \u2192 ' + curr.name + '</td>' +
                '<td class="p-2 text-right gem-text--' + (increase > 0 ? 'pvp' : 'white/60') + '">' + (increase > 0 ? '+' + increase : '0') + ' gems</td>';
            tbody.appendChild(tr);
        }
    });
    </script>
```

Note: Uses `GAME.pvp.leagues` and `GAME.pvp.arenas.restricted.payouts` from the existing inline JSON config. No new config needed.

- [ ] **Step 4: Add expired code badge CSS**

In `styles.css`, find the last character (`}`) and insert before it:

```css
.gem-code--badge{display:inline-block;font-size:.65rem;padding:.1rem .4rem;border-radius:3px;margin-left:.25rem;font-weight:700;text-transform:uppercase;vertical-align:middle;line-height:1.2}.gem-code--badge--new{background:#2ecc71;color:#000}.gem-code--badge--recent{background:#00e5ff;color:#000}
```

- [ ] **Step 5: Verify and commit**

```bash
git add guide/xp/index.html guide/pvp/index.html styles.css
git commit -m "feat: fix XP title, add PvP league comparison, add NEW code badge CSS"
```

---

### Task 3: Phase C — Share buttons, summary card, and generator badge

**Covers:** [S6] (C1, C2, C3)

**Files:**
- Modify: `script.js`
- Modify: `index.html`
- Modify: `guide/code/index.html`
- Modify: `scripts/generate-codes.js`

- [ ] **Step 1: Add share/copy functions to script.js**

Open `script.js` and append before the last line (which should be `})();` or similar). Add these functions:

```js
function shareOnTwitter(url, text){window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(text)+'&url='+encodeURIComponent(url),'_blank','width=600,height=400')}
function shareOnReddit(url, title){window.open('https://www.reddit.com/submit?url='+encodeURIComponent(url)+'&title='+encodeURIComponent(title),'_blank','width=600,height=400')}
function copyPageLink(url){navigator.clipboard.writeText(url).then(function(){var t=document.getElementById('linkCopied');if(t){t.style.display='inline';setTimeout(function(){t.style.display='none'},2000)}})}
```

- [ ] **Step 2: Add share buttons to homepage hero**

In `index.html`, after the gems definition paragraph (added in Task 1), add:

```html
                    <div class="flex justify-center gap-3 mt-4">
                        <button onclick="shareOnTwitter('https://anomaly-alpha.github.io/','Invincible Guarding the Globe Gem Calculator — ~4,043 gems/week. Plan your income from PvP, events, login, and codes.')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Share on X">Share on X</button>
                        <button onclick="shareOnReddit('https://anomaly-alpha.github.io/','Invincible Guarding the Globe Gem Calculator — ~4,043 gems/week')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Share on Reddit">Share on Reddit</button>
                        <button onclick="copyPageLink('https://anomaly-alpha.github.io/')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Copy link">Copy Link</button>
                        <span id="linkCopied" class="text-xs gem-text--code" style="display:none">Copied!</span>
                    </div>
```

- [ ] **Step 3: Add share buttons to code guide hero**

In `guide/code/index.html`, after the hero subtitle or description, add the same share button row but with the code guide URL:

```html
                    <div class="flex justify-center gap-3 mt-4">
                        <button onclick="shareOnTwitter('https://anomaly-alpha.github.io/guide/code/','28 active Invincible Guarding the Globe promo codes — tap to copy and redeem. Updated Jul 2026.')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Share on X">Share on X</button>
                        <button onclick="shareOnReddit('https://anomaly-alpha.github.io/guide/code/','Invincible Guarding the Globe Promo Codes — 28 Active [Jul 2026]')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Share on Reddit">Share on Reddit</button>
                        <button onclick="copyPageLink('https://anomaly-alpha.github.io/guide/code/')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Copy link">Copy Link</button>
                        <span id="linkCopied" class="text-xs gem-text--code" style="display:none">Copied!</span>
                    </div>
```

- [ ] **Step 4: Add gem summary card to homepage**

In `index.html`, insert after the card modal section and before the footer. This is a static card showing default values:

```html
        <!-- ===== GEM SUMMARY CARD: Shareable infographic ===== -->
        <section class="gem-card p-6 mt-8 text-center">
            <h2 class="text-lg font-bold gem-text--cyan mb-4">Your Weekly Gem Summary</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                    <p class="text-white/50 text-xs uppercase tracking-wider">PvP</p>
                    <p class="text-xl font-bold gem-text--pvp">~1,850</p>
                </div>
                <div>
                    <p class="text-white/50 text-xs uppercase tracking-wider">Events</p>
                    <p class="text-xl font-bold gem-text--event">500</p>
                </div>
                <div>
                    <p class="text-white/50 text-xs uppercase tracking-wider">Login</p>
                    <p class="text-xl font-bold gem-text--login">1,393</p>
                </div>
                <div>
                    <p class="text-white/50 text-xs uppercase tracking-wider">Codes</p>
                    <p class="text-xl font-bold gem-text--code">300</p>
                </div>
            </div>
            <p class="text-center text-2xl font-bold gem-text--cyan">~4,043 gems/week</p>
            <p class="text-center text-white/40 text-xs mt-2">anomaly-alpha.github.io</p>
            <div class="flex justify-center gap-3 mt-4">
                <button onclick="shareOnTwitter('https://anomaly-alpha.github.io/','~4,043 gems/week in Invincible Guarding the Globe from PvP, events, login, and codes. Plan your income here:')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Share on X">Share on X</button>
                <button onclick="shareOnReddit('https://anomaly-alpha.github.io/','Invincible Guarding the Globe Gem Summary — ~4,043 Gems/Week from All Sources')" class="text-white/40 hover:text-white transition-colors text-xs" aria-label="Share on Reddit">Share on Reddit</button>
            </div>
        </section>
```

- [ ] **Step 5: Add NEW badge to code generator**

In `scripts/generate-codes.js`, find the chip rendering template and modify it. The generator creates chips like:
```js
'<span class="gem-card gem-card--code gem-card--hover p-3 gem-code--age-' + ageBand + '" ...>' + code.code + '</span>'
```

Add a badge inside the chip element. After the code text variable, add:
```js
var daysOld = Math.floor((new Date() - new Date(code.dateAdded)) / (1000 * 60 * 60 * 24));
var badge = '';
if (daysOld < 7) badge = '<span class="gem-code--badge gem-code--badge--new">NEW</span>';
else if (daysOld < 14) badge = '<span class="gem-code--badge gem-code--badge--recent">Recent</span>';
```

And include `badge` in the chip HTML output right after the code text.

Run: `npm run update-codes` to regenerate chips.

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Open homepage in browser — verify share buttons, summary card renders, cross-links work.
Open code guide — verify share buttons, NEW/Recent badges on chips.
Open PvP guide — verify league comparison table renders.

- [ ] **Step 7: Commit**

```bash
git add script.js index.html guide/code/index.html scripts/generate-codes.js
git commit -m "feat: add share buttons, gem summary card, and NEW code badges"
```

---

### Task 4: Phase C — UTM documentation

**Covers:** [S6] (C4)

**Files:**
- Modify: `advertising.md`

- [ ] **Step 1: Add UTM-tagged URL variants to advertising.md**

In `advertising.md`, add a section after the existing campaigns:

```markdown
## UTM Tracking URLs

Use these links to track which channels drive traffic (requires analytics to measure):

- Discord: `https://anomaly-alpha.github.io/?utm_source=discord&utm_medium=social&utm_campaign=gem-calc-promo`
- Discord (code guide): `https://anomaly-alpha.github.io/guide/code/?utm_source=discord&utm_medium=social&utm_campaign=promo-codes`
- Reddit: `https://anomaly-alpha.github.io/?utm_source=reddit&utm_medium=social&utm_campaign=gem-calc-promo`
- Reddit (code guide): `https://anomaly-alpha.github.io/guide/code/?utm_source=reddit&utm_medium=social&utm_campaign=promo-codes`
- Twitter/X: `https://anomaly-alpha.github.io/?utm_source=twitter&utm_medium=social&utm_campaign=gem-calc-promo`
```

- [ ] **Step 2: Commit**

```bash
git add advertising.md
git commit -m "docs: add UTM tracking URLs to advertising copy"
```
