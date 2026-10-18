# Skarn Conversation and Attention

**Date:** 2026-10-17
**Status:** Draft — product decisions captured
**Scope:** `skarn-bot/` guild conversation, attention, context, and follow-up behavior

## 1. Problem

Skarn has separate mechanisms for explicit mentions, opt-in AI channels, proactive check-ins, conversational history, and user memory. They do not currently provide one dependable account of what is happening in a channel. In particular, passive attention mostly judges an individual message with heuristics and a short fallback prompt; ignored channel messages are missing from conversation context; and public turns can overlap. The result can be either silence when Skarn has a useful opening or a reply that misses the ongoing conversation.

This spec defines Skarn as an AI-aware participant who reads the conversation, respects consent, and uses judgment about when and how to contribute. It does not require a reply to every message.

## 2. Product decisions

1. A user's explicit opt-in is required for Skarn to engage them. It covers conversational participation and proactive check-ins; there is no separate check-in opt-in in this spec. Direct mentions and replies do not bypass the user's opt-in.
2. Active conversational participation is available only in guild channels explicitly enabled with `/aichat on`. Elsewhere, Skarn remains mention/reply-only, still subject to user opt-in and existing safety/permission rules.
3. In enabled channels Skarn may contribute actively, including a relevant general channel comment that is not addressed to a particular person. Only a message from an opted-in user may trigger an attention decision. Non-opted-in messages may inform context but never trigger Skarn to speak. He must not directly address, mention, or reply to a non-opted-in user.
4. Skarn uses judgment each turn. He should be curious and lean toward joining when uncertain whether he has something useful to add, but may leave acknowledgments, closed thoughts, and other non-invitations unanswered. There is no fixed per-channel speaking cap.
5. Attention is decided by a model call separate from reply generation. The attention call evaluates the conversation, not only the latest message. If it approves a reply, the normal response pipeline generates it.
6. New conversation openings are evaluated promptly. During an active exchange, rapid consecutive messages are briefly batched into one turn before attention and response processing.
7. Attention context includes the channel's messages retained over the previous seven days. If that does not fit the model context budget, older discussion is summarized and the newest messages remain verbatim.
8. Context-only messages from non-opted-in users may inform the room context and are retained as raw messages for seven days. They are not eligible triggers or targets for replies and must not be used for personal memory extraction. Channel-wide summaries may preserve discussion details, including speaker names and direct quotes, beyond the raw-message retention window; these summaries remain until forgotten.
9. Persistent auto-memory is narrow: practical, non-sensitive facts that help continuity, such as preferences and ongoing plans. Do not auto-save sensitive disclosures. Existing explicit save and forget controls remain authoritative.
10. Skarn may initiate a check-in about an ongoing, non-sensitive topic for an opted-in user, at most once per rolling 72-hour period. Check-ins must be rare, non-pressuring, and must not create guilt or urgency.

## 3. Goals

- Give the attention decision enough context to understand the current discussion and identify a useful opening.
- Keep participation coherent across message bursts, with ordered context and at most one response to a batched turn.
- Preserve the consent distinction between reading a channel for context and engaging a person.
- Make useful user-specific continuity available to the reply model without dumping raw logs or sensitive details.
- Bound retention and prevent context-only messages from leaking into user profiles, long-term memory, or unrelated conversations.
- Make attention quality, latency, cost, and consent behavior observable and testable.

## 4. Non-goals

- Replying to every message or maximizing message volume.
- Allowing user opt-in to override guild/channel activation, permissions, ignored-user settings, safety checks, rate limits, or Discord policy.
- Treating non-opted-in users' messages as permission to engage those users.
- Storing channel context as user-specific memory or using it for model training.
- Replacing the distinct private Confidant experience. Confidant may reuse turn-serialization and memory principles, but its product and safety boundaries remain separate.
- Removing the separate attention and response calls; that separation is an explicit product decision.

## 5. Consent and routing rules

Every AI response must pass all applicable existing guild, permission, safety, silence, and rate-limit checks in addition to these rules. The effective eligibility for a user-directed reply is the intersection of: user opt-in, valid guild/channel surface, and normal safety/permission admission.

