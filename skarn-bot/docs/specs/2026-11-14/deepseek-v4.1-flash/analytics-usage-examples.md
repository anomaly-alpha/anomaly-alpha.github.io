# Skarn Analytics — Usage Examples

Companion to [`skarn-analytics-query-spec.md`](./skarn-analytics-query-spec.md).

> **PARKED 2026-11-14 — illustrative only.** The numbers below are **not** computed from the
> snapshot; several are invented shapes and one is a real figure from the wrong window
> (`invincible gtg codes` 3,822 clicks is the 181-day total, not 28 days). Do not quote them.
> The natural-language embeds shown here also assume a rendering path that does not exist —
> `runTool` returns text to the model, not an embed to the channel. See the spec's
> "Read this first" block for the full defect list.

Three things worth knowing before reading:

- **Skarn's replies are prose only.** Every number lives in the embed. The model reads the same
  data as text and writes one or two flat sentences around it — it never retypes a table.
- **Every data embed carries a footer**: `window · source (cache|live) · data state`. There is no
  code path that renders numbers without one.
- Numbers below are illustrative shapes. Where a real value is known from the 2026-11-13 snapshot
  it is used verbatim (the `invincible gtg codes` query: 3,822 clicks, 9,043 impressions, 42.3%
  CTR, position 2.1; search appearance `TRANSLATED_RESULT`).

---

## A. The default question

### A1. Natural language

> **user** — how's the site doing

**Skarn calls**

```json
{"name":"site_analytics","arguments":{"report":"overview","days":28}}
```

**Embed**

```
Site overview · last 28 days
─────────────────────────────────────────
Search (GSC)      clicks 5,412   ▲ 11.8%
                  impr. 38,120   ▲  4.2%
                  CTR      14.2%  ▲  0.9pp
                  position  8.4   ▼  0.3
Traffic (GA4)     sessions 1,930  ▲  6.1%
                  users    1,644  ▲  5.0%
Top query   invincible gtg codes · 3,822 clicks
Top page    /guide/code/ · 2,904 clicks
─────────────────────────────────────────
2026-10-17..2026-11-13 (28d, GSC final) · cache
```

> **Skarn** — "steady climb, and it's all one page. everything else is a rounding error beside the codes guide."

### A2. The slash equivalent

```
/analytics report:overview days:28
```

Same embed, no AI call at all. This is the cheap path: it skips the model entirely, so it works
even if `OPENAI_API_KEY` is missing or the guild's AI budget is exhausted.

---

## B. Queries and ranking

### B1. Top queries

> **user** — what are people searching to find us

```json
{"name":"site_analytics","arguments":{"report":"queries","days":28,"limit":10}}
```

```
Top queries · last 28 days
─────────────────────────────────────────
#   query                          clicks  impr.   ctr   pos
1   invincible gtg codes            3,822  9,043  42.3%  2.1
2   invincible guard the globe codes   411  2,208  18.6%  2.8
3   invincible gtg tier list          208  1,940  10.7%  5.4
4   gtg promo codes                     187    902  20.7%  3.0
5   invincible gtg wish event           96  1,335   7.2%  6.9
…
─────────────────────────────────────────
2026-10-17..2026-11-13 (28d, GSC final) · cache
queries below Google's reporting threshold are omitted
```

> **Skarn** — "one query does almost all of it. the wish event is at seven percent ctr on thirteen hundred impressions, which is a snippet problem, not a demand problem."

### B2. The filter the model is allowed to use

> **user** — any codes-related queries in there

```json
{"name":"site_analytics","arguments":{"report":"queries","days":28,"filter":"code"}}
```

```
Top queries matching "code" · last 28 days
─────────────────────────────────────────
1  invincible gtg codes            3,822  9,043  42.3%  2.1
2  invincible guard the globe codes   411  2,208  18.6%  2.8
3  gtg promo codes                     187    902  20.7%  3.0
4  invincible gtg codes 2026           71    410  17.3%  4.1
─────────────────────────────────────────
2026-10-17..2026-11-13 (28d, GSC final) · cache
queries below Google's reporting threshold are omitted
```

### B3. A ranking question that the guardrails actually change

