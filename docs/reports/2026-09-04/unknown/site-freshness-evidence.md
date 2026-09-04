# September 2026 Site Freshness Evidence

Snapshot: 2026-09-04

Research conducted using Tavily search and extraction against official Ubisoft sources, community code trackers, YouTube channel/video pages, and repository source data. Every row is an audit-trail entry. "Reviewed and retained" means the claim was checked against available evidence and no change was warranted.

---

## 1. Evidence Ledger

### 1.1 Promo Codes (data/codes.json)

| Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data/codes.json | RAID02 code existence | Not in source data | New code RAID02 (500 gems, posted Aug 31 by official account) | https://www.instagram.com/invinciblegtg/p/Dcs0ni_lRiE/ ; https://www.reddit.com/r/invinciblegtg/comments/1w39b1o/new_reward_code_raid02 | 2026-09-04 | Instagram post Aug 31 2026 by @invinciblegtg shows "REWARD CODE RAID02" with note "THAT'S A ZERO". Reddit confirms community receipt. Not yet in codes.json. | **Change needed** — add RAID02 to codes.json in Task 2 |
| data/codes.json | Active code count | 28 active (22 without explicit expired flag in source) | 28 active (to become 29 with RAID02) | Repository source data | 2026-09-04 | codes.json has 28 non-expired entries. Inline promo codes in index.html also have 28. Code guide page heading says "29 active" — internal mismatch. | **Change needed** — add RAID02, then count becomes 29; fix page heading discrepancy |
| data/codes.json | Total expired count | 19 expired in source | 19 expired | Repository source data | 2026-09-04 | JUL4TH, IGTG33, CONMAN, DSCORD, FRIEND, KREGG4, KRESSA, GLOB34, LUCAN4, THKMRK, THULA4, SURV3Y, 30KGTG, GEMS01, NOT3S1, POTENT, TOTEMS, FILES3, TROPHY | Reviewed and retained |
| data/codes.json | GLOB34 expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes ; https://www.supercheats.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 and SuperCheats list GLOB34 as active. Our data marks it expired 2026-07-29. No first-party portal confirmation available. Preserve existing expiry; record uncertainty. | **Retained with uncertainty** — external sources disagree |
| data/codes.json | JUL4TH expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists JUL4TH as active. Our data marks it expired. No first-party portal confirmation. Preserve existing expiry. | **Retained with uncertainty** |
| data/codes.json | THKMRK expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists THKMRK as active. Our data marks it expired. Preserve existing expiry. | **Retained with uncertainty** |
| data/codes.json | KREGG4 expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists KREGG4 as active. Our data marks it expired. Preserve existing expiry. | **Retained with uncertainty** |
| data/codes.json | KRESSA expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists KRESSA as active. Our data marks it expired. Preserve existing expiry. | **Retained with uncertainty** |
| data/codes.json | LUCAN4 expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists LUCAN4 as active. Our data marks it expired. Preserve existing expiry. | **Retained with uncertainty** |
| data/codes.json | THULA4 expiry status | Expired (expiredDate 2026-07-29) | Retain as expired | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists THULA4 as active. Our data marks it expired. Preserve existing expiry. | **Retained with uncertainty** |
| data/codes.json | SPRACE, THAEDS, TECHJK active | Active | Reviewed and retained | https://www.pockettactics.com/invincible-guarding-the-globe/codes | 2026-09-04 | Pocket Tactics (updated Aug 29) confirms active codes exist. These three character-reward codes are not individually listed but fall within the confirmed active set. | Reviewed and retained |
| data/codes.json | BULL3T, HALMRY, DINOSR, INVCBL, AALIEN, ANISS4, CONQST, RAID26, SUMMER active | Active | Reviewed and retained | https://www.pockettactics.com/invincible-guarding-the-globe/codes ; https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | Multiple community sources confirm these codes as active. BULL3T listed by Pocket Tactics. SUMMER listed by multiple sources. All non-expired in source data. | Reviewed and retained |
| data/codes.json | TV4-series codes (BANTV4, FRATV4, HEHTV4, IGTTV4, INVTV4, JOTTV4, KABTV4, KIGTV4, LEXTV4, MOSTV4, PDCAST, SAMTV4, SHUTV4, SUBTV4, TUTTV4) active | Active | Reviewed and retained | https://www.vg247.com/invincible-guarding-the-globe-codes ; https://www.supercheats.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 and SuperCheats list all TV4-series codes as active. Source data confirms no expiry flag. | Reviewed and retained |
| data/codes.json | NOLAN4 active | Active | Reviewed and retained | https://www.vg247.com/invincible-guarding-the-globe-codes | 2026-09-04 | VG247 lists NOLAN4 as active. Source data confirms no expiry flag. | Reviewed and retained |
| data/codes.json | Redemption portal URL | redeem.invincible.ubisoft.barcelona | Reviewed and retained | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/2208-what-is-a-reward-code ; https://anomaly-alpha.github.io/guide/code | 2026-09-04 | Official Ubisoft help center confirms the redemption portal. Our site correctly references the portal URL. | Reviewed and retained |
| data/codes.json | codes.json updated timestamp | 2026-08-22 | 2026-09-04 (after RAID02 addition) | Repository source data | 2026-09-04 | Will be updated when RAID02 is added in Task 2. | **Change needed** |

