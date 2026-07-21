# Auto-Expanding Lore System

## [S1] Problem
Skarn has 20 hand-curated canonical stories but claims 10,000 years of history. That's 20 stories for 10 millennia — a ratio of 500 years per story. He needs a vast, consistent backstory to make the "10,000 years" claim feel real.

## [S2] Solution
Hourly batch generation of 50 new lore stories via a single LLM call. Each batch targets a rotating era (origin, war_years, warmaster, retirement) to ensure even coverage. New stories include characters, locations, and events from existing lore — the canon builds on itself.

## [S3] Storage
Existing `skarn_stories` table with `source = 'auto_lore'`. No new tables.

Story engine priority: canonical → auto_lore → AI-generated (null source).

## [S4] Generation

### Hourly batch call
```js
async function generateLoreBatch() {
  var eras = ['origin', 'war_years', 'warmaster', 'retirement'];
  var era = eras[Math.floor(Date.now() / 3600000) % eras.length]; // rotates every hour

  var existing = db.prepare("SELECT topic, story_text FROM skarn_stories WHERE source IN ('canonical', 'auto_lore') ORDER BY used_count DESC LIMIT 50").all();
  var contextSummary = existing.map(function(s) { return '[' + s.topic + '] ' + s.story_text.substring(0, 100); }).join('\n');

  // LLM call
  var prompt = 'Generate 50 JSON lore stories for Skarn, a 10,000-year-old demon. Era: ' + era + '.\n\nExisting lore (reference these for consistency):\n' + contextSummary + '\n\nReturn JSON array: [{ "topic": "war", "story": "story text" }]. Topics: origin, war, loss, change, technology, time, power, retirement. Each story 2-3 sentences. Reference existing characters/locations where possible.';
  
  // Call LLM, parse JSON, INSERT OR IGNORE
}
```

### Rotating eras
Each hour targets a different era:
- Hour 0: origin
- Hour 1: war_years
- Hour 2: warmaster
- Hour 3: retirement
- Hour 4: origin (repeats)

This gives each era ~6 batches per day = ~300 new stories per era per day. After a week, ~8,400 total auto-generated stories.

### Consistency mechanism
The prompt includes summaries of the 50 most-referenced existing stories. This means characters, locations, and events from popular stories get referenced in new ones. The LLM builds on what's already established.

### Deduplication
`INSERT OR IGNORE` on `(topic, story_text)` prevents exact duplicates. Near-duplicates (same event, different wording) are accepted — variety is fine for a 10,000-year history.

## [S5] Integration

### Files changed
| File | Change |
|------|--------|
| `features/wisdom/storyEngine.js` | Add `generateLoreBatch()` function; update `getExistingStory()` priority |
| `bot.js` | Add hourly `setInterval` for lore generation |

### Timer
```js
setInterval(function() {
  require('./features/wisdom/storyEngine').generateLoreBatch();
}, 60 * 60 * 1000);
```

## [S6] Cost
One LLM call per hour. Each call: ~2000 input tokens + ~3000 output tokens (50 stories × 60 tokens each). At gpt-4.1-mini pricing (~$0.10/1M input, ~$0.40/1M output): ~$0.0014/hour = ~$0.034/day = ~$1/month.

## [S7] Verification
1. First hour: 50 auto_lore stories appear in `skarn_stories`
2. Second hour: 50 more, different era. Some reference events from first batch
3. After 4 hours: stories across all 4 eras
4. After a week: thousands of auto_lore stories
5. Trigger: mention "war" → `getExistingStory()` returns canonical > auto_lore > AI-generated
