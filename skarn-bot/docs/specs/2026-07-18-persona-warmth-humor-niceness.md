# Skarn Warmth, Humor & Niceness — Full Personality Expansion

> Gap analysis and spec for making Skarn friendlier, funnier, and nicer to interact with, building on the existing Discord-native persona (Round 1) and persona depth system (Round 2).

## [S1] Problem

Skarn's current persona is *accurate* but not yet *warm*. It speaks in a Discord-native voice, adapts to relationship level, shifts mood per guild, and interjects proactively — but none of these features actively make the user *feel good* about interacting.

**Gap analysis against "friendly, funny, nice":**

| Goal | Current state | Gap |
|------|---------------|-----|
| **Friendly** | Relationship-awareness exists (familiarity + tags), but doesn't modulate warmth. A veteran and a newcomer get the same emotional tone. | No sentiment-aware warmth, no active listening, no first-of-day personalization, no encouragement. |
| **Funny** | Post-processor adds emoji, abbreviations, and lowercase. Reaction system fires emoji at 3%. Interjection engine generates AI replies. | No callbacks to past funny moments, no deliberate comic timing (delays, setup-punchline), no running gags, no deadpan escalation. |
| **Nice** | Relationship system prevents cruelty, banter level avoids offense, mood states keep interactions grounded. | No gratitude volley, no milestone celebration, no apology acknowledgment, no patience scaling for confused users. |

The persona *describes* itself as witty and warm in `identity.js` lines 22-26 ("Witty. Deadpan delivery, quick retorts...") and lines 33-35 ("You read the room. Casual with regulars..."), but the prompt alone can't deliver the timing, memory, and behavioral loops that make those qualities real in conversation.

## [S2] Design Principles

1. **Relationship-gated warmth** — All new behaviors key off existing `user_relationship.familiarity` and tags. Newcomers (familiarity < 15) get warmth and patience. Regulars (15-50) get warmth + light humor. Veterans (50+) get full comedy + callbacks + inside references.
2. **Timing over content** — For humor, *when* Skarn says something often matters more than *what*. Comic timing (deliberate delays, deadpan escalation) gets equal weight with callback content.
3. **Subtle niceness** — Skarn should never feel performatively kind. Gratitude volleys, apologies, and encouragement must sound like a 10,000-year-old demon, not a customer service bot.
4. **Session-scoped with persistent memory** — Callbacks live in-memory per channel session (cleaned hourly). First-of-day tracking uses the existing `last_interaction_at` field. Milestones use the existing `interaction_count`.
5. **Zero new DB tables** — All state lives in memory or piggybacks on existing `user_relationship` fields. No schema changes.

## [S3] Module 1: Warmth Manager (`features/warmth/warmthManager.js`)

### Purpose

Adjust Skarn's emotional tone based on the user's recent sentiment and relationship depth. Make interactions feel attentive without being intrusive.

### Features

**Sentiment Tracking (in-memory):**
- Per-user-per-guild rolling buffer of last 5 message sentiment scores (using `sentiment` library, already a dependency)
- Updated on every `messageCreate`
- Key: `userId:guildId` → `{ scores: number[], timestamps: number[] }`

**Warmth Line (prompt context):**
- Evaluated at call time (not on a timer):
  - If avg sentiment < -0.3 and familiarity > 15: `"This person seems off today. Be present, not pushy. If they want to talk, let them. If not, don't force it."`
  - If avg sentiment > 0.5 and familiarity > 30: `"This person is in a good mood. Match their energy — light and easy."`
  - If user sent 3+ consecutive messages > 200 chars and role is `casual`: `"They're opening up. Listen more, react naturally."`
  - Otherwise: `""` (no line — keep it clean)