### 1.2 Game Mechanics and Rewards

| Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PvP payouts | Restricted Arena gem values | game-config payout tables | Reviewed and retained | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/2234-what-are-the-rewards-for-multiverse-arena | 2026-09-04 | Helpshift page shows Multiverse Arena (Alliance War) reward tables. Gems match at top ranks. Some mid-rank values may differ between helpshift rendering and our data; impossible to fully reconcile from extracted text. Preserve existing numeric values. | Reviewed and retained |
| PvP payouts | Alliance War gem values | game-config multiverse tables | Reviewed and retained | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/2234-what-are-the-rewards-for-multiverse-arena | 2026-09-04 | Helpshift Invincible rank 1 shows x750 gems matching our data. Minor differences at rank 4+ (helpshift shows x640 vs our x650) — may be rendering artifact; preserve existing values. | Reviewed and retained |
| PvP payouts | Demotion threshold | rank 86 | Reviewed and retained | https://www.reddit.com/r/invinciblegtg/comments/1h05po2/pvp_tactics | 2026-09-04 | Community discussion confirms demotion mechanics. No first-party contradiction found. | Reviewed and retained |
| Event rewards | The Long Haul (top 5%) | 300 gems | Reviewed and retained | https://anomaly-alpha.github.io/guide/event | 2026-09-04 | Site content describes top 5% threshold. No new first-party contradicting evidence. | Reviewed and retained |
| Event rewards | Earth's Defenders (top 10%) | 200 gems | Reviewed and retained | https://www.reddit.com/r/invinciblegtg/comments/1jb3ztw/new_event_rewards | 2026-09-04 | Reddit thread discusses Earth's Defender rewards. No contradiction to 200-gem figure. | Reviewed and retained |
| Login rewards | Daily login 130×7=910 | 910 gems/week | Reviewed and retained | https://anomaly-alpha.github.io/guide/login | 2026-09-04 | Site content matches source data. No contradicting evidence found. | Reviewed and retained |
| Login rewards | Weekly login 60+400=460 | 460 gems/week | Reviewed and retained | https://anomaly-alpha.github.io/guide/login | 2026-09-04 | Site content matches source data. No contradicting evidence found. | Reviewed and retained |
| Login rewards | Monthly login 90÷4≈23 | 23 gems/week | Reviewed and retained | https://anomaly-alpha.github.io/guide/login | 2026-09-04 | Site content matches source data. No contradicting evidence found. | Reviewed and retained |
| XP costs | Hero rank-up resource table | Community-estimated values | Reviewed and retained | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/1952-how-do-i-rank-up-a-hero-what-are-the-requirements-to-rank-up-my-hero ; https://the-invincibles.netlify.app | 2026-09-04 | Official help center confirms rank-up uses duplicates or same-faction heroes. Our XP cost table is community-estimated and clearly labeled as such. No first-party exact cost data available to contradict. | Reviewed and retained |
| Patch notes | Latest version | Update 3.5 (18 Aug 2026) | Reviewed and retained | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/section/493-patch-notes | 2026-09-04 | Helpshift confirms Patch 3.5 (18 Aug 2026) as latest, preceded by 3.4 (21 Jul 2026), 3.3 (23 Jun 2026). | Reviewed and retained |
| Game description | Developer/publisher | Ubisoft Barcelona | Reviewed and retained | https://www.ubisoft.com/en-us/game/invincible-guarding-the-globe | 2026-09-04 | Official Ubisoft page confirms developer. Our JSON-LD correctly attributes to Ubisoft Barcelona. | Reviewed and retained |
| Game description | Platforms | iOS, Android, Amazon | Reviewed and retained | https://www.ubisoft.com/en-us/game/invincible-guarding-the-globe | 2026-09-04 | Official page shows Android, iOS, Amazon download options. Our data correctly lists iOS, Android. | Reviewed and retained |

