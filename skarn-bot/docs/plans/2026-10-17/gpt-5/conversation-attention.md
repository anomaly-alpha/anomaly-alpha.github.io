# Skarn Conversation and Attention — Implementation Plan

**Date:** 2026-10-17
**Status:** Implemented locally; SQLite-backed verification is blocked by the local native binding
**Spec:** [`skarn-bot/docs/specs/2026-10-17/gpt-5/conversation-attention.md`](../../../specs/2026-10-17/gpt-5/conversation-attention.md)
**Audience:** Any coding model or engineer implementing this plan in the repository

## 1. Mission and non-negotiable decisions

Implement the linked spec. Read it before changing code. If this plan and the spec conflict, the spec wins; if repository behavior or a policy ambiguity prevents safe implementation, stop and ask the user rather than silently changing product behavior. Do not rewrite unrelated user changes.

The implementation must preserve these decisions:

- A user's `proactive_opt_in` consent is mandatory for AI engagement and check-ins. A direct mention/reply does not grant consent. A non-opted-in direct mention gets a short deterministic opt-in instruction, never an AI-generated conversational reply.
- Passive attention runs only when an opted-in user's message arrives in a guild channel enabled by `/aichat on`. Non-opted-in messages in that channel can supply room context, but cannot trigger an attention call or be reply targets.
- A conversation-aware attention model call is separate from reply generation. It receives the seven-day channel window plus relevant channel/user summaries; it decides `respond` or `stay_silent`. Only approved decisions enter the response pipeline.
- A general, unaddressed channel comment is allowed when an opted-in message triggered the decision. Never directly address a non-opted-in person.
- Batch active-exchange messages for 1.5 seconds. New openers should be evaluated promptly. Serialize channel turns and re-check consent before sending.
- Keep raw shared channel messages for seven days. Longer-lived channel summaries may retain full context, names, and exact quotes, indefinitely until forgotten. A forget request must remove the user's personal data and their attributable channel-summary segments.
- User-specific memory is narrow and nonsensitive. Opt-out stops future extraction and use but does not erase existing personal memory/summaries. `/forget` deletes personal memory/summaries and removes the user's attributable details, names, and quotes from channel summaries.
- Check-ins are opt-in, nonsensitive, low-pressure, at most once per rolling 72 hours per user, and not repeated for an unanswered topic.
- Use the configured model route and `moderatedChatCompletion`; do not require a model-specific JSON mode or tool feature. Parse and validate structured attention output from ordinary text. Fail closed for passive attention.

## 2. Current architecture to preserve

- Guild message routing is in `skarn-bot/bot.js` (`messageCreate`): opt-in commands, activations, mentions, configured AI channels, passive reactions/interjections, and startup maintenance are already ordered there.
- `skarn-bot/features/mentionRouter/mentionRouter.js` applies permission, opt-in, hourly cap, hostile-content, silence, reaction-only, then `runPipeline()`. Keep these safety/rate gates; adjust direct mention handling as specified below.
- `skarn-bot/features/ai/sharedPipeline.js` stores the user turn, analyzes it, calls `buildContext()`, generates/condenses a reply, stores the assistant turn, sends it, and extracts memory asynchronously.
- `skarn-bot/features/discordNative/attentionGate.js` currently uses probability heuristics, emotion detection, and a current-message-only YES/NO model call. Replace that decision behavior; do not add another heuristic gate in front of the new model decision.
- Database access is through `skarn-bot/db/database.js`, which composes `db/<domain>.js`; schema is `skarn-bot/db/skarn-schema.sql`; versioned migrations live in `skarn-bot/db/migrations.js`. Add a new migration after v4. Do not rewrite applied migration history.
- Existing personal memory is in `memory_entries` (`skarn-bot/db/memory.js`). `/forget` currently only deletes these entries (`skarn-bot/features/forget/forget.handler.js`); expand it transactionally.
- Proactive logic is in `features/proactive/absenceDetector.js` and `features/proactive/scheduler.js`; current check-in templates are generic, and daily/three-day suppression already exists in partial form. Reuse/adapt rather than adding a second scheduler.
- Tests are plain Node smoke scripts in `skarn-bot/scripts/smokes/`, run in isolated SQLite DBs by `npm run smoke`. There is no test framework.