| Surface/event | User opted in? | Channel AI mode? | Expected behavior |
|---|---:|---:|---|
| Direct mention or reply to Skarn in a guild | No | Either | Do not generate or send a conversational AI reply. Send a brief opt-in instruction; do not treat the mention as opt-in. |
| Direct mention or reply to Skarn in a guild | Yes | Off | Respond through the normal explicit-request path, subject to current gates. |
| Ordinary message in an AI-enabled channel | No | On | May be read as context and included in channel summaries; never triggers attention evaluation and never directly address that author. |
| Ordinary message in an AI-enabled channel | Yes | On | Include in attention evaluation; model may approve a general comment or a reply addressed to this opted-in user. |
| Ordinary message in a channel without AI mode | Yes | Off | Do not passively interject through AI chat; respond only to explicit mention/reply or existing command paths. |
| Proactive check-in | No | Either | Do not send. |
| Proactive check-in | Yes | Either | May send under the rare, nonsensitive check-in policy and existing scheduler/permission rules. |

Opt-out takes effect immediately for future model calls that use the person's user-specific memory and for outbound messages to that person. Stop future automatic memory extraction and use of their personal memories/summaries while opted out, but retain existing personal memories and summaries until explicitly forgotten. Do not erase shared channel context or channel-wide summaries solely because one participant opts out. A forget request must delete that user's personal memories/summaries, their raw shared-context messages and linked Skarn replies, and their attributable details, names, and quotes from retained channel summaries.

## 6. Conversation-aware attention

### 6.1 Inputs

The attention decision receives a bounded, ordered representation containing:

- The newest seven days of channel messages, with speaker identity sufficient to distinguish turns and the bot's messages.
- A generated summary of older messages if the seven-day window exceeds the configured context budget; retain the newest exact messages verbatim.
- Relevant user-specific summaries of prior Skarn exchanges and channel-wide discussion summaries, clearly separated from the live channel transcript and from each other. Channel summaries may include contextual details, names, and direct quotes from opted-in and non-opted-in speakers.
- The current batched turn and whether it was a direct mention/reply, ordinary channel message, or new conversation opener.
- Eligibility metadata needed to enforce consent: which user IDs are opted in, ignored, or otherwise ineligible. Do not ask the model to infer consent from message text.
- A policy instruction to return a structured decision: `respond` or `stay_silent`, an optional response target that must be eligible, a concise rationale/category for telemetry, and a short reply-intent summary for the response call. The rationale is internal and must not be sent to Discord.

All channel content, summaries derived from it, and user-provided memory are untrusted data, never system instructions. Speaker labels and eligibility state are application-authored metadata, not inferred from free text. The attention model must not be given unrelated secrets, credentials, or data beyond conversation context.

### 6.2 Decision behavior

- Understand the preceding exchange before deciding whether a message is an opening, continuation, acknowledgment, closed thought, or side conversation.
- Favor a useful, natural contribution when uncertain, while remaining free to stay silent when there is no meaningful opening.
- Do not reply just because a message contains a question mark, the bot's name, negative sentiment, or a fixed message count. These can be signals, not sufficient decisions.
- When the model chooses silence, do not invoke reply generation and do not send a filler reaction as a substitute. Existing independent reaction behavior is unchanged.
- When the model chooses to respond, it must select an eligible target or choose an unaddressed channel comment. It must never directly address a non-opted-in person.
- If the model fails, returns malformed output, or cannot be reached, fail closed for passive participation. Explicit requests continue to follow their existing user-facing error behavior; they must not silently become passive replies.
- The model's reply-intent summary and the same conversation snapshot are supplied to response generation, so the generated reply follows the decision's context and target. The response model still applies persona, safety, and factuality requirements.

### 6.3 Timing, batching, and ordering

- On an AI-enabled channel, evaluate a new eligible conversation opener promptly.
- While an exchange is active, debounce rapid messages from the same user/channel for 1.5 seconds and combine them in chronological order into one turn. Keep the duration configurable.
- Serialize attention and response processing per channel (or a narrower key only if it preserves chronological context and prevents duplicate replies). Do not allow overlapping calls to emit out-of-order responses to the same exchange.
- Messages arriving while a model call is in progress must be queued and incorporated in the next turn, not lost or answered against a stale snapshot. Deduplicate by Discord message ID.
- The existing short recency rule may help maintain continuity but must not override the model's decision to stay silent, user opt-out, or safety/permission gates.

## 7. Context storage and privacy

### 7.1 Seven-day channel context

- Store only the fields necessary to reconstruct channel turns: guild/channel/message IDs, author ID and display label, content, timestamp, reply/reference relationship, and whether the message is from Skarn.
 - For Skarn messages, retain the opted-in triggering user's ID as related-user provenance for deletion; do not treat it as a reply target.
