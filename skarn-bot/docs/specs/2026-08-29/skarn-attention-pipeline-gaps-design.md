# Skarn Attention Pipeline Gap Closure

**Date:** 2026-08-29
**Status:** Draft
**Scope:** 5 targeted improvements to `features/discordNative/attentionGate.js` and supporting modules

## [S1] Problem

Skarn's attention pipeline is architecturally sound — layered dedup, probabilistic gating, channel state tracking, and post-response calibration. However, five social-behavioral gaps reduce his effectiveness in real Discord conversations:

1. **Recency bypass enables chatterbox behavior.** The 2-minute recency boost (`attentionGate.js:29`) is a hard early-exit that returns `true` with 100% probability, bypassing the stacking model entirely. In fast-moving conversations, Skarn responds to every message from a user he recently replied to, creating a wall of bot messages.

2. **No conversation partner awareness.** Skarn cannot detect when two users are in a private back-and-forth. He interjects into 1:1 conversations with the same probability as group discussions.

3. **Calibration only learns from responses.** The `response_learning` table records hit/miss/neutral only when Skarn *responds*. When the attention gate says "no," there is no learning signal. The system cannot optimize decisions it doesn't track.

4. **Hanging questions go unnoticed.** When Skarn asks a follow-up question and nobody answers, he has no mechanism to notice the silence, re-ask, rephrase, or gracefully move on.

5. **Text-blind attention.** The attention gate and response generation treat all messages as plain text. "Check this out" with an image attachment is routed identically to "check this out" as bare text, despite requiring fundamentally different response strategies.

## [S2] Solution overview

Five independent, low-coupling changes to the attention pipeline. Each can be implemented and deployed independently. No new tables required for gaps 1, 2, or 4 — they use existing `attention_state` and `app_state` infrastructure. Gap 3 adds one column to `attention_state`. Gap 5 reads Discord message attachment metadata that is already available but currently ignored.

## [S3] Gap 1: Recency cap (consecutive response limiter)

**Current behavior:** `attentionGate.js:29` — if `last_bot_reply_at` is within 120 seconds, `shouldRespond()` returns `true` immediately. No probability model, no limit.

**Problem:** A user who sends 10 messages in 2 minutes gets 10 Skarn responses. The `channel_warm` check (`last_bot_channel_msg_at < 30s`) has the same unbounded effect at channel scope.

**Proposed behavior:**

Add a `consecutive_responses` counter to `attention_state` (integer, reset to 0 when the 2-min recency window expires or when a non-Skarn user posts).

```
if (recency_window_active && consecutive_responses < MAX_CONSECUTIVE):
    return true   // fast-path (existing behavior)
if (recency_window_active && consecutive_responses >= MAX_CONSECUTIVE):
    // fall through to probability model instead of early-exit
```

**Constants:**
- `MAX_CONSECUTIVE = 3` — after 3 auto-responses within the recency window, subsequent messages go through the full probability gate.

**Reset logic:**
- `consecutive_responses` resets to 0 when:
  - The recency window expires (>120s since `last_bot_reply_at`)
  - A different user posts in the channel (conversation shifts)

**Schema change:** Add `consecutive_responses INTEGER DEFAULT 0` to `attention_state` table. Update `getAttentionState()`, `upsertAttentionState()`, and the reset/increment logic in `db/channel.js`.

**Files to modify:**
- `features/discordNative/attentionGate.js` — add counter check in early-exit section
- `db/channel.js` — add `consecutive_responses` to get/reset/increment
- `db/db.js` — add column to `upsertAttentionState` dynamic builder
- `db/skarn-schema.sql` — add column to `attention_state` table definition

**Edge cases:**
- DMs: `guildId` is empty string; counter is per-user-per-channel, so DMs work identically
- Restart: counter resets to 0 (SQLite column default); first 3 messages after restart get fast-path, which is acceptable

## [S4] Gap 2: Conversation partner detection

**Current behavior:** No awareness of who is talking to whom. Every message is evaluated independently.

**Problem:** User A and User B are having a focused 1:1 exchange (alternating messages, <30s gaps, no one else talking). Skarn interjects, breaking the conversational flow.

**Proposed behavior:**

Track pairwise message frequency per channel in a sliding window. When two users dominate a channel (≥80% of messages in the last 5 minutes, ≥4 messages each, average gap <30s), classify the channel as `pair_conversation` and suppress Skarn's probability by a `PAIR_SUPPRESSION` factor.

**Implementation:**

Add a lightweight in-memory tracker (not SQLite — this is ephemeral windowed data, same pattern as the dedup set):

```js
// In attentionGate.js or a new features/attention/pairTracker.js
var pairWindows = new Map(); // channelId -> { users: Map<userId, count>, windowStart: timestamp }

function updatePairTracker(channelId, userId) { ... }
function getPairDominance(channelId) { returns { dominant: [userId, userId], ratio: 0.0-1.0 } }
```