**Active Listening:**
- When a user sends a message > 200 chars in a non-AI channel (where Skarn isn't already about to reply) and familiarity > 15:
  - 5% chance to send a brief engagement cue after 2-4s delay
  - Cues: `"mhm"`, `"yeah?"`, `"go on"`, `"i'm listening"`, `"wait really?"`
  - Gated: max 1 per 5 minutes per channel (existing `cooldowns` pattern)
  - Skarn's in-character delivery makes these feel natural, not robotic
  - Does NOT fire in AI channels — active listening would conflict with the full AI auto-response

**Patience Scaling:**
- Tracks `topicRepeatCount` per user (reset every 30 min): if user sends similar messages within 30 min, counts as repeat
- Fed into prompt only when count > 2: `"They're not getting it. Be clearer this time — drop the wit, give the answer straight."`

### Implementation

```js
// features/warmth/warmthManager.js
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const sentimentBuffer = new Map(); // "userId:guildId" → { scores[], timestamps[] }
const repeatBuffer = new Map();    // "userId" → { topics[], windowStart }
const ACTIVE_LISTEN_COOLDOWN = 5 * 60 * 1000;
const activeListenCooldowns = new Map();

function updateWarmth(userId, guildId, content) { /* update sentiment buffer */ }
function getWarmthLine(userId, guildId, roleNature) { /* evaluate + return line */ }
function getPatienceLine(userId, content) { /* detect repeats → return override */ }
async function maybeActiveListen(message, client) { /* send engagement cue */ }

module.exports = { updateWarmth, getWarmthLine, getPatienceLine, maybeActiveListen };
```

## [S4] Module 2: Callback Engine (`features/humor/callbackEngine.js`)

### Purpose

Give Skarn in-session memory of funny or notable moments so it can reference them naturally — the difference between a bot that talks at you and one that *remembers* what you said.

### Design

**In-memory callback buffer:**
- Per-channel
- Max 10 entries per channel (LRU eviction on insert)
- Each entry: `{ text: string, author: string, timestamp: number, type: 'funny' | 'setup' | 'notable' }`
- Entry extracted from messages where:
  - Sentiment > 0.5 (funny/upbeat content) — 10% sampling
  - Message is short (< 50 chars) and got 2+ reactions from others — 30% sampling
  - Message ends with `?` and is banter-toned — `'setup'` type (see comedy timing)

**Eviction:**
- Cleaned every 60 minutes (piggyback on existing decay timer)
- Entries older than 2 hours removed regardless of count
- When buffer is full and a new notable entry arrives, evict the oldest

**Callback prompt line:**
- On AI call (consult/mention/interjection), if there are 2+ entries from the same author in the channel buffer:
  ```js
  function getCallbackLine(userId, channelId) {
    const entries = getEntriesForUser(channelId, userId);
    if (entries.length < 2) return '';
    const refs = entries.slice(-2).map(e => e.text).join('" and "');
    return `You remember this person saying: "${refs}". If it's natural, reference it. Don't force it.`;
  }
  ```
- The line is deliberately soft ("if it's natural, don't force it") to prevent the LLM from awkwardly shoehorning callbacks

### Implementation

```js
// features/humor/callbackEngine.js
const channelBuffers = new Map(); // channelId → Entry[]

function updateCallbacks(channelId, authorId, content, reactionsCount) { /* sample + insert */ }
function getCallbackLine(channelId, userId) { /* return prompt line or '' */ }
function cleanCallbacks() { /* remove old entries, trim to 10 */ }

module.exports = { updateCallbacks, getCallbackLine, cleanCallbacks };
```

## [S5] Module 3: Comedy Timing (`features/humor/comedyTiming.js`)

### Purpose

Deliberate timing manipulation — the difference between a joke landing and a joke falling flat. Three mechanisms:

### 3a. Punchline Delay

- After AI generates a response, detect if it's a punchline-style message:
  - Length < 100 chars
  - No trailing `?` (questions aren't punchlines)
  - Topic of parent conversation contains a setup (a message from the same user ending with an open-ended buildup)
- If punchline detected: insert 3-5s delay before sending
- Implementation: `maybePunchlineDelay(chunks, context)` in post-process flow

### 3b. Deadpan Escalation

- Track banter chain length per user per channel (reset after 10 min of no banter)
- Chain length 3+: progressively shorten responses by multiplying token budget by `1 - (chain * 0.15)` (so chain 3 → 0.55x, chain 5 → 0.25x)
- The shorter responses paired with the existing dry persona create a deadpan escalation arc
- Implementation: `getDeadpanBudget(baseBudget, userId, channelId)` called in handler

### 3c. Setup-Punchline Detection

- When a message is tagged as `'setup'` type by the callback engine, note it
- If the next AI response within 30 seconds is a short (< 80 chars) deadpan follow-up, attach a styling flag but do NOT modify the AI output — the model handles the content; timing handles the delivery

### Implementation

```js
// features/humor/comedyTiming.js
const banterChains = new Map(); // "userId:channelId" → { count, lastAt }

function isPunchline(text, channelId, userId) { /* check length + parent setup */ }
function getDeadpanBudget(baseBudget, userId, channelId) { /* scale down by chain */ }
function extendBanterChain(userId, channelId) { /* +1, reset timer */ }
function cleanChains() { /* reset chains older than 10 min */ }

module.exports = { isPunchline, getDeadpanBudget, extendBanterChain, cleanChains };
```

## [S6] Module 4: Etiquette Engine (`features/etiquette/etiquetteEngine.js`)

### Purpose

Small social graces that make Skarn feel like someone who *notices* things.

### 4a. Gratitude Volley

- On `/consult` or mention, if user message matches thanks patterns: `thanks|thank you|ty|tysm|appreciate it|thx`
- Adds prompt directive: `"They're thanking you. Acknowledge it in-character and move on. Don't dwell."`
- The AI handles the actual wording; the directive prevents robotic "you're welcome" responses

### 4b. First-of-Day Greeting

- Track `lastInteractionDate` per user per guild (date only, truncated to day)
- If today !== lastInteractionDate AND familiarity > 15:
  - Adds first-of-day prompt prefix: `"This is your first interaction with this person today. Acknowledge the gap casually if relevant — 'oh hey', 'back again', 'was wondering when you'd show'. Don't overdo it."`
- Updates on every interaction

### 4c. Milestone Detection

- On any AI command execution (`/consult`, `/ask`, `/joke`, etc.), check `interaction_count` from the user's relationship data:
  - If count crosses a milestone threshold (50, 100, 250, 500, 1000):
  - `"This is this person's {n}th command. If it feels natural, note it. Don't force a celebration — a dry acknowledgment fits Skarn better."`
- Thresholds: 50, 100, 250, 500, 1000
- Prevent re-triggering: store highest milestone acknowledged in a Set `acknowledgedMilestones` (in-memory, resets on restart — acceptable since milestones are far apart)

### 4d. Apology Acknowledgment

- When Skarn detects it gave a bad/wrong reply (error path or user callout):
  - Next interaction with that user: `"You may have given a bad answer last time. If relevant, acknowledge it briefly — 'my bad', 'i was off', 'let me try again'."`
  - Tracks `flaggedForApology: true` per user in-memory, cleared after one interaction

### Implementation

```js
// features/etiquette/etiquetteEngine.js
const flaggedUsers = new Map(); // userId → { errorAt, cleared }
const acknowledgedMilestones = new Set(); // "userId:mstone"

function getGratitudeDirective(content) { /* return directive or '' */ }
function getFirstOfDayLine(userId, guildId) { /* return greeting directive or '' */ }
function getMilestoneLine(userId, interactionCount) { /* return milestone line or '' */ }
function flagForApology(userId) { /* mark user */ }
function getApologyLine(userId) { /* return apology directive or '' */ }
function clearFlags() { /* periodic cleanup */ }

module.exports = { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, flagForApology, getApologyLine };
```

## [S7] Integration

### `features/promptContext.js` — updated

```js
// New imports
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');

function collectContext(userId, guildId, channelId, roleNature, interactionCount) {
  // ... existing stateLine, moodLine, relationshipLine, cultureLine, memoryLine ...

  // New
  const warmthLine = getWarmthLine(userId, guildId, roleNature);
  const patienceLine = getPatienceLine(userId, content);
  const callbackLine = getCallbackLine(channelId, userId);
  const gratitudeLine = getGratitudeDirective(content);
  const firstOfDayLine = getFirstOfDayLine(userId, guildId);
  const milestoneLine = getMilestoneLine(userId, interactionCount);
  const apologyLine = getApologyLine(userId);

  return { stateLine, moodLine, relationshipLine, cultureLine, memoryLine,
           warmthLine, patienceLine, callbackLine, gratitudeLine, firstOfDayLine, milestoneLine, apologyLine };
}
```

### `persona/identity.js` — updated `buildSystemPrompt()`

```js
function buildSystemPrompt({
  roleLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  cultureLine = '', memoryLine = '',
  warmthLine = '', patienceLine = '', callbackLine = '',
  gratitudeLine = '', firstOfDayLine = '', milestoneLine = '', apologyLine = ''
} = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (stateLine) parts.push(stateLine);
  if (moodLine) parts.push(moodLine);
  if (relationshipLine) parts.push(relationshipLine);
  if (cultureLine) parts.push(cultureLine);
  if (memoryLine) parts.push(memoryLine);
  if (warmthLine) parts.push(warmthLine);
  if (patienceLine) parts.push(patienceLine);
  if (callbackLine) parts.push(callbackLine);
  if (gratitudeLine) parts.push(gratitudeLine);
  if (firstOfDayLine) parts.push(firstOfDayLine);
  if (milestoneLine) parts.push(milestoneLine);
  if (apologyLine) parts.push(apologyLine);
  return parts.join('\n\n');
}
```

### `bot.js` — new hooks

In `messageCreate`, after existing relationship/culture tracking (line ~177):

```js
// Warmth tracking
updateWarmth(message.author.id, message.guild.id, message.content);
// Callback tracking (10% sample of notable messages)
updateCallbacks(message.channel.id, message.author.id, message.content);
// Active listening (low chance, non-AI channels)
maybeActiveListen(message, client);
// Comedy timing chain tracking
extendBanterChain(message.author.id, message.channel.id);
```

In the decay interval (line 111):

```js
setInterval(() => {
  runDecayPass();
  cleanCallbacks();
  cleanChains();
}, 10 * 60 * 1000);
```

### Handler updates (`mentionRouter.js`, `consult.handler.js`)

Both handlers need:
1. Pass `roleNature` and `interactionCount` to `collectContext()`
2. Apply `getDeadpanBudget()` to token budget
3. Apply comedy timing delay in post-process flow
4. Call `flagForApology()` on error path

### Token Budget Impact

| New line | Typical token cost | Frequency |
|----------|-------------------|-----------|
| `warmthLine` | 15-30 | ~20% of calls |
| `patienceLine` | 10-20 | <5% of calls |
| `callbackLine` | 15-40 | ~15% of calls |
| `gratitudeLine` | 8-15 | ~5% of calls |
| `firstOfDayLine` | 15-25 | ~5% of calls |
| `milestoneLine` | 10-20 | <1% of calls |
| `apologyLine` | 10-15 | <1% of calls |

The total added at peak is ~165 tokens, spread across lines that rarely all fire simultaneously. Budget `consult` stays at 900 — if quality degrades, increase to 1000.

## [S8] Files Changed

| File | Change |
|------|--------|
| `features/warmth/warmthManager.js` | **New** — sentiment tracking, warmth line, active listening, patience |
| `features/humor/callbackEngine.js` | **New** — in-session callback buffer + prompt line |
| `features/humor/comedyTiming.js` | **New** — punchline delay, deadpan budget, chain tracking |
| `features/etiquette/etiquetteEngine.js` | **New** — gratitude, first-of-day, milestone, apology |
| `features/promptContext.js` | **Updated** — imports and returns all new context lines |
| `persona/identity.js` | **Updated** — `buildSystemPrompt()` signature + assembly |
| `features/mentionRouter/mentionRouter.js` | **Updated** — new context params, deadpan budget, comedy timing |
| `features/consult/consult.handler.js` | **Updated** — same as above |
| `bot.js` | **Updated** — warmth/callback/activeListen/banter hooks + cleanup timers |
| `features/discordNative/postProcess.js` | **Updated** — export or integrate `maybePunchlineDelay` |

## [S9] Out of Scope

- Cross-session callback memory (callbacks only live for the session, reset on restart)
- Per-user mood preference (no `/setmood` command)
- Sentiment analysis on DMs (privacy)
- Skarn initiating DMs (intrusive)
- Reaction intensity scaling (reactions stay at their current 3% rate)
- Voice channel persona (text-only scope)
- Multi-guild callback sharing (per-channel isolation is intentional)

## [S10] Verification

1. Send a message with negative sentiment as a regular user → Skarn's tone should soften detectably (warmer, less banter)
2. Send 3 long messages (>200 chars) in a non-AI channel → Skarn should eventually active-listen (`mhm`, `yeah?`, etc.)
3. Send 5+ rapid banter messages → Skarn's responses should get progressively shorter (deadpan escalation)
4. Make a funny comment → within 30 min, reference it in a natural follow-up (callback)
5. Say "thanks" → Skarn should acknowledge and volley, not say "you're welcome"
6. First interaction of the day for a regular → Skarn should acknowledge the gap casually
7. Reach 50 `/consult` calls → Skarn should dry-notice the milestone
8. Trigger an error → next interaction should have an apology acknowledgment
9. All existing features (reactions, interjections, mood, culture) continue working unchanged