> **user** — what's our average position for the codes queries

This is the trap case. `position` is the impression-weighted average rank of the site's topmost
result, so averaging the four rows above gives 3.0 — but the impression-weighted answer is:

```
Σ(position × impressions) / Σ impressions
= (2.1·9043 + 2.8·2208 + 3.0·902 + 4.1·410) / 12563
= 2.37
```

> **Skarn** — "2.4, weighted by impressions. the plain average reads 3.0 and would be wrong — it treats a ten-impression query as if it mattered as much as the codes guide."

The renderer computes the weighted figure; it never averages the column (guardrail G2).

### B4. What Skarn refuses to do

> **user** — what position do we rank for that query on mobile in the UK

```
Neither `country` nor `device` can be combined with a position filter in one
request, and the cached tables don't hold that pair. Two options:
  /analytics report:countries
  /analytics report:devices
```

> **Skarn** — "can't split it that fine from cache. countries or devices, pick one and i'll pull it."

Two filters on different dimensions in one GSC request are `AND`-only (G6), and the query×page
pair is deliberately not cached for arbitrary pairs (G7).

---

## C. Pages and traffic destination

### C1. Which pages earn

> **user** — which pages are pulling clicks

```json
{"name":"site_analytics","arguments":{"report":"pages","days":28,"limit":8}}
```

```
Top pages by clicks · last 28 days
─────────────────────────────────────────
/guide/code/                     4,102  27,880  14.7%  4.6
/                                382   3,910   9.8%  6.2
/guide/wish-event/                166   2,204   7.5%  7.1
/guide/event/                     118   1,702   6.9%  8.0
/guide/creators/                   74   1,455   5.1%  9.3
/guide/pvp/                        58   1,338   4.3%  9.8
─────────────────────────────────────────
2026-10-17..2026-11-13 (28d, GSC final) · cache
```

> **Skarn** — "codes guide takes three quarters of it. the rest are finding their footing and paying about half the ctr for the privilege."

### C2. The GA4 twin

> **user** — which pages do visitors actually land on

```json
{"name":"site_analytics","arguments":{"report":"landing","days":28}}
```

```
Landing pages (GA4) · last 28 days
─────────────────────────────────────────
/guide/code/        1,204 sessions   62.4%   41s
/                    298 sessions   51.2%   33s
/guide/creators/      87 sessions   58.7%   29s
─────────────────────────────────────────
2026-10-15..2026-11-12 (28d, GA4) · cache
```

> **Skarn** — "same answer from the other side. codes guide lands them, and they stay."

### C3. Where the two sources disagree

> **user** — do gsc and analytics agree on the codes page

```
/guide/code/  ·  28 days
─────────────────────────────────────────
GSC   clicks  4,102   impressions 27,880
GA4   sessions   1,204   source: Organic Search  1,061
─────────────────────────────────────────
2026-10-17..2026-11-13 (GSC final) · 2026-10-15..2026-11-12 (GA4) · cache
```

> **Skarn** — "gsc counts four thousand clicks, analytics one thousand sessions. expected — no script on the watch tree, consent, and one click can be four impressions. trust the ratio, not the level."

This is a genuinely useful answer *because* the report shows both sources side by side instead of
pretending they reconcile.

---

## D. Traffic composition (GA4)

### D1. Channels

> **user** — where's our traffic coming from

```json
{"name":"site_analytics","arguments":{"report":"traffic","days":28}}
```

```
Traffic by channel · last 28 days
─────────────────────────────────────────
Organic Search    1,061   55.0%   42s
Direct              604   31.3%   28s
Referral            188    9.7%   36s
Organic Social       77    4.0%   25s
─────────────────────────────────────────
2026-10-15..2026-11-12 (28d, GA4) · cache
```

> **Skarn** — "organic is the only channel that matters. a third of it is direct, which is probably returners from the codes page."

### D2. Events

> **user** — are people clicking the copy button

```json
{"name":"site_analytics","arguments":{"report":"events","days":28,"limit":10}}
```

```
Events · last 28 days
─────────────────────────────────────────
page_view                     4,880 users
copy_code                       622 users
scroll                          410 users
click_outbound                   97 users
─────────────────────────────────────────
2026-10-15..2026-11-12 (28d, GA4) · cache
```