**Thresholds:**
- Window: 5 minutes (300,000ms)
- Minimum messages per user: 4
- Dominance ratio: ≥80% of messages from exactly 2 users
- Suppression: `probability *= 0.2` (80% reduction when pair detected)

**Scope:** This only affects the probability-based path. @mentions, reply-to-bot, and activation phrases are unaffected — if someone explicitly pings Skarn, he responds regardless of pair detection.

**Files to modify:**
- `features/discordNative/attentionGate.js` — integrate pair tracker, apply suppression factor
- New: `features/attention/pairTracker.js` (optional — could live inline in attentionGate.js given simplicity)

**Memory:** The `pairWindows` Map is volatile (lost on restart), same as the dedup set. Maximum entries: one per active channel. Pruned when window expires. At ~50 bytes per entry, even 1000 active channels = 50KB.

**Edge cases:**
- Group conversations (3+ active users): ratio stays below 80%, no suppression — correct behavior
- Two users + Skarn: Skarn's own messages must be excluded from pair tracking (check `message.author.id === client.user.id` before calling `updatePairTracker`). He's the observer, not a conversation participant. Only human-to-human message ratios are evaluated.
- Channel with only Skarn + 1 user: ratio is always 100% for that pair, but minimum messages threshold (4 each) prevents false positive on a single exchange.

## [S5] Gap 3: Non-response tracking for calibration

**Current behavior:** `response_learning` records hit/miss/neutral only when Skarn responds. When the attention gate says "no," nothing is recorded.

**Problem:** The calibration system cannot answer: "Should I have responded to that message?" It only learns from outcomes of responses, not from the outcomes of silence.

**Proposed behavior:**

Record attention-gate decisions (both "respond" and "skip") with a lightweight outcome signal. After a skip, if the channel continues normally (no distress signals, conversation flows), the skip was correct. If a user subsequently @mentions Skarn or expresses frustration ("skarn?", "hello?", "anyone?"), the skip was likely wrong.

**Schema change:** New table `attention_decisions`:

```sql
CREATE TABLE IF NOT EXISTS attention_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    decision TEXT NOT NULL,          -- 'respond' | 'skip'
    probability REAL,                -- the computed probability at decision time
    message_age_ms INTEGER,          -- age of the message when decision was made
    corrected INTEGER DEFAULT 0,     -- set to 1 if user later @mentions or expresses frustration
    created_at INTEGER NOT NULL
);
```

**Tracking logic:**
- When `shouldRespond()` returns `true`: insert `{ decision: 'respond', probability }`
- When `shouldRespond()` returns `false`: insert `{ decision: 'skip', probability }`
- When a user @mentions Skarn within 60s of a "skip" decision for the same channel: UPDATE the most recent skip `corrected = 1`
- Prune entries older than 24 hours (housekeeping timer, same pattern as `pruneSentimentBuffers`)

**Usage:** This table is not read by the attention gate directly. It feeds into calibration analysis — either manual review or a future automated pass that adjusts `attentionGate` thresholds based on skip-correction rate.

**Files to modify:**
- `features/discordNative/attentionGate.js` — log decisions after the final return true/false
- `db/channel.js` — add `insertAttentionDecision()`, `markCorrectedSkip()`, `pruneAttentionDecisions()`
- `db/skarn-schema.sql` — add table definition

**Cost:** One SQLite INSERT per message in monitored channels. At 100 messages/channel/hour, that's ~100 INSERTs/hour — negligible compared to the AI calls themselves.

**Privacy:** Decision records contain `user_id` and `channel_id` (same scope as existing `attention_state`). No message content is stored.

## [S6] Gap 4: Hanging question detector

**Current behavior:** Skarn asks a follow-up question. Nobody answers. Skarn never notices.

**Problem:** This makes Skarn feel absent-minded. A human would notice silence after asking a question and either re-ask, rephrase, or move on.

**Proposed behavior:**

Track the last Skarn-authored question per channel. If no response within a timeout, Skarn either:
1. Sends a gentle nudge (60% chance): "still thinking about it?" / "no rush" / silence is fine
2. Moves on silently (40% chance): resets the tracker, no message sent

**Implementation:**

Add to `app_state` (per-channel):
- `skarn_last_question:{channelId}` — timestamp of Skarn's last question-type response
- `skarn_last_question_content:{channelId}` — truncated content (for rephrase logic, optional)

**Detection:**
- After Skarn responds, check if his reply contains `?` (question detection, same regex as `attentionGate.js:39`)
- If yes, store timestamp in `app_state`
- On every incoming message in that channel, check if `skarn_last_question:{channelId}` exists and is >60s old
- If expired: send nudge (60%) or reset (40%), then clear the key

**Scope:** Only fires in channels where Skarn is actively monitored. @mentions and slash commands are unaffected.

