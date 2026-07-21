# Wikipedia Knowledge Base Daily Refresh

## [S1] Problem

The bot's knowledge base is seeded with 117 hardcoded topics. This limits Skarn's ability to reference diverse topics in conversations. Users discussing sports, music, movies, food, or niche interests get no knowledge snippets injected into the AI prompt.

## [S2] Solution

Replace the static 117-topic seed with a daily Wikipedia fetch that loads the top ~1000 most-viewed articles. Keep the existing 117 topics as a fallback if the API is unavailable. Check a cooldown timestamp in `app_state` to avoid re-fetching within 24 hours.

## [S3] Changes

### File: `skarn-bot/features/knowledge/knowledgeSeeder.js`

- Keep existing `SEED_TOPICS` array as `FALLBACK_TOPICS`
- Add `async function fetchWikipediaTopics()` that:
  1. Fetches top 500 most-viewed articles from `https://en.wikipedia.org/w/api.php?action=query&list=mostviewed&pvimlimit=500&format=json`
  2. Fetches next 500 (page 2) via `&pvoffset=500`
  3. Collects all article titles
  5. Filters out non-article pages (titles starting with `Special:`, `Main Page`, `Wikipedia:`)
  6. Batches titles into groups of 50
  7. For each batch, fetches summaries via `https://en.wikipedia.org/w/api.php?action=query&titles=X|Y|Z&prop=extracts&exintro=true&explaintext=true&exlimit=50&format=json`
  8. Keeps full first paragraph (Wikipedia `exintro` already returns just the intro)
  9. Normalizes topic names: lowercase, replace underscores with spaces
  10. Calls `addKnowledgeBase(topic, summary, 'wikipedia', 0.9)` for each
  11. Returns count of topics fetched
- Modify `seedKnowledgeBase()` to:
  1. Always run `seedFallbackTopics()` first (synchronous, immediate)
  2. Check `getAppState('last_wikipedia_seed')`
  3. If timestamp exists and is <24h old, log `[Knowledge] Using cached data (last seed: Xh ago)` and return
  4. If timestamp is missing or >24h old, launch `fetchWikipediaTopics()` in background (don't await)
  5. Background fetch: on success, update `setAppState('last_wikipedia_seed', Date.now())` and log count
  6. Background fetch: on API error, log warning (fallback topics already loaded)

### File: `skarn-bot/features/knowledge/knowledgeBase.js`

- Remove the `w.length > 3` filter in `searchKnowledge()` to match any word length
- This allows acronyms like "NBA", "NFL", "AI" to match knowledge topics

### File: `skarn-bot/db/database.js`

- Export `getAppState` and `setAppState` (already exported at line 753)
- Verify `addKnowledgeBase` upserts correctly (already does via `ON CONFLICT`)

## [S4] Data Flow

```
Bot start
  → seedKnowledgeBase()
    → seedFallbackTopics() [117 hardcoded, synchronous]
    → getAppState('last_wikipedia_seed')
    → if <24h old: log "cached", return
    → if >24h or missing:
        → launch fetchWikipediaTopics() [background, non-blocking]
          → fetch mostviewed (page 1: 0-499)
          → fetch mostviewed (page 2: 500-999)
          → filter non-article pages
          → batch titles (50 per batch)
          → fetch summaries per batch
          → keep full first paragraph
          → addKnowledgeBase() for each
        → setAppState('last_wikipedia_seed', now)
        → log "[Knowledge] Seeded N topics (X fallback + Y wikipedia)"
```

## [S5] Edge Cases

| Case | Behavior |
|------|----------|
| Wikipedia API down | Log warning, use fallback topics only |
| API returns <1000 articles | Use whatever is returned |
| Summary is empty | Skip that topic |
| Topic already exists | Upsert (update summary and timestamp) |
| First boot (no app_state) | Fetch immediately |
| Rate limit hit | Retry once after 2s, then skip remaining batch |

## [S6] Verification

1. `cd skarn-bot && node -e "require('./features/knowledge/knowledgeSeeder')"` — no import errors
2. `cd skarn-bot && node -e "require('./bot')"` — bot starts, logs topic count
3. Check `app_state` table has `last_wikipedia_seed` row after first run
4. Restart bot within 24h — should log "cached" and skip fetch
5. Manually delete `last_wikipedia_seed` from `app_state` — should re-fetch on next start
