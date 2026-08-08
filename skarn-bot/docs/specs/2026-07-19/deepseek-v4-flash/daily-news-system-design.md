# Daily News System

## [S1] Problem

Skarn has no awareness of current events. Users discussing tech news, game releases, or breaking stories get generic replies. The bot already has Google CSE integration but uses it only for on-demand searches.

## [S2] Solution

Hourly fetch of tech/gaming headlines via Google CSE, stored in SQLite, injected at the TOP of the context pipeline. Optional daily digest in a designated channel. Skarn presents news naturally in conversation, letting the AI decide tone.

## [S3] Changes

### New file: `skarn-bot/features/news/newsFetcher.js`

- `fetchNews()` — searches Google CSE for "tech and gaming news today" (single query to conserve quota)
- Stores top 10 results in `daily_news` table
- Prunes entries older than 24h
- Returns count of new articles

### New file: `skarn-bot/features/news/newsDigest.js`

- `postDigest(client)` — posts top 5 headlines as embed in configured channel
- Uses `getGuildConfig(guildId, 'newsChannel')` to find target channel
- Skarn presents headlines in casual anchor voice

### New file: `skarn-bot/commands/news.js`

- `/news` — shows current top headlines as embed
- `skarn news` — same via activation phrase
- Optional `skarn news <topic>` — searches news for specific topic

### New SQLite table: `daily_news`

```sql
CREATE TABLE IF NOT EXISTS daily_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT NOT NULL,
  snippet TEXT,
  url TEXT,
  source TEXT,
  category TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_news_fetched ON daily_news(fetched_at);
CREATE INDEX IF NOT EXISTS idx_daily_news_category ON daily_news(category);
```

### Modified: `skarn-bot/features/promptContext.js`

- Add `newsLine` to context (TOP of pipeline, after roleLine)
- Queries `daily_news` for recent headlines
- Formats as: `Today's headlines: [headline 1] | [headline 2] | ...`

### Modified: `skarn-bot/persona/identity.js`

- Add `newsLine` parameter to `buildSystemPrompt()`
- Insert after `roleLine` (before stateLine)

### Modified: `skarn-bot/bot.js`

- Add `setInterval` for hourly news fetch (3,600,000ms)
- Add `setInterval` for daily digest at 6pm server time
- Import and start news fetcher on bot ready

### Modified: `skarn-bot/commands/help.js`

- Add "News" category with `/news` command

## [S4] Data Flow

```
Hourly (setInterval)
  → fetchNews()
    → searchWeb("tech and gaming news today") via Google CSE
    → Store top 10 in daily_news
    → Prune entries > 24h old

User message
  → buildContext()
    → query daily_news for recent headlines
    → newsLine = "Today's headlines: ..."
    → buildSystemPrompt({ roleLine, newsLine, stateLine, ... })
    → AI sees news at TOP of context

Daily digest (6pm server time)
  → postDigest(client)
    → getGuildConfig(guildId, 'newsChannel')
    → Post top 5 headlines as embed
```

## [S5] Edge Cases

| Case | Behavior |
|------|----------|
| Google CSE quota exceeded | Log warning, skip fetch, use existing cached news |
| No news channel configured | Skip digest posting |
| No articles found | newsLine is empty, AI responds normally |
| News table empty | newsLine is empty, no context injection |
| Multiple guilds | Each guild sees same news (global table), digest only posts to guilds with newsChannel configured |

## [S6] Verification

1. `cd skarn-bot && node -e "require('./features/news/newsFetcher')"` — no import errors
2. `cd skarn-bot && node -e "require('./bot')"` — bot starts, logs news fetch
3. Check `daily_news` table has rows after first fetch
4. Send message in Discord — Skarn should reference news if relevant
5. Run `/news` — should show current headlines embed