**Files to modify:**
- `features/discordNative/attentionGate.js` — add question-tracking check before the probability model
- Or: new lightweight module `features/attention/hangingQuestion.js` — keeps attentionGate.js from growing

**Constants:**
- `HANGING_QUESTION_TIMEOUT_MS = 60000` (60 seconds)
- `NUDGE_PROBABILITY = 0.6`
- Nudge lines: pulled from a small pool in the role system or hardcoded in-character phrases

**Edge cases:**
- Skarn asks a question, then someone answers 30s later: no nudge (timeout not reached)
- Skarn asks a question, channel goes dormant: the timeout fires but the nudge goes to a quiet channel — this is acceptable because the musing/interjection system already handles quiet-channel behavior
- Multiple Skarn questions in sequence: only the most recent one is tracked (overwrite)

## [S7] Gap 5: Media-aware attention

**Current behavior:** All messages are treated as plain text. Image attachments, embeds, and links are invisible to the attention gate and response generation.

**Problem:** "Check this out" with an image requires a different response than "check this out" as text. The attention gate's question/skarn heuristic and sentiment analysis are text-only.

**Proposed behavior:**

Read Discord's `message.attachments` and `message.embeds` arrays (already available on the `Message` object passed to `shouldRespond()`). Use this to:

1. **Adjust attention probability:**
   - Image attachment: `probability += 0.15` (mild boost — images are engagement-rich)
   - Link embed (URL with OpenGraph data): `probability += 0.1` (someone shared something)
   - No boost for text-only (current behavior)

2. **Inject media context into the response pipeline:**
   - Add `mediaLine` to `buildContext()` return object: `"User attached an image."` / `"User shared a link: {title}"` / empty string
   - This lets Skarn's response acknowledge the media: "nice photo" / "good article" instead of ignoring it

**Implementation:**

In `attentionGate.js`:
```js
// After content analysis, before probability calculation
var hasImage = message.attachments && message.attachments.some(a => a.contentType?.startsWith('image/'));
var hasLink = message.embeds && message.embeds.length > 0;
if (hasImage) probability += 0.15;
if (hasLink) probability += 0.1;
```

In `promptContext.js` `buildContext()`:
```js
var mediaLine = '';
if (message.attachments?.some(a => a.contentType?.startsWith('image/'))) {
  mediaLine = 'User attached an image.';
} else if (message.embeds?.length > 0) {
  var title = message.embeds[0].title || message.embeds[0].url || 'a link';
  mediaLine = `User shared: ${title}`;
}
```

**Files to modify:**
- `features/discordNative/attentionGate.js` — add attachment/embed checks to probability stacking
- `features/promptContext.js` — add `mediaLine` to context assembly and return object
- `persona/identity.js` — add `mediaLine` to `buildSystemPrompt()` destructuring and parts array

**Limitations:**
- Discord.js `Message` object already has `attachments` and `embeds` populated — no extra API calls needed
- This does not process the image content (no vision model). It only acknowledges that media exists.
- The `mediaLine` is advisory — it tells Skarn "there's an image here" so he can reference it, but doesn't describe what's in the image.

## [S8] Implementation order and dependencies

| Gap | Dependencies | Estimated complexity | Can ship independently |
|-----|-------------|---------------------|----------------------|
| 1. Recency cap | `attention_state` schema change | Low | Yes |
| 2. Conversation partner | None (in-memory tracker) | Medium | Yes |
| 3. Non-response tracking | New `attention_decisions` table | Medium | Yes |
| 4. Hanging question | `app_state` (existing) | Low | Yes |
| 5. Media-aware | None (reads existing Discord.js data) | Low | Yes |

**Recommended order:** 1 → 4 → 5 → 2 → 3 (easiest first, building confidence before the more invasive changes)

## [S9] What this spec does NOT cover

- **Calibration feedback loop** (gap from original analysis): reading `attention_decisions` to auto-tune attention gate thresholds. This spec records the data; a future spec can act on it.
- **Thread awareness** (Discord native threads vs. Skarn's internal conversation threads): out of scope for this pass.
- **Time-of-day voice shift**: out of scope — this is a persona change, not an attention change.
- **Cold-start handling for new users**: out of scope — requires relationship data that doesn't exist yet for new users.
- **Cross-guild calibration**: out of scope — requires per-user aggregation across guilds.

## [S10] Success criteria

1. **Recency cap:** In a test where a user sends 10 messages in 2 minutes, Skarn responds to at most 3 without explicit @mention.
2. **Conversation partner:** In a test where 2 users exchange 5+ messages with <30s gaps, Skarn's response probability drops by ≥80%.
3. **Non-response tracking:** `attention_decisions` table has entries for both "respond" and "skip" decisions, and "corrected" flag is set when users follow up after a skip.
4. **Hanging question:** When Skarn asks a question and gets no response for 60s, a nudge is sent with 60% probability.
5. **Media awareness:** When a user posts an image, `mediaLine` is populated in the system prompt and Skarn's response acknowledges the media.