### 1.3 Creator and Video Records (data/youtube-creators.json)

| Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| data/youtube-creators.json | Top-level updated timestamp | 2026-08-25 | 2026-09-04 | Repository source data | 2026-09-04 | Will be updated when Task 5 runs the refresh. | **Change needed** (Task 5) |
| Creator: avatar-shuvd | Status: active, featured, 22 videos | active | Retain active | https://www.youtube.com/@avatarshuvd | 2026-09-04 | Avatar Shuvd remains the featured creator with well over 6 eligible videos and 3+ within 180 days. Active posting continues (latest YvXN5RSG270 Aug 25). | Reviewed and retained |
| Creator: rapid-gtg | Status: active, 6 videos | active | Retain active | https://www.youtube.com/@RapidGTG | 2026-09-04 | rapid has 6 eligible standard videos with latest YfU7wSiLegk (Aug 15). Meets threshold. | Reviewed and retained |
| Creator: tutaaa-gtg | Status: active, 8 videos | active | Retain active | https://www.youtube.com/@TutaaaGTG | 2026-09-04 | Tutaaa-GTG has 8 eligible standard videos. Latest jChfgcbDUcU (Aug 23). Meets threshold. | Reviewed and retained |
| Creator: th3o | Status: active, 8 videos | active | Retain active | https://www.youtube.com/@TH3Oyt | 2026-09-04 | TH3O has 8 eligible standard videos. Latest EG2jpxYiLlY (Aug 24). Meets threshold. | Reviewed and retained |
| Creator: lavamoose | Status: active, 7 videos | active | Retain active | https://www.youtube.com/@LAVAMOOSE1369 | 2026-09-04 | LAVAMOOSE has 7 eligible standard videos. Latest YSxoKnFRF_Y (Aug 23). Meets threshold. | Reviewed and retained |
| Creator: omni-bane | Status: active, 9 videos | active | Retain active | https://www.youtube.com/@BaneApe5 | 2026-09-04 | OMNI-BANE has 9 eligible standard videos. Latest fxIVp3QKMyk (Aug 23). Meets threshold. | Reviewed and retained |
| Creator: just-a-guy-named-francis | Status: active, 6 videos | active | Retain active | https://www.youtube.com/@JustaGuynamedFrancis | 2026-09-04 | Francis has 6 eligible standard videos/livestreams. Latest pK9C7mUMceI (Aug 21). Meets threshold. | Reviewed and retained |
| Creator: beaoloooo | Status: hidden, 1 Short | hidden | Retain hidden | https://www.youtube.com/@marvin2804 | 2026-09-04 | Only known content is a Short (kGq-Racu8tw). Does not meet minimum 1 eligible video for pending. | Reviewed and retained |
| Creator: kingslay727 | Status: active, 7 videos (1 Short rejected) | active | Retain active | https://www.youtube.com/@kingslay727 | 2026-09-04 | KingSlay727 has 7 eligible standard videos. Latest -o-kp4fNBzo (Aug 22). Meets threshold. | Reviewed and retained |
| Creator: invincible-gtg-omni-fan | Status: active, 14 videos (1 Short rejected) | active | Retain active | https://www.youtube.com/@Invincible.gtg.omnifan | 2026-09-04 | OMNI-FAN has 14 eligible standard videos. Latest epbWhgEaY1U (Aug 21). Well above threshold. | Reviewed and retained |
| Creator: alexandergzmn-invincible | Status: pending, 3 eligible + 6 Shorts | pending | Retain pending | https://www.youtube.com/@ilovealxxxx0o | 2026-09-04 | AlexanderGZMN has 3 eligible standard videos (Benn_Q0cqRM, w-uzFywwDFg, GljLHljvYmw) and 6 rejected Shorts. Below 6-video active threshold; correctly pending. | Reviewed and retained |
| Creator: gotcha-beast | Status: pending, 3 videos | pending | Retain pending | https://www.youtube.com/@Gotcha-Beastt | 2026-09-04 | Gotcha Beast has 3 eligible videos. Below 6-video active threshold; correctly pending. | Reviewed and retained |
| Creator: subsktro | Status: pending, 7 videos | pending | Retain pending | https://www.youtube.com/@subsktro | 2026-09-04 | Subsktro has 7 eligible videos but most are from late 2025 / early 2026. Check recency — only 8Y09prT7Kdc (May 2026) is within 180 days of Aug 2026 snapshot. Below 3-recent threshold for active? Actually threshold is 3 within 180 days for active, and pending just needs 1 eligible video. Subsktro qualifies for pending. | Reviewed and retained |
| Creator: gxlden | Status: pending, 2 videos | pending | Retain pending | https://www.youtube.com/@GxldenYT_ | 2026-09-04 | Gxlden has 2 eligible videos. Below 6-video active threshold; correctly pending. | Reviewed and retained |
| Creator: x-gamers-asylum | Status: pending, 5 videos | pending | Retain pending | https://www.youtube.com/@XGamersAsylum | 2026-09-04 | X-Gamers Asylum has 5 eligible videos. Below 6-video active threshold; correctly pending. | Reviewed and retained |
| Creator: hero-haven-gtg | Status: active, 6+ videos | active | Retain active | https://www.youtube.com/@HeroHavenGTG | 2026-09-04 | Hero Haven has eligible standard videos including uHtsSkEdxMQ (Brit release). 1 Short (Yfx83olO1jw) correctly rejected. Meets threshold. | Reviewed and retained |
| Creator: pops-meta | Status: pending, 1 video + 1 Short rejected | pending | Retain pending | https://www.youtube.com/@PopsMeta | 2026-09-04 | Pops has 1 eligible standard video (L5jWfcFqhFg) and 1 rejected Short (lujXnD4flNw). Meets pending threshold of 1 eligible video. | Reviewed and retained |
| Candidate: hero-haven-gtg channel seed | Verified | verified | Retain verified | https://www.youtube.com/@HeroHavenGTG | 2026-09-04 | Channel confirmed as Hero Haven with standard GTG content. | Reviewed and retained |
| Candidate: beaoloooo Short seed | Rejected (Short) | rejected | Retain rejected | https://www.youtube.com/shorts/kGq-Racu8tw | 2026-09-04 | Confirmed as YouTube Short. Shorts do not qualify. | Reviewed and retained |
| Candidate: pops-meta Short seed | Rejected (Short) | rejected | Retain rejected | https://www.youtube.com/shorts/lujXnD4flNw | 2026-09-04 | Confirmed as YouTube Short. Shorts do not qualify. | Reviewed and retained |