---

## E. Diagnostics

### E1. Is a page indexed

> **user** — is the wish event page indexed

```json
{"name":"site_analytics","arguments":{"report":"inspect","url":"https://anomaly-alpha.github.io/guide/wish-event/"}}
```

```
URL Inspection · live
─────────────────────────────────────────
url        /guide/wish-event/
verdict    PASS
coverage   Submitted and indexed
last crawl 2026-11-11 04:12
canonical  matches
rich results  FAQPage: not eligible (deprecated)
─────────────────────────────────────────
live · GSC · inspected just now · cached 7 days
```

> **Skarn** — "indexed and crawled two days ago. the faq markup in there is dead weight now — google retired those rich results."

Note the `live` in the footer and the one-per-invocation cap (G10): 2,000 inspections a day sounds
generous until a loop spends it.

### E2. Rich results / search appearance

> **user** — are we getting any rich results

```json
{"name":"site_analytics","arguments":{"report":"appearance","days":90}}
```

```
Search appearance · last 90 days
─────────────────────────────────────────
TRANSLATED_RESULT   clicks 41   impressions 2,904
─────────────────────────────────────────
2026-08-15..2026-11-13 (90d, GSC final) · cache
Rich-result issues (from last inspection pass): 0 errors
```

> **Skarn** — "one appearance type, and it's auto-translation. the structured data validates and earns nothing — detected isn't the same as shown."

### E3. Sitemaps

> **user** — are the sitemaps fine

```json
{"name":"site_analytics","arguments":{"report":"sitemaps"}}
```

```
Sitemaps · live
─────────────────────────────────────────
/sitemap.xml   submitted 2026-11-13  0 errors  0 warnings  218 urls
─────────────────────────────────────────
live · GSC · fetched just now
```

---

## F. Trends and comparisons

### F1. Trend

> **user** — show me the last month by day

```json
{"name":"site_analytics","arguments":{"report":"trend","days":28,"metric":"clicks"}}
```

```
Clicks by day · last 28 days
─────────────────────────────────────────
▁▂▂▃▂▅▇▃▂▂▃▂▂▁▂▃▂▂▄▃▂▂▃▂▂▂▃▂
low 118 (2026-10-20)   high 402 (2026-10-21)
─────────────────────────────────────────
2026-10-17..2026-11-13 (28d, GSC final) · cache
```

> **Skarn** — "one spike on the twenty-first and then back to the floor. that's a code drop, not growth."

### F2. Compare

> **user** — is this better than last month

```json
{"name":"site_analytics","arguments":{"report":"compare","days":28}}
```

```
28 days vs previous 28 days
─────────────────────────────────────────
                now      before    change
clicks        5,412     4,841     ▲ 11.8%
impressions  38,120    36,584     ▲  4.2%
ctr           14.20%    13.24%    ▲ 0.96pp
position       8.4       8.1      ▼  0.3
sessions      1,930     1,819     ▲  6.1%
─────────────────────────────────────────
2026-10-17..2026-11-13 vs 2026-09-19..2026-10-16 · GSC final · cache
```

> **Skarn** — "clicks up twelve percent on four percent more impressions. you're winning the snippet, not the auction."

---

## G. Status, and what happens when things break

### G1. Status

> **user** — is this data current

```json
{"name":"analytics_status","arguments":{}}
```

```
Analytics pipeline
─────────────────────────────────────────
credential   configured (skarn-analytics@…)
GSC  last sync 2026-11-14 09:12 ok · 1,832 query rows
     data through 2026-11-12 (final)
GA4  last sync 2026-11-14 09:12 ok · 604 rows
     data through 2026-11-13
bootstrap    snapshot 2026-11-13
quota        GSC live 12/1200 this hour · GA4 60/14000 tokens
─────────────────────────────────────────
```

> **Skarn** — "three days behind on search, which is as current as google gets. analytics is a day."

### G2. Before the key is set

> **user** — how many clicks yesterday

```json
{"name":"site_analytics","arguments":{"report":"trend","days":7,"metric":"clicks"}}
```

