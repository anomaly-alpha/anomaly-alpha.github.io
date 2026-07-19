# Web Search for Skarn

## [S1] Problem

Skarn currently relies on the LLM's training data for knowledge. Cannot answer questions about:
- Current events, game patches, server status
- Recent game codes, promotions, or store updates
- Anything that changed after the model's training cutoff
- Specific out-of-knowledge-domain queries

Adding web search lets Skarn answer these in-character with up-to-date information.

## [S2] Solution overview

A single `/search <query>` slash command. When invoked:

1. Bot fetches DuckDuckGo search results for the query
2. Results are piped into an OpenAI chat completion as additional context
3. Skarn responds in-character, citing relevant search results naturally
4. A compact embed with the raw result URLs is appended for direct reference

## [S3] Search backend

**Library**: `duck-duck-scrape` npm package (unofficial DuckDuckGo wrapper, no API key needed)

**Why DuckDuckGo**:
- Free, no API key, no rate limit concerns for a single-server bot
- Returns real web results (not just Wikipedia or Instant Answers)
- Works from Railway without any service registration
- Acceptable fallback: if the package fails (breaking change upstream), the command returns a friendly error

**Caching**: In-memory LRU cache with 5-minute TTL per query. Keyed by normalized query string. Max 50 entries. Prevents repeated identical searches (e.g., two users asking the same thing in quick succession).

## [S4] Slash command

```
/search <query: string>
```

- `query` — the search term (required, 3-200 characters)
- Deferred reply pattern (matches `/consult` style): `interaction.deferReply()` immediately, then respond once results + LLM are ready
- Cooldown: 5 seconds per user (prevents spam)
- Rate limit: shared `canCall()` / `recordCall()` with the existing per-user rate limiter

## [S5] Handler flow

```
/search <query>
  │
  ├─ 1. Defer reply
  ├─ 2. Check cache — hit? → use cached results
  ├─ 3. duck-duck-scrape search(query, { safeSearch: -1 })
  ├─ 4. Extract top 5 results (title + snippet + url)
  ├─ 5. Build system prompt: Skarn's core identity + role + search context line
  ├─ 6. OpenAI chat completion with:
  │      system: Skarn identity + role + "Web search results for '<query>': ..."
  │      user: "Based on the search results above, answer: <query>"
  ├─ 7. Post-process (same postProcess.js as mentionRouter)
  ├─ 8. EditReply with:
  │      - Skarn's in-character answer
  │      - Compact embed with result URLs for reference
  └─ 9. Cache results, record rate limit
```

**Search context line format** (injected into system prompt):
```
Web search results for "latest anomaly alpha codes":
1. Title — snippet
2. Title — snippet
3. Title — snippet
4. Title — snippet
5. Title — snippet
```

**Edge cases**:
- **No results**: Skip the LLM call, reply directly with "Nothing came up for that. Try a different search."
- **Search service error**: Reply with an error message (same style as AI_ERRORS in mentionRouter)
- **LLM error after good search**: Still show the raw results as an embed so the user at least gets the links
- **Empty query**: Reply with "Search what?" (validation at command level)

## [S6] Files

**New**:
- `features/search/searchEngine.js` — wraps duck-duck-scrape, returns { results[], source }, includes LRU cache + cleanup timer
- `features/search/search.handler.js` — slash command handler with the flow above
- `commands/search.js` — slash command registration (deploy-commands.js picks it up automatically)

**Modified**:
- `deploy-commands.js` — add `/search` to deployment (auto-discovered from commands/ dir)
- `package.json` — add `duck-duck-scrape` dependency

**No changes to**:
- `bot.js` — no new hooks, no new imports
- `db/` — no DB tables
- `persona/identity.js` — no system prompt changes (search context is injected per-call)
- `features/promptContext.js` — not needed (search is standalone, not part of passive context)

## [S7] Error handling

| Scenario | Behavior |
|----------|----------|
| `duck-duck-scrape` fails/unavailable | Reply with "The search came up empty. Might be a connection issue." + show partial results if any |
| OpenAI call fails | Reply with the raw search results as an embed anyway |
| Query too short/long | Validation at command level with descriptive error |
| User on cooldown | Ephemeral reply with remaining time |
| Search returns 0 results | Direct reply without LLM call |

## [S8] Testing

- Unit test: `searchEngine.js` — mock duck-duck-scrape, verify result formatting, LRU cache behavior, cache TTL expiry
- Unit test: `search.handler.js` — mock OpenAI + search engine, verify response assembly
- Manual test: `/search what is the weather in tokyo` in a Discord server with the bot

## [S9] Future considerations (not implementing now)

- **Tool-use pattern**: Let the LLM decide when to search (function calling). Would need a structural change to how the bot calls OpenAI.
- **Per-guild search toggle**: Config option to enable/disable search per server.
- **Result count config**: Let guild admins configure how many results to return.
- **Safe search config**: Per-guild toggle for safe search filtering.