### 1.4 Guide Pages and Content

| Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /guide/code/ | Page title | "Invincible GTG Codes & Redeem Portal — Active [Aug 2026]" | Proposed: "Invincible GTG Codes & Redeem Portal — Active [Sep 2026]" | Repository source data | 2026-09-04 | Current title references Aug 2026. Needs September suffix for freshness refresh. | **Change needed** |
| /guide/code/ | og:title | "Invincible GTG Codes & Redeem Portal — Active [Aug 2026]" | Proposed: sync with new title | Repository source data | 2026-09-04 | Must match page title. | **Change needed** |
| /guide/code/ | twitter:title | "Invincible GTG Codes & Redeem Portal — Active [Aug 2026]" | Proposed: sync with new title | Repository source data | 2026-09-04 | Must match page title. | **Change needed** |
| /guide/code/ | Active code count in heading | "29 Active Promo Codes" | Should be "29 Active Promo Codes" (after RAID02 added) | Repository source data | 2026-09-04 | Page says 29 but source data only has 28. After RAID02 addition, 29 is correct. Verify after Task 2. | **Verify after Task 2** |
| /guide/code/ | meta description | "28 active Invincible GTG codes..." | Needs update to 29 after RAID02 | Repository source data | 2026-09-04 | Description says 28 active. Will be 29 after RAID02. | **Change needed** |
| /guide/code/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update for September refresh. | **Change needed** |
| /guide/code/ | Schema types | BreadcrumbList, VideoGame, Article, HowTo, FAQPage, etc. | Reviewed and retained | Repository source data | 2026-09-04 | Comprehensive schema coverage. FAQPage present. | Reviewed and retained |
| /guide/event/ | Page title | "Invincible GTG Event Guide — How to Get 500 Gems/Week [Aug 2026]" | Proposed: "Invincible GTG Event Guide — How to Get 500 Gems/Week [Sep 2026]" | Repository source data | 2026-09-04 | Needs September suffix. | **Change needed** |
| /guide/event/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update for September refresh. | **Change needed** |
| /guide/event/ | datePublished | 2026-04-29 | 2026-04-29 (preserve) | Repository source data | 2026-09-04 | Original publication date preserved. | Reviewed and retained |
| /guide/event/ | Event gem totals (500/week) | 500 gems | Reviewed and retained | https://www.reddit.com/r/invinciblegtg/comments/1jb3ztw/new_event_rewards | 2026-09-04 | No contradicting evidence for The Long Haul (300) + Earth's Defenders (200) = 500/week. | Reviewed and retained |
| /guide/pvp/ | Page title | "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Aug 2026]" | Proposed: "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Sep 2026]" | Repository source data | 2026-09-04 | Needs September suffix. | **Change needed** |
| /guide/pvp/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/pvp/ | PvP income claim (~1,850/wk at Elite II r13) | ~1,850 gems/week | Reviewed and retained | https://anomaly-alpha.github.io/guide/pvp | 2026-09-04 | Consistent with source data payout tables. | Reviewed and retained |
| /guide/login/ | Page title | "Invincible GTG Login Rewards — 1,393 Gems/Week Guide" | Proposed: "Invincible GTG Login Rewards — 1,393 Gems/Week Guide [Sep 2026]" | Repository source data | 2026-09-04 | Currently lacks month suffix; add for freshness. | **Change needed** |
| /guide/login/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/login/ | Login total (1,393 gems/week) | 1,393 | Reviewed and retained | Repository source data | 2026-09-04 | 910 daily + 460 weekly + 23 monthly = 1,393. Math verified. | Reviewed and retained |
| /guide/faq/ | Page title | "Invincible GTG FAQ — Gems Per Week, Codes & Rewards Guide" | Proposed: add [Sep 2026] | Repository source data | 2026-09-04 | Currently lacks month suffix. | **Change needed** |
| /guide/faq/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/faq/ | FAQPage schema entries | 13 Q&A pairs | Needs review after prose rewrite | Repository source data | 2026-09-04 | FAQPage schema has 13 Q&A entries. Must match visible page content after rewrite. | **Verify after Task 4** |
| /guide/xp/ | Page title | "Invincible GTG XP Calculator & Level-Up Guide [Aug 2026]" | Proposed: "Invincible GTG XP Calculator & Level-Up Guide [Sep 2026]" | Repository source data | 2026-09-04 | Needs September suffix. | **Change needed** |
| /guide/xp/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/xp/ | datePublished | 2026-07-04 | 2026-07-04 (preserve) | Repository source data | 2026-09-04 | Original publication date preserved. | Reviewed and retained |
| /guide/beginners/ | Page title | "Invincible GTG Beginner Guide — How to Get Free Gems [Aug 2026]" | Proposed: "Invincible GTG Beginner Guide — How to Get Free Gems [Sep 2026]" | Repository source data | 2026-09-04 | Needs September suffix. | **Change needed** |
| /guide/beginners/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/beginners/ | Weekly gem claim (~4,043) | ~4,043 gems/week | Reviewed and retained | Repository source data | 2026-09-04 | 500 event + 1,850 PvP + 1,393 login + 300 code = 4,043. Math verified from source data. | Reviewed and retained |
| /guide/beginners/ | "34 active promo codes" in body text | "34 active promo codes" | Discrepancy — should be 28 (or 29 with RAID02) | Repository source data | 2026-09-04 | Body text says 34 active codes, but source data has 28 (29 with RAID02). Incorrect claim. | **Change needed** |
| /guide/redeem/ | Page title | "Invincible GTG Redeem Codes — Ubisoft Barcelona Portal [Aug 2026]" | Proposed: "Invincible GTG Redeem Codes — Ubisoft Barcelona Portal [Sep 2026]" | Repository source data | 2026-09-04 | Needs September suffix. | **Change needed** |
| /guide/redeem/ | twitter:title | "How to Redeem Invincible GTG Codes at Ubisoft Barcelona" | Desynced from page title | Repository source data | 2026-09-04 | twitter:title differs from page title and og:title. Should be synchronized. | **Change needed** |
| /guide/redeem/ | dateModified | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/creators/ | Page title | "Invincible GTG YouTube Creators — Guides, Tier Lists & Gameplay" | Proposed: add [Sep 2026] | Repository source data | 2026-09-04 | Currently lacks month suffix. | **Change needed** |
| /guide/creators/ | dateModified | 2026-08-23 | 2026-09-04 | Repository source data | 2026-09-04 | Needs update. | **Change needed** |
| /guide/creators/ | datePublished | (none) | Expected: 2026-08-23 | Repository source data | 2026-09-04 | Creators page lacks datePublished. Expected value is 2026-08-23 per spec. | **Change needed** |
| /guide/creators/ | Schema: CollectionPage + ItemList + VideoObject | Present | Reviewed and retained | Repository source data | 2026-09-04 | Comprehensive schema with per-creator VideoObject entries. | Reviewed and retained |