```
Clicks by day · last 7 days
─────────────────────────────────────────
▂▅▇▃▂▂▃
low 121   high 398
─────────────────────────────────────────
2026-10-17..2026-11-13 (28d, GSC final) · cache
GSC finalises after 2–3 days — yesterday is not final yet
live unavailable — no credential configured
```

> **Skarn** — "yesterday isn't final yet, and i have no key to ask for the partial. the last week i can see ends the twelfth."

This is the honest answer. The failure path says what is cached, says why, and does **not**
invent a number (G11).

### G3. Quota exhausted

> **user** — pull the last three months fresh

```json
{"name":"site_analytics","arguments":{"report":"overview","days":90,"fresh":true}}
```

```
Site overview · last 90 days
─────────────────────────────────────────
Search (GSC)      clicks 15,904
                  impr. 96,331
Traffic (GA4)     sessions 5,204
─────────────────────────────────────────
2026-08-15..2026-11-13 (90d, GSC final) · cache
live unavailable — Search Console quota exceeded, showing cache
```

> **Skarn** — "google cut me off, so this is the cache. same shape, maybe an hour behind."

### G4. GA4 not shared with the service account

> **user** — how many sessions this month

```json
{"name":"site_analytics","arguments":{"report":"traffic","days":28}}
```

```
Traffic · GA4 not configured
─────────────────────────────────────────
The Analytics property hasn't been shared with the bot's service
account yet, so there is no session data to show. Search Console
data still works.
─────────────────────────────────────────
```

> **Skarn** — "no analytics access yet. the search side works, the visitor side is dark until the property is shared."

---

## H. Multi-turn, within the 3-turn cap

The shared pipeline allows at most three model round-trips, so two tool calls. Chained questions
work when each step is one report.

> **user** — which pages lost the most clicks last month
>
> **Skarn** → `site_analytics {report:"pages", days:28}` then `site_analytics {report:"compare", days:28}`
>
> **Skarn** — "the creators page, mostly. seventy-four clicks now against a hundred and forty before — the ticker went live and nothing else changed."

If a third call would be required, Skarn answers from what it has and names the missing step:

> **Skarn** — "that needs a second pull. ask me again and i'll dig."

---

## I. Things Skarn should correct rather than answer

| user says | why it's wrong | what Skarn does |
|---|---|---|
| "how many clicks today" | GSC finalises after 2–3 days | offers the last 7 final days, states the lag |
| "what's our average position" (no scope) | a blended position across all queries is nearly meaningless | returns the impression-weighted figure **and** says it's weighted |
| "sum the query impressions to get our traffic" | GSC omits queries below a reporting threshold, so the sum is a floor | gives the property total from `['date']` (no dimension) instead |
| "show me demographics by age" | `userAgeBracket` is thresholded — rows get withheld, not zeroed | declines rather than reporting suppressed rows as 0 users |
| "why did traffic drop" | not in any API; it's a causal question | returns the numbers and says plainly it does not know the cause |
| "check these 40 URLs" | URL Inspection is 2,000/day and one-per-invocation here | offers the cached inspection table |

---

## J. Quick reference

```
/analytics report:overview   days:28                     # the default
/analytics report:queries    days:28 limit:10 filter:code
/analytics report:pages      days:28 sort:clicks
/analytics report:trend      days:28 metric:clicks        # clicks|impressions|ctr|position|sessions
/analytics report:compare    days:28
/analytics report:countries  days:28 limit:10
/analytics report:devices    days:28
/analytics report:appearance days:90
/analytics report:inspect    url:https://anomaly-alpha.github.io/guide/code/
/analytics report:sitemaps
/analytics report:traffic    days:28                      # GA4
/analytics report:landing    days:28                      # GA4
/analytics report:events     days:28 limit:10             # GA4
/analytics report:status
```

Chat forms that resolve to the same reports:

```
skarn analytics queries 7
skarn analytics traffic
how are the numbers looking
what are people searching for
which page gets the most clicks
is that up from last month
are we indexed for the wish event
is this data current
```

The last six are the point of the whole exercise: the same answer, asked the way a person actually
asks it.