## 3. Data model and migration design

Implement additive, indexed tables in migration v5 (with matching fresh-install schema definitions) and compatibility migrations v6/v7:

### 3.1 `channel_context_messages`

One row per human message and each Skarn reply captured while the guild channel has AI chat enabled. Minimum columns:

| Column | Purpose |
|---|---|
| `message_id` (primary key) | Discord deduplication and edit/delete synchronization |
| `guild_id`, `channel_id` | Hard scope boundary for transcript queries |
| `author_id`, `author_name` | Speaker identity; names are permitted context under the approved policy |
| `content` | Raw body, retained no longer than seven days |
| `created_at`, `captured_at` | Source timestamp and ingestion timestamp; TTL is based on source timestamp |
| `reference_message_id` | Reply/thread relationship when present |
| `related_user_id` | For Skarn replies, opted-in triggering user ID so forget removes related messages |
| `is_skarn` | Distinguishes Skarn's messages from human messages |

Add indexes for `(guild_id, channel_id, created_at)`, `(guild_id, author_id, created_at)`, and `(guild_id, related_user_id, created_at)`. Do not persist an opt-in snapshot as the authority; read current consent when deciding whether a new message may trigger or be addressed. Store Skarn replies here for shared room context and link them to the opted-in triggering user. Ignore other bot authors unless the spec is amended.

### 3.2 Channel summary segments with provenance

Use a separate `channel_context_summary_segments` table so channel-wide summaries cannot be confused with personal memory. Each segment must have a stable ID, guild/channel, summary text, covered time interval, created/updated timestamps, and source author/message provenance. Store `source_author_ids` and `source_message_ids` in a queryable normalized relation or validated JSON field. Preserve exact quotes only when they are verifiable substrings of source messages at generation time.

Summaries may contain full contextual detail, speaker names, and exact quoted text, as approved. Keep them indefinitely until forgotten. Provenance is mandatory: `/forget` must find and delete segments attributable to the requesting user even after raw source rows have expired. Avoid one opaque rolling summary with no author attribution.

### 3.3 User-specific summary consent

Retain existing `conversation_summaries` for user-specific Skarn exchanges, adding an expiry only if required by current schema (the agreed retention is indefinite until forgotten). While the user's opt-in is off, do not extract or inject their personal memory/summaries. Preserve these records until `/forget`; re-check active consent at every use. Do not repurpose `memory_entries` to store shared channel summaries.

### 3.4 Migration requirements

- Update `skarn-bot/db/skarn-schema.sql` and append additive migrations v5-v7 in `skarn-bot/db/migrations.js`; make them idempotent and transactional. v5 creates tables/indexes; v6 adds `is_skarn` if absent; v7 adds `related_user_id` and its index if absent.
- Migration must not copy the existing 30-day `message_activity_archive` into AI context or summaries. Existing archive data has different scope and retention.
- Test both a fresh database and a copy-shaped v4 database. Confirm tables/indexes, `PRAGMA user_version`, and rerun safety.
- Update `skarn-bot/db/database.js` facade by composing the new domain module (recommended `skarn-bot/db/channelContext.js`) without duplicating shared connection logic.

## 4. Implementation phases

### Phase 0 — Contract and test seams

- Add pure helpers for eligibility, structured attention-result validation, bounded transcript assembly, and cooldown calculations. Keep DB/network calls outside pure decision formatting where practical.
- Make the attention call replaceable in smoke tests by stubbing `ai/client` before loading the module, following current CommonJS patterns. Tests must not make network calls.
- Add a small configuration boundary for batching duration (default 1500 ms) and attention/history token budget. Do not add new dependencies. Model choice follows existing configured model selection; don't hardcode a provider-specific model.
- Record decision telemetry without storing raw prompt/transcript text.

**Exit checks:** pure helpers have deterministic smoke coverage; test stubs prove zero network access.

### Phase 1 — Storage, privacy, and retention

Files: `db/skarn-schema.sql`, `db/migrations.js`, new `db/channelContext.js`, `db/database.js`, `bot.js`, and a new smoke suite.