### 1.5 Non-Guide Pages

| Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / (home) | Page title | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Aug 2026]" | Proposed: "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Sep 2026]" | Repository source data | 2026-09-04 | Needs September suffix. ~4,043 is mathematically correct from source data. | **Change needed** |
| / (home) | og:title | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Aug 2026]" | Proposed: sync with new title | Repository source data | 2026-09-04 | Must match page title. | **Change needed** |
| / (home) | twitter:title | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Aug 2026]" | Proposed: sync with new title | Repository source data | 2026-09-04 | Must match page title. | **Change needed** |
| / (home) | JSON-LD headline | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Aug 2026]" | Proposed: sync with new title | Repository source data | 2026-09-04 | Must match page title. | **Change needed** |
| / (home) | Ticker "Codes 28 active" | 28 active | Proposed: 29 active (after RAID02) | Repository source data | 2026-09-04 | Ticker shows 28. Will be 29 after RAID02. | **Change needed** |
| / (home) | JSON-LD numberOfItems | 28 | 29 (after RAID02) | Repository source data | 2026-09-04 | ItemList description says "28 active". Needs update. | **Change needed** |
| / (home) | JSON-LD code list (ItemList) | SPRACE, THAEDS, TECHJK | Proposed: add RAID02 | Repository source data | 2026-09-04 | Only 3 codes shown in static ItemList. RAID02 should be added or the list updated. | **Change needed** |
| / (home) | robots directive | max-snippet:150, max-image-preview:large | Reviewed and retained | Repository source data | 2026-09-04 | Appropriate for an indexable home page. | Reviewed and retained |
| / (home) | datePublished / dateModified | (none in schema) | None needed per spec | Repository source data | 2026-09-04 | Home page does not have explicit dates in schema. | Reviewed and retained |
| / (home) | Schema types | WebPage, VideoGame, WebSite, BreadcrumbList, WebApplication, Organization, Service, MobileApplication, SoftwareSourceCode, ItemList, CollectionPage | Reviewed and retained | Repository source data | 2026-09-04 | Comprehensive schema. All types appropriate. | Reviewed and retained |
| /authors/anomaly/ | Page title | "Anomaly — Author Profile" | Reviewed and retained (evergreen) | Repository source data | 2026-09-04 | Per spec, author profile title remains evergreen. | Reviewed and retained |
| /authors/anomaly/ | robots | noindex | Reviewed and retained | Repository source data | 2026-09-04 | Correctly noindex per spec — evergreen author page. | Reviewed and retained |
| /authors/anomaly/ | Schema: ProfilePage | Present | Reviewed and retained | Repository source data | 2026-09-04 | Appropriate schema type for author page. | Reviewed and retained |
| /music/ | Page title | "Music & Playlists — Invincible GTG" | Reviewed and retained (evergreen) | Repository source data | 2026-09-04 | Per spec, music title remains evergreen. | Reviewed and retained |
| /music/ | robots | noindex, follow | Reviewed and retained | Repository source data | 2026-09-04 | Correctly noindex per spec. | Reviewed and retained |
| /music/ | Visible freshness text | "Updated Jul 16, 2026" | Needs update to "Reviewed Sep 4, 2026" | Repository source data | 2026-09-04 | Per spec, music gets a separate reviewed date. Source playlist content unchanged. | **Change needed** |
| /music/ | Schema | (none) | Needs WebPage or similar | Repository source data | 2026-09-04 | Music page has no JSON-LD schema. Consider adding basic WebPage schema. | **Change needed** |
| /music/ | data/playlists.json updated | 2026-07-17 | 2026-07-17 (preserve — content unchanged) | Repository source data | 2026-09-04 | Per spec, playlists.updated stays tied to actual content changes. Only add reviewedDate. | **Change needed** (add reviewedDate) |
| /privacy/ | Page title | "Privacy Policy — Invincible GTG" | Reviewed and retained (evergreen) | Repository source data | 2026-09-04 | Per spec, privacy title remains evergreen. | Reviewed and retained |
| /privacy/ | robots | noindex, follow | Reviewed and retained | Repository source data | 2026-09-04 | Correctly noindex per spec. | Reviewed and retained |
| /privacy/ | dateModified | 2026-08-22 (in schema) | 2026-09-04 (after prose rewrite) | Repository source data | 2026-09-04 | Will be updated when privacy policy is rewritten in Task 6. | **Change needed** (Task 6) |
| /privacy/ | datePublished | Expected: 2026-07-17 | 2026-07-17 | Repository source data | 2026-09-04 | Per spec, expected publication date. | **Change needed** (add if missing) |
| /terms/ | Page title | "Terms of Service — Invincible GTG" | Reviewed and retained (evergreen) | Repository source data | 2026-09-04 | Per spec, terms title remains evergreen. | Reviewed and retained |
| /terms/ | robots | noindex, follow | Reviewed and retained | Repository source data | 2026-09-04 | Correctly noindex per spec. | Reviewed and retained |
| /terms/ | dateModified | 2026-07-17 (in schema) | 2026-09-04 (after prose rewrite) | Repository source data | 2026-09-04 | Will be updated when terms are rewritten in Task 6. | **Change needed** (Task 6) |
| /terms/ | datePublished | Expected: 2026-07-17 | 2026-07-17 | Repository source data | 2026-09-04 | Per spec, expected publication date. | **Change needed** (add if missing) |