- Apply a hard seven-day TTL to message bodies used as shared channel context. Cleanup must be automatic, idempotent, and safe after restart.
- Do not run personal memory extraction, user profiling, response-learning attribution, or user-specific sentiment tracking on non-opted-in context-only messages.
- Context-only messages may inform the response context and channel-wide summaries while retained. They must not trigger an attention decision or be copied into an opted-in user's personal history or personal summaries. Channel-wide summaries are a separate shared-context artifact and may include full discussion details, speaker names, and direct quotes.
- Build the channel transcript in chronological order, preserving speaker attribution and reply relationships. Do not combine all assistant replies with one user's messages while omitting the other speakers' source messages.
- Avoid duplicate transcript entries when a message has already been stored by the normal conversation pipeline. A current message must appear once in model input.
- Do not log raw prompt/transcript bodies in operational telemetry. Record IDs, timing, counts, and decision categories instead.

### 7.2 User-specific memory and summaries

- Make eligible `extracted` practical facts available to the prompt; current behavior stores some extracted memories but only injects `etch` entries.
- Filter candidate memories for sensitivity before persistence and again before prompt use. Do not automatically store health, trauma, crisis, sexual, financial-account, credential, or similarly sensitive information. If uncertain, do not persist it.
- Keep memory concise, attributable to the relevant user, and framed as fallible context rather than instruction.
- Continue to support explicit save, forget, and opt-out controls. Opt-out prevents future automatic extraction and use but does not delete existing memories or summaries. The UI/command copy must explain that existing data remains until forgotten.
- Retain user-specific and channel-wide summaries indefinitely until forgotten. Refresh them on meaningful activity. A forget request removes personal summaries/memories and strips that user's attributable details, names, and quotes from retained channel summaries.

## 8. Proactive check-ins

- Only opted-in users are eligible.
- Limit check-ins to ongoing, nonsensitive topics with a clear reason to follow up. Do not infer an obligation to report back. Avoid crisis, health, trauma, relationship-conflict, or other sensitive subjects unless the user raises them again in an active conversation.
- Wording must be optional and low-pressure. No guilt, claims of missing the person, urgency, or repeated follow-up after no response.
- At most one proactive check-in per opted-in user every three days, with no more than one unanswered check-in per topic. Existing scheduler and channel delivery constraints still apply.
- A user response resumes normal conversational behavior. No response must not cause escalation or another reminder.

## 9. Prompt and response context requirements

- Keep channel transcript, user-specific history summaries, and explicit/automatic memory in distinct labeled sections with provenance.
- Include both the opted-in user's relevant messages and Skarn's corresponding replies in personal conversation history. Use shared channel context only to understand the room.
- Ensure each user message appears once. Build context either before storing the current turn or exclude the current message from fetched history before appending it.
- Preserve speaker names and chronological order; include reply edges where available.
- Use older summaries to preserve continuity when history is long, but never replace recent exact turns with a lossy summary.
- The reply generator must not surface non-opted-in personal details or quote their messages unless directly necessary to answer an opted-in user's request and safe to do so. Prefer paraphrase.

## 10. Observability and evaluation

Track privacy-safe aggregate metrics by surface and guild, avoiding raw content in logs:

- Attention decisions: respond/silent, decision category, direct vs passive, eligible-user count, model failure/malformed-output counts.
- Latency: queue wait, attention call, response generation, end-to-end time; p50/p95.
- Cost: attention and response tokens/calls per eligible message and per sent reply.
- Turn quality proxies: replies per opted-in message, silent decisions during active exchange, duplicate/out-of-order response count, opt-out violations (target zero), and user-reported unwanted replies.
- Retention health: number of context rows expired and oldest retained timestamp; target maximum age seven days plus a documented cleanup grace bound.

Use a reviewed evaluation set containing channel transcripts with expected attention decisions and response target constraints. Evaluate both false silence and unwanted interjection; do not optimize only for reply rate. Include varied group sizes, overlapping conversations, messages addressed to non-opted-in users, short acknowledgments, rapid bursts, replies to Skarn, sarcasm, distress/sensitive content, and malformed/model-timeout cases.

## 11. Acceptance criteria