1. Add the v5 schema/tables/indexes above, including source provenance for summary segments.
2. Implement insert/upsert-by-message-ID, chronological channel-window reads, source edit/delete handling, summary persistence, and author-attributed summary deletion. Scope every query by guild and channel.
3. Capture human messages only in currently AI-enabled text channels. Capture non-opted-in messages as raw context only; mark them in runtime eligibility logic, not as personal-memory inputs.
4. On message edits, update the retained raw row. On message deletion, delete the raw row and remove/rebuild summary segments containing that source, subject to remaining source rows and provenance. Do not retain deleted raw text in a new summary.
5. Add a synchronous/idempotent pruning function deleting raw rows where `created_at <= now - 7 days`. Call it at startup alongside existing archive cleanup and before transcript reads, with bounded batch size if the table is large. Use the existing maintenance/error-logging pattern near `bot.js` startup.
6. When `/aichat off` disables a channel, stop capturing and passive evaluation immediately. Retain existing channel summaries until a forget request; keep that distinction explicit in command help or docs.
7. Add a smoke proving TTL boundary, duplicate message id idempotency, edit/delete synchronization, channel/guild isolation, and no migration data-copy from the message archive.

**Exit checks:** seven-day raw TTL is enforced on read and by cleanup; channel summaries persist independently with author/source provenance; no private cross-guild query path.

### Phase 2 — Ingestion, consent, and turn queue

Files: `bot.js`, `features/mentionRouter/mentionRouter.js`, new `features/conversation/turnCoordinator.js` (or equivalent small module), `features/activation/activationRegistry.js` only if required by command wiring, and smoke tests.

1. In `messageCreate`, identify AI-enabled channels and ingest eligible human messages into the seven-day context store before returning through ordinary command routing. Capture all human speakers for context, but skip other bot authors. Capture Skarn replies from the shared response send hooks, with `is_skarn=1` and `related_user_id` set to the opted-in triggering user. Avoid double-capture from direct mention and passive paths.
2. Only enqueue an attention decision when the source message author is opted in and all existing channel/ignored-user checks permit processing. Messages from non-opted-in authors stay in context only. The attention module must never be called for them.
3. Maintain per-channel serialized processing, with 1.5-second debounce for active turns and chronological batching. New opener work begins promptly; do not wait for an active-turn debounce when no exchange is active. Bound queue length and memory. On overflow, merge adjacent user content with message IDs preserved; never silently drop an opted-in user's turn.
4. Deduplicate by Discord message ID. Preserve reference IDs and author attribution. If new messages arrive during attention or response generation, queue them for the next snapshot.
5. Re-check `/aichat on`, ignored-user status, user opt-in, permissions, and safety immediately before the response is sent. An opt-out or channel disable while a model call is in flight cancels/suppresses the send.
6. In `handleMention`, for a non-opted-in direct mention/reply, first preserve existing permission, hostile-content, and silencing behavior; if eligible, send a short deterministic opt-in instruction using safe `allowedMentions`. Do not call `moderatedChatCompletion`, `runPipeline`, or extract memory for the instruction.
7. For opted-in explicit mentions/replies, do not let the random `shouldReactOnly()` path silently replace the requested answer. Keep passive response decisions governed by the attention model; preserve independent passive reaction behavior elsewhere.
8. Ensure Skarn's successful replies are inserted into the shared channel transcript once, in the same ordered coordinator, and are not re-ingested through Discord event handling.

**Exit checks:** opt-in and mode are enforced under race conditions; mention opt-in instruction is deterministic; burst turns have one ordered coordinator path.

### Phase 3 — Transcript and summary assembly

Files: new `features/conversation/channelTranscript.js` (or equivalent), `db/channelContext.js`, `features/promptContext.js`, `features/ai/sharedPipeline.js`, `persona/identity.js`, and summary tests.

