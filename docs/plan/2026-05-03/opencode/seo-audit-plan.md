# SEO Audit Plan — anomaly-alpha.github.io

*Confirmed decisions from grill session. Structured data answers must match visible content verbatim per Q&A pair.*

## 🔴 CRITICAL — Fix data inconsistency

### `guide/faq/index.html`

**Structured data (Q1, lines 36-41):**
- `3,643` → `4,043`
- `login rewards (993)` → `login rewards (1,393)`

**Structured data (Q5, lines 67-72):**
- `993` → `1,393`
- `weekly (60)` → `weekly (460 = 60+400)`

**Visible text (Q1 card, line 111):**
- `3,643` → `4,043`
- `login rewards (993)` → `login rewards (1,393)`

**Leave alone (already correct):**
- Q2 card (line 115): `"1,393 gems/week"`
- Q5 card (line 123): `"1,393 gems per week"`

### `guide/beginners/index.html`

- Line 72: `~3,643 GEMS / WEEK` → `~4,043 GEMS / WEEK`
- Line 83: `993 / week` → `1,393 / week`
- Line 85: `993 guaranteed` → `1,393`

### `guide/login/index.html`

- **No changes needed** — all numbers already correct

---

## 🔴 H1 on main page (`index.html`)

```
Current:
  <h1>GEM REWARDS</h1>            ← game name in sr-only span
  <p>INVINCIBLE GUARDING THE GLOBE</p>

Change to:
  <h1>INVINCIBLE GUARDING THE GLOBE — GEM REWARDS</h1>
  <p>WEEKLY GEM INCOME CALCULATOR</p>
```

---

## 🔴 Expand thin meta descriptions

### `guide/faq/index.html`
```
"FAQ: How many gems can you earn per week in Invincible Guarding the Globe? ~4,043 from events, PvP, login rewards (1,393), and promo codes. Full breakdown with PvP payout tables."
```

### `guide/beginners/index.html`
```
"New to Invincible Guarding the Globe? Learn how to earn ~4,043 free gems per week from login rewards, events, PvP arena payouts, and promo codes. Complete beginner's guide with priority checklist."
```

---

## 🟡 VideoGame schema enrichment

Add to existing `VideoGame` entity in main page JSON-LD:
```json
"applicationCategory": "Game",
"operatingSystem": "iOS, Android",
"gamePlatform": "iOS, Android"
```

---

## 🟡 Sitemap — strip lastmod

Remove `<lastmod>` tags from all 7 URLs. No script needed.

---

## 🟡 Author structured data

Add "Sy" as 4th Person entry. No URLs.
```json
"author": [
  { "@type": "Person", "name": "Anomaly" },
  { "@type": "Person", "name": "TheOneTruePanda" },
  { "@type": "Person", "name": "dbp loves allen" },
  { "@type": "Person", "name": "Sy" }
]
```

---

## 🟢 Long term

- Branded 404 page with links to main content
- After deploy: monitor Search Console FAQ rich result impressions + community outreach with deep links