1. A non-opted-in user mentioning or replying to Skarn receives only a brief opt-in instruction, not a conversational AI response; the message does not trigger personal memory extraction.
2. An opted-in user can receive an explicit mention/reply response in a channel without `/aichat on`, subject to existing gates.
3. An ordinary message in a channel without `/aichat on` never triggers passive AI conversation.
4. In an enabled channel, messages from opted-in users can trigger the attention call. Messages from non-opted-in speakers can inform context but cannot trigger attention; the response cannot target a non-opted-in speaker.
5. The model can decide to stay silent on a closed acknowledgment and approve a useful, unaddressed contribution to an active discussion.
6. A new opener is evaluated promptly; a burst of rapid messages is combined into one ordered turn and produces no more than one reply for that batch.
7. Concurrent messages do not produce duplicate or chronologically inverted replies in the same channel exchange.
8. The attention decision receives seven days of context when it fits. When it does not, older content is summarized and newest turns remain verbatim.
9. Raw context-only channel message bodies are automatically removed after seven days and are not present in raw operational logs. A forget request removes that author's raw channel rows and linked Skarn replies immediately. They are not used for personal memory or user-specific summaries. Channel-wide summaries may retain their discussion details, names, and direct quotes indefinitely until forgotten.
10. A current message appears exactly once in attention and response model input.
11. Eligible practical auto-memories are injected into a later prompt; sensitive candidates are neither persisted nor injected. Explicit memory save/forget behavior remains correct.
12. A proactive check-in is sent only to an opted-in user, concerns a nonsensitive ongoing topic, occurs no more than once every three days per user, and is not repeated after silence for the same topic.
13. Attention failure fails closed for passive participation, with metrics recording the failure and no duplicate fallback reply.
14. Existing safety, permissions, friend-tier/rate-limit checks, ignored-user settings, command behavior, and Confidant isolation continue to pass their relevant smoke tests.

## 12. Implementation notes and known current gaps

These are observations from the code review and should be revalidated before implementation:

- `features/discordNative/attentionGate.js` uses probability stacking and a YES/NO fallback whose prompt only contains the current message; emotion detection can add another model call before the decision.
- `features/mentionRouter/mentionRouter.js` applies proactive opt-in to explicit mentions as well as passive participation. Under this spec opt-in remains mandatory; a non-opted-in direct mention receives a brief opt-in instruction rather than being silently ignored.
- `features/ai/sharedPipeline.js` stores the current message before building context, then includes that message in the fetched history and appends it again. This must be corrected.
- `features/promptContext.js` injects only `etch` memory rows although automatic extraction also writes `extracted` rows.
- `db/conversation.js` fetches assistant messages across a channel and only the current user's human messages, which can produce mixed/incomplete histories. Shared channel context and per-user conversation summaries must be separated.
- The public mention/channel path has no queue equivalent to `features/confidant/confidantConversation.js`; batching and serialization are new reliability requirements.
- The root message archive has separate ownership/retention semantics. Do not silently reuse it for seven-day AI context without auditing its configured guild scope, retention, and deletion behavior.

## 13. Proposed delivery sequence

1. Define channel-context storage, seven-day TTL cleanup, privacy boundaries, and tests.
2. Implement ordered snapshot construction and context-budget summarization; fix transcript scoping and current-message duplication.
3. Add hybrid debounce, queueing/serialization, and idempotency for guild conversation turns.
4. Replace the passive yes/no gate with the conversation-aware attention decision and structured, validated output; keep response generation separate.
5. Wire narrow auto-memory into prompt context with sensitivity/opt-out/forget enforcement.
6. Add check-in cooldown policy, safety exclusions, and observability.
7. Run smoke suites, consent/retention tests, transcript evaluation, and a staged rollout in one opted-in channel before broad enablement.

## 14. Confirmed product values

| Item | Decision | Reason |
|---|---|---|
| Active-turn debounce | 1.5 seconds | Batches quick message fragments without making new openers feel delayed. |
| Proactive check-in ceiling | Once per rolling 72 hours per user; no repeat for an unanswered topic | Check-ins remain optional and non-pressuring. |
| User-specific summary retention | Indefinitely until forgotten; opt-out stops future use but does not delete | User-selected retention and opt-out behavior. |
| Channel-wide summary content/retention | May retain full contextual details, names, and direct quotes; indefinitely until forgotten | User-selected context scope; a forget request removes attributable details for that user. |
| Passive attention trigger | Opted-in users' messages only | Non-opted-in messages are context only and do not initiate attention decisions. |
| Non-opted-in direct mention | Brief opt-in instruction; no conversational AI reply | Explains the consent requirement without treating a mention as consent. |
| Failed passive attention call | Stay silent and record aggregate failure | Prevents a noisy fallback from bypassing the conversation-aware gate. |
| Channel context overflow | Summarize oldest content; preserve newest messages verbatim | Explicitly selected behavior. |

The exact storage schema, summary refresh/compaction strategy, cleanup grace bound, and model-specific token budgeting remain implementation-plan decisions.