1. Build the seven-day channel transcript in ascending timestamp order, with speaker names, Skarn markers, reply relationships, and a single copy of each message. Include only the active guild/channel.
2. Keep shared channel transcript, channel-wide summary segments, user-specific conversation summaries, and personal memories in distinct prompt sections with source labels. Wrap all user/channel-derived text as untrusted data.
3. Keep newest transcript messages verbatim. When context exceeds budget, summarize oldest messages into channel-wide summary segments. Summary instructions must permit relevant names and direct quotes; validate exact quoted spans against source content before persistence. Preserve source author/message IDs for each segment. On invalid model output, do not overwrite a valid summary; keep the oldest raw rows until they naturally expire and emit a metric.
4. Implement summary compaction as deterministic, idempotent transactions: write validated summary segments and provenance first, then mark covered ranges; never drop the only copy of context before summary validation succeeds. Raw source rows still expire at seven days.
5. Keep channel-wide summary segments indefinitely. Provide `forgetUserFromChannelSummaries(userId, guildId)` that deletes/redacts all segments whose provenance includes the user, across the user's guild channels. If a segment combines multiple speakers, regenerate from surviving provenance if source rows still exist; otherwise delete the mixed segment rather than retain forgotten text.
6. Fix current-message duplication in `sharedPipeline.js`: the current turn must be included once whether context is read before or after storing. Remove the current channel's mixed history query from group-context duties; continue to use user-specific conversation queries only for personal history.
7. Include relevant `extracted` memory entries alongside explicit `etch` facts only when opted in and eligible. Filter sensitive candidates before persistence and prompt use; keep the `etch`/explicit distinction visible.

**Exit checks:** transcript ordering and labels; exact-once current turn; overflowing history compresses old context and preserves recent exact turns; no channel summary crosses guild/channel boundaries; forget removes attributed details.

### Phase 4 — Conversation-aware attention model

Files: `features/discordNative/attentionGate.js`, `features/ai/guildBudget.js`, `features/ai/sharedPipeline.js`, `bot.js`, plus a dedicated attention smoke suite.

1. Replace the probability stack, per-message emotion model call, and current-message-only YES/NO fallback with one conversation-aware attention call using the assembled transcript, summaries, current turn, consent metadata, and eligible response targets.
2. Use `moderatedChatCompletion()` with existing permission/moderation/rate-limit handling, an `attention` bucket, and a configurable model route. Add `attention` to the guild-budgeted bucket set (or explicitly document and test an approved alternative); include its calls in budget usage because this call runs for each eligible passive turn. Update `scripts/smokes/12-guild-budget.js`.
3. Ask for a compact plain JSON object, e.g. `{decision, target_user_id, category, reply_intent}`. Validate types, allowed decision enum, target eligibility, lengths, and required fields in code. Do not rely on OpenAI-only response-format mode. Strip code fences if needed, parse exactly one object, reject trailing/ambiguous output, and fail closed on invalid output.
4. A `respond` decision can either select an opted-in user who is part of the exchange or choose `unaddressed`. Reject any target that is not opted in, is ignored, or is no longer eligible. The model must be told: non-opted-in messages are context only and cannot trigger a decision or be addressed.
5. Pass the same transcript snapshot, validated target, and `reply_intent` into reply generation. Keep existing persona, tools, safety, permissions, condenser, and response pipeline. Do not regenerate attention inside the response pipeline.
6. If the attention call is blocked, rate-limited, malformed, or unavailable, stay silent for passive channel participation and record a privacy-safe failure reason. Do not fall back to heuristics or retry another model on the same message. Explicit opted-in mentions continue through the direct response path.
7. Ensure direct mention/reply responses use the ordinary shared response pipeline and don't spend the passive attention call.

**Exit checks:** tests prove a closed acknowledgment can be silent, an opted-in message can trigger a general comment, a non-opted-in message cannot trigger the call, invalid target fails closed, no attention call on direct mentions, and model failure emits no passive reply.

### Phase 5 — Memory, opt-out, and forget completeness

Files: `features/memory/memoryExtractor.js`, `features/preprocessing/postProcessor.js`, `features/promptContext.js`, `features/forget/forget.handler.js`, `commands/forget.js`, `db/memory.js`, `db/conversation.js`, `db/channelContext.js`, and opt-in/status copy in `bot.js`.