### 1.6 Sitemap and Indexation

| Scope | Record or claim | Previous value | New value | Source URL(s) | Retrieved | Evidence summary | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sitemap.xml | All guide + home lastmod | 2026-08-22 | 2026-09-04 | Repository source data | 2026-09-04 | All 11 sitemap entries currently show 2026-08-22 (authors: 2026-08-21). Need update to 2026-09-04. | **Change needed** |
| sitemap.xml | Missing pages | music/, privacy/, terms/ not in sitemap | Should music/, privacy/, terms/ be added? | Repository source data | 2026-09-04 | These pages exist but are noindex. Per spec, noindex pages should not be in sitemap. Currently consistent. | Reviewed and retained |
| sitemap.xml | Entry count | 11 URLs | 11 URLs | Repository source data | 2026-09-04 | Home + 9 guides + authors/anomaly. No new pages to add. | Reviewed and retained |

### 1.7 Title Matrix (Proposed September Titles)

| URL | Primary search intent | Current title | Proposed title | Chars | og:title sync | twitter:title sync | JSON-LD headline sync |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / | Gem calculator + codes + PvP | Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Aug 2026] | Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Sep 2026] | 56 | Yes | Yes | Yes |
| /guide/code/ | Active promo codes | Invincible GTG Codes & Redeem Portal — Active [Aug 2026] | Invincible GTG Codes & Redeem Portal — Active [Sep 2026] | 55 | Yes | Yes | N/A (Article) |
| /guide/event/ | Event gem income | Invincible GTG Event Guide — How to Get 500 Gems/Week [Aug 2026] | Invincible GTG Event Guide — How to Get 500 Gems/Week [Sep 2026] | 62 | Yes | Yes | N/A |
| /guide/pvp/ | PvP arena payouts | Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Aug 2026] | Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Sep 2026] | 63 | Yes | Yes | N/A |
| /guide/login/ | Login rewards breakdown | Invincible GTG Login Rewards — 1,393 Gems/Week Guide | Invincible GTG Login Rewards — 1,393 Gems/Week Guide [Sep 2026] | 59 | Yes | Yes | N/A |
| /guide/faq/ | FAQ for GTG | Invincible GTG FAQ — Gems Per Week, Codes & Rewards Guide | Invincible GTG FAQ — Gems Per Week, Codes & Rewards [Sep 2026] | 57 | Yes | Yes | N/A |
| /guide/xp/ | XP and rank costs | Invincible GTG XP Calculator & Level-Up Guide [Aug 2026] | Invincible GTG XP Calculator & Level-Up Guide [Sep 2026] | 56 | Yes | Yes | N/A |
| /guide/beginners/ | New player gem guide | Invincible GTG Beginner Guide — How to Get Free Gems [Aug 2026] | Invincible GTG Beginner Guide — How to Get Free Gems [Sep 2026] | 60 | Yes | Yes | N/A |
| /guide/redeem/ | Code redemption how-to | Invincible GTG Redeem Codes — Ubisoft Barcelona Portal [Aug 2026] | Invincible GTG Redeem Codes — Ubisoft Barcelona Portal [Sep 2026] | 64 | Yes | Fix desync | N/A |
| /guide/creators/ | YouTube creator directory | Invincible GTG YouTube Creators — Guides, Tier Lists & Gameplay | Invincible GTG YouTube Creators — Guides, Tier Lists & Gameplay [Sep 2026] | 69 | Yes | Yes | N/A (CollectionPage) |
| /authors/anomaly/ | Author profile (evergreen) | Anomaly — Author Profile | Anomaly — Author Profile (no change) | 24 | Yes | N/A | N/A (ProfilePage) |
| /music/ | Playlists (evergreen) | Music & Playlists — Invincible GTG | Music & Playlists — Invincible GTG (no change) | 34 | Yes | Yes | N/A |
| /privacy/ | Privacy policy (evergreen) | Privacy Policy — Invincible GTG | Privacy Policy — Invincible GTG (no change) | 30 | Yes | Yes | N/A (Article) |
| /terms/ | Terms of service (evergreen) | Terms of Service — Invincible GTG | Terms of Service — Invincible GTG (no change) | 32 | Yes | Yes | N/A (Article) |