1. Guard memory extraction at its entry point and before persistence: user must be opted in; message must be from the user, not context-only; candidate must pass a conservative sensitive-content filter. Do not infer a fact from shared channel context.
2. Make only eligible practical memories available to prompts. Include relevant explicit `etch` facts and eligible extracted preferences/projects/events/facts with provenance and confidence; avoid dumping all memory rows.
3. Update `skarn opt in`, `skarn opt out`, status/help copy to state: opt-in enables AI conversation in enabled channels and proactive check-ins; opt-out suspends future extraction/use but retains existing data until `/forget`. Do not add a second consent flag.
4. Expand `/forget` as one database transaction. All scopes delete the user's attributable raw channel rows/Skarn replies and summary segments so compaction cannot recreate forgotten details. `memory` deletes personal memory and channel context but keeps private conversation history; `conversation` deletes personal conversation/derived data and channel context but keeps explicit memory; `all` deletes both. Cancel queued/in-flight turns for the user where safe and scope deletion to that guild.
5. Make deletion idempotent. Return a clear private confirmation that distinguishes forgotten personal data from the seven-day channel context (which expires automatically) and explain no data from this user's messages remains in channel summaries after the operation.
6. Add tests showing opt-out prevents new extraction and prompt injection but retains existing data; `/forget` removes personal and attributed summary data; re-opt-in resumes use only for data not already forgotten.

**Exit checks:** consent applies consistently to mention, passive chat, memory extraction, and check-ins; `/forget` removes every new storage surface and existing personal memory surfaces in transaction.

### Phase 6 — Proactive follow-ups

Files: `features/intelligence/followUpEngine.js`, `features/proactive/absenceDetector.js`, `features/proactive/scheduler.js`, follow-up storage methods in `db/`, and tests.

1. Replace generic absence messages such as “felt quiet without you” with a grounded, optional check-in tied to a specific ongoing nonsensitive topic from the user's own retained summary/history. Do not derive a user check-in from non-opted-in speakers' details.
2. Add a rolling 72-hour per-user cooldown based on successful sent records, plus no repeat of an unanswered topic. Failed send attempts do not count as successful check-ins but must not create retry storms. Keep `DAILY_PROACTIVE_LIMIT` only if it remains compatible; it must not weaken the 72-hour cap.
3. Skip topics classified sensitive or ambiguous. Use no guilt, urgency, pressure, or “I missed you” language. If no safe grounded topic exists, send nothing.
4. Re-check consent immediately before send, in addition to at candidate-selection time. An opt-out cancels pending check-ins.
5. Use existing cooldown/follow-up persistence where possible; do not create duplicate schedulers. Keep `/aichat on` scope for active participation separate from guild check-in delivery rules.

**Exit checks:** cooldown boundary tests (71h59m blocks, 72h permits), one unanswered topic is not repeated, opt-out cancels, sensitive/empty candidate results in no send.

### Phase 7 — Operations, documentation, and rollout

Files: `bot.js`, `features/ai/guildBudget.js`, new/updated smoke suites, `CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, and `docs/message-archive-retention.md` only if its scope needs clarification.

1. Add privacy-safe metrics: attention decision counts/categories, eligible turn counts, queue wait, attention/response latency, token/call counts, malformed/failure counts, duplicate/out-of-order count, retention cleanup count/oldest row, and consent blocks. Never log raw transcript or prompt text.
2. Add migration, consent, TTL, summary-provenance, deletion, attention, queue, memory, and check-in smoke coverage. Register scripts automatically under `scripts/smokes/` (the orchestrator discovers all `.js` files).
3. Update docs to distinguish the seven-day AI context store, indefinite channel-summary segments, personal memory, user conversation summaries, and the separate message activity archive. Explain exact opt-out and `/forget` semantics.
4. Stage rollout: deploy additive schema and disabled code paths; enable new capture/attention only in one test AI channel with opted-in testers; inspect aggregate metrics and manually review consent/retention cases; then expand. Do not silently enable AI chat in other channels.
5. If rollback is required, disable new attention/capture via a kill switch/config flag while keeping migrations additive. Do not drop tables or delete summary records as part of rollback. Continue raw TTL cleanup.

## 5. Acceptance test matrix

Focused suites are split by concern: `19-channel-context-store.js`, `20-attention-decision.js`, `21-turn-coordinator.js`, `22-memory-safety.js`, and `23-checkin-policy.js`. Every AI call is stubbed or avoided; all DB tests use `SKARN_DB_PATH` temp DBs.

| Scenario | Expected result |
|---|---|
| Non-opted user mentions/replies to Skarn | Deterministic opt-in instruction only; no model, memory extraction, or response pipeline call |
| Opted-in explicit mention outside AI channel | Direct response path, no attention call; response isn't randomly replaced by reaction-only behavior |
| Non-opted message in enabled channel | Captured as context only; no attention call and no direct reply |
| Opted-in message in disabled channel | No passive attention call |
| Opted-in message in enabled channel | One attention call with seven-day context and current opt-in eligibility metadata |
| Attention selects non-opted target or malformed JSON | Reject and stay silent; emit aggregate error metric |
| Attention returns silence | No response call, no send, no filler reaction |
| Attention approves general comment | Generate and send one unaddressed response; no non-opted mention |
| Two messages 1.4 s apart in active turn | One ordered batch/attention decision |
| Two messages beyond debounce | Separate ordered turns; no overlapping sends |
| Opt-out during generation | Suppress outbound response and future personal memory use |
| Duplicate Discord message event | Ingest/process at most once |
| Raw context at 6d23h | Available; at/after 7d cutoff unavailable and pruned |
| Context exceeds model budget | Oldest window summarized; newest exact turns preserved; validated quote spans and provenance retained |
| Forget user | Personal memory/history/embeddings/profile and their attributable channel-summary segments deleted |
| User opted out | Existing data retained but not used; new auto-memory and check-ins stop |
| Check-in at 71h59m / 72h | Block / eligible respectively; unanswered same topic not repeated |
| Sensitive or unsupported check-in topic | No proactive message |
| Migration v4 to v7 and fresh DB | Both succeed; rerun is safe; no archive backfill |

## 6. Required verification commands

Run from `skarn-bot/` in this order; fix failures before proceeding:

1. Syntax-check every changed/new JavaScript file: `node --check <path>` for each file.
2. Run the focused new suites directly with isolated DB paths, e.g. `SKARN_DB_PATH=$(mktemp -d)/attention.db node scripts/smokes/19-conversation-attention.js`.
3. Run `npm run audit:gate` to ensure all model calls still pass through the moderation chokepoint and the real gate still blocks appropriately.
4. Run `npm run smoke` for all existing and new smoke suites.
5. Run `npm run audit:docs` and reconcile stale architecture/DB docs.
6. Inspect `git diff --check`, the migration diff, prompt construction, and data deletion paths. Confirm no unrelated/previously dirty user changes were overwritten.
7. Do a controlled Discord QA in one enabled test channel with opted-in and non-opted-in accounts; test actual ordering, opt-out race, no direct engagement of non-opted speakers, seven-day cleanup, and `/forget` redaction.

Do not report tests as passing unless each command completed successfully. No external production rollout or database deletion is authorized by this plan alone; obtain the user's deployment approval before changing shared live behavior.

## 7. Implementation completion checklist

- [ ] Schema/migration is additive, idempotent, and verified on fresh and v4 databases.
- [ ] Seven-day raw context ingestion, edit/delete sync, and cleanup are tested.
- [ ] Channel summary segments preserve names/quotes as specified and carry attribution provenance.
- [ ] Opt-in gates all engagement, attention triggers, memory extraction, and proactive sends.
- [ ] Non-opted-in direct mentions get the deterministic instruction only.
- [ ] Queueing, batching, deduplication, ordering, and in-flight rechecks are tested.
- [ ] AI attention sees full bounded context, uses validated model-agnostic output, is budgeted, and fails closed.
- [ ] Response pipeline receives the exact approved snapshot once; duplicate current message is fixed.
- [ ] Narrow memory injection, sensitivity exclusion, opt-out suspension, and `/forget` cleanup are tested.
- [ ] Check-ins obey 72-hour cooldown, nonsensitive-topic rules, and no-repeat-after-silence.
- [ ] Metrics contain no raw conversation text; docs accurately describe all persistence surfaces.
- [ ] All required verification commands pass; staged QA findings are resolved.