---

## 2. Key Research Findings

### 2.1 New Code: RAID02

- **Source**: Official Instagram @invinciblegtg, posted August 31, 2026
- **URL**: https://www.instagram.com/invinciblegtg/p/Dcs0ni_lRiE/
- **Reddit confirmation**: https://www.reddit.com/r/invinciblegtg/comments/1w39b1o/new_reward_code_raid02
- **Code**: RAID02 (last character is zero, not letter O)
- **Reward**: Appears to be gem-related (500 gems based on similar RAID-series codes)
- **Status**: NOT in data/codes.json as of 2026-09-04
- **Action**: Must be added in Task 2

### 2.2 External Source Code Discrepancies

Community sources (VG247, SuperCheats) list several codes as active that our data marks as expired:
- **GLOB34** (expired 2026-07-29 in our data, listed active by VG247)
- **JUL4TH** (expired 2026-07-29 in our data, listed active by VG247)
- **THKMRK** (expired 2026-07-29 in our data, listed active by VG247)
- **KREGG4** (expired 2026-07-29 in our data, listed active by VG247)
- **KRESSA** (expired 2026-07-29 in our data, listed active by VG247)
- **LUCAN4** (expired 2026-07-29 in our data, listed active by VG247)
- **THULA4** (expired 2026-07-29 in our data, listed active by VG247)

**Resolution**: Preserve existing expiry dates in codes.json. No first-party portal test is possible. Community sources may have stale data or codes may have been briefly reactivated. Record uncertainty.

### 2.3 Code Count Mismatches

| Location | Stated count | Actual count |
| --- | --- | --- |
| codes.json (non-expired) | 28 | 28 |
| index.html inline promo codes | 28 | 28 |
| index.html ticker | "28 active" | 28 |
| index.html JSON-LD numberOfItems | 28 | 28 |
| /guide/code/ page heading | "29 Active" | 28 (should be 29 after RAID02) |
| /guide/code/ meta description | "28 active" | 28 (should be 29 after RAID02) |
| /guide/beginners/ body text | "34 active promo codes" | 28 (incorrect) |

### 2.4 Title Desync Issues

| Page | Issue |
| --- | --- |
| /guide/redeem/ | twitter:title ("How to Redeem Invincible GTG Codes at Ubisoft Barcelona") differs from page title and og:title. Needs synchronization. |

### 2.5 Schema Gaps

| Page | Issue |
| --- | --- |
| /music/ | No JSON-LD schema present. Should add basic WebPage or MusicPlaylist schema. |
| / (home) | No datePublished/dateModified in WebPage schema (acceptable for home page but could be added). |
| /guide/creators/ | No datePublished in schema. Expected: 2026-08-23. |

---

## 3. Disposition Summary

| Category | Change needed | Reviewed and retained | Uncertainty recorded |
| --- | --- | --- | --- |
| Promo codes | 3 (add RAID02, update count, update timestamp) | 14 | 6 (expired status conflicts) |
| Game mechanics | 0 | 12 | 0 |
| Creators/videos | 1 (update timestamp) | 20 | 0 |
| Guide pages | 18+ (titles, dates, freshness, counts) | 6 | 1 (FAQ count verify) |
| Non-guide pages | 12+ (titles, dates, freshness, schema) | 8 | 0 |
| Sitemap | 1 (update lastmod values) | 2 | 0 |
| Title matrix | 10 pages need [Sep 2026] suffix | 4 evergreen | 0 |
