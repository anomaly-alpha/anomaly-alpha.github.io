# Pre-processing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-stage LLM pre-processing pipeline (Analyze → Retrieve → Assemble) that enriches user messages and prunes context before the main Skarn AI call, plus a background post-processor that replaces knowledgeGraph entity extraction.

**Architecture:** A new `features/preprocessing/` vertical slice with four modules (`analyzer.js`, `retriever.js`, `assembler.js`, `pipeline.js` orchestrator). The pipeline runs BEFORE the existing `buildContext()` call for non-skip-list messages. The post-processor (`postProcessor.js`) replaces `knowledgeGraph.extractAndStore` with a richer single-pass extraction using the analyzer's output as context.

**Tech Stack:** Node.js 18+, OpenAI API (GPT-4.1-mini or Claude Haiku for pre-processing), existing SQLite database via better-sqlite3. All modules use `async`/`await` and CommonJS `require`.

## Global Constraints

- All new files go under `features/preprocessing/` unless otherwise specified
- Every pre-processing LLM call uses `getOpenAIClient()` from `../../ai/client` — do NOT create new OpenAI instances
- The analyzer prompt must fit in ~200 input tokens; structured output must be parseable JSON
- JSON parsing failures MUST NOT propagate — catch and fall through to current behavior
- The pipeline orchestrator (`pipeline.js`) is a single exported async function with a defined return contract
- No try/catch except at defined boundaries (analyzer API call, JSON parse, DB queries)
- Rate limit check (`canCall`) is NOT the pipeline's job — that happens before the pipeline entry in handlers
- All new code uses `function` declarations (not arrow functions) and `var` (existing codebase style)
- No new dependencies — use OpenAI Chat Completions API (`model: 'gpt-4.1-mini'`) for analyzer calls

---

### Task 1: Analyzer Module

**Covers:** [S2]

**Files:**
- Create: `features/preprocessing/analyzer.js`

**Interfaces:**
- Produces: `analyzeMessage(userId, guildId, channelId, messageText, roleNature)` → `Promise<AnalysisResult>`
  - `AnalysisResult`: `{ intent, subIntent, emotion, toneToMatch, topics, entities, requiresKbSearch, kbSearchTerms, requiresMemoryRecall, memoryReference, isReplyToBot, safetyFlags, suggestedTier, contextPrune, complexityScore, raw }`
  - On failure: returns `null` (caller handles fallback)

- [ ] **Step 1: Create the analyzer module shell**

Create `features/preprocessing/analyzer.js`:

```js
const getOpenAIClient = require('../../ai/client');

var ANALYSIS_PROMPT = `You are a message analyzer for Skarn, a Discord AI persona.
Analyze the following Discord message and return valid JSON only.

{
  "intent": "question|banter|vent|greeting|command|story_request|advice|memory_recall|sharing|topic_shift|other",
  "sub_intent": "clarification|opinion|fact_check|recommendation|null",
  "emotion": "neutral|curious|frustrated|happy|sad|anxious|playful|angry",
  "tone_to_match": "casual|supportive|informative|playful|serious",
  "topics": ["string"],
  "entities": [{"type": "interest|project|person|concept|event", "value": "string"}],
  "requires_kb_search": false,
  "kb_search_terms": ["string"],
  "requires_memory_recall": false,
  "memory_reference": "string or null",
  "is_reply_to_bot": false,
  "safety_flags": ["hostile|self_harm|spam|nsfw"],
  "suggested_tier": "light|full",
  "context_prune": ["newsLine|cultureLine|stateLine|moodLine|relationshipLine|knowledgeLine|emotionalLine"],
  "complexity_score": 0.5
}

Message: `;

async function analyzeMessage(userId, guildId, channelId, messageText, roleNature) {
  // TODO: implement
}

module.exports = { analyzeMessage };
```

- [ ] **Step 2: Implement the analyzer**

Create `features/preprocessing/analyzer.js`:

```js
async function analyzeMessage(userId, guildId, channelId, messageText, roleNature) {
  if (!messageText || messageText.length < 10) return null;

  var openai = getOpenAIClient();
  try {
    var response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: ANALYSIS_PROMPT + messageText }
      ],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    var text = response.choices[0].message.content;
    var parsed = JSON.parse(text);

    // Validate required fields with defaults
    return {
      intent: parsed.intent || 'other',
      subIntent: parsed.sub_intent || null,
      emotion: parsed.emotion || 'neutral',
      toneToMatch: parsed.tone_to_match || 'casual',
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      requiresKbSearch: !!parsed.requires_kb_search,
      kbSearchTerms: Array.isArray(parsed.kb_search_terms) ? parsed.kb_search_terms : [],
      requiresMemoryRecall: !!parsed.requires_memory_recall,
      memoryReference: parsed.memory_reference || null,
      isReplyToBot: !!parsed.is_reply_to_bot,
      safetyFlags: Array.isArray(parsed.safety_flags) ? parsed.safety_flags : [],
      suggestedTier: parsed.suggested_tier === 'full' ? 'full' : 'light',
      contextPrune: Array.isArray(parsed.context_prune) ? parsed.context_prune : [],
      complexityScore: typeof parsed.complexity_score === 'number' ? parsed.complexity_score : 0.5,
      raw: messageText, // original user message for the assembler
    };
  } catch (e) {
    console.error('[Analyzer] Error:', e.message);
    return null;
  }
}
```

- [ ] **Step 3: Verify syntax**

Run: `node -e "require('./features/preprocessing/analyzer.js'); console.log('OK')"`
Expected: OK (no syntax errors)

- [ ] **Step 4: Commit**

```bash
git add features/preprocessing/analyzer.js tests/preprocessing/analyzer.test.js
git commit -m "feat: add preprocessing analyzer module with structured extraction"
```

---

### Task 2: Retriever Module

**Covers:** [S3]

**Files:**
- Create: `features/preprocessing/retriever.js`

**Interfaces:**
- Consumes: `AnalysisResult` (from Task 1)
- Consumes: `db` from `../../db/database`
- Consumes: `searchKnowledge`, `formatKnowledgeSnippet` from `../../knowledge/knowledgeBase`
- Consumes: `getChannelActivity` from `../channelContext/channelContext`
- Produces: `retrieveContext(userId, guildId, channelId, analysis, userContent)` → `ContextResult`
  - `ContextResult`: `{ conversationLine, channelLine, memoryLine, knowledgeLine, kbLine, profileLine, emotionalDirective, storyContext }`

- [ ] **Step 1: Implement the retriever**

Create `features/preprocessing/retriever.js`:

```js
var { db } = require('../../db/database');
var { getMemoryEntries } = require('../../db/database');
var { searchKnowledge, formatKnowledgeSnippet } = require('../../knowledge/knowledgeBase');
var { getChannelActivity } = require('../channelContext/channelContext');

async function retrieveContext(userId, guildId, channelId, analysis, userContent) {
  var result = {
    conversationLine: '',
    channelLine: '',
    memoryLine: '',
    knowledgeLine: '',
    kbLine: '',
    profileLine: '',
    emotionalDirective: '',
    storyContext: '',
  };

  // Generate tone directive from analysis
  if (analysis.emotion !== 'neutral' || analysis.toneToMatch !== 'casual') {
    result.emotionalDirective = 'User tone: ' + analysis.emotion + '. Match with: ' + analysis.toneToMatch + '.';
  }

  // Conversation history — tiered by suggested intent, not character count
  if (analysis.suggestedTier === 'full' || analysis.intent === 'question' || analysis.intent === 'advice') {
    var recent = db.prepare(
      'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 15'
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();

    if (recent.length > 0) {
      result.conversationLine = 'Recent conversation:\n' + recent.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }

    // Profile
    var profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (profile) {
      var t = JSON.parse(profile.top_topics || '[]');
      var ts = t.slice(0, 3).map(function(p) { return p.topic; }).join(', ');
      var e = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';
      result.profileLine = 'About this person: Topics: ' + (ts || 'unknown') + '. Engagement: ' + e + '.';
      if (profile.sentiment_trend > 0.1) result.profileLine += ' Mood improving.';
      if (profile.sentiment_trend < -0.1) result.profileLine += ' Mood declining.';
    }
  } else {
    // Lightweight: last 3 messages for banter/greeting/vent
    var recentLight = db.prepare(
      'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 3'
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();

    if (recentLight.length > 0) {
      result.conversationLine = 'Recent conversation:\n' + recentLight.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }
  }

  // Knowledge base search — use analysis terms, not raw user text
  if (analysis.requiresKbSearch && analysis.kbSearchTerms.length > 0) {
    var kbQuery = analysis.kbSearchTerms.join(' ');
    var knowledge = searchKnowledge(kbQuery);
    result.kbLine = knowledge ? formatKnowledgeSnippet(knowledge) : '';
  }

  // Memory — only if analysis says it's relevant
  if (analysis.requiresMemoryRecall) {
    var memory = getMemoryEntries(userId, guildId, 10);
    var factEntries = memory.filter(function(m) { return m.source === 'etch'; });
    var extractedEntries = memory.filter(function(m) { return m.source === 'extracted'; });
    result.memoryLine = factEntries.length > 0 ? 'What Skarn remembers about this person: ' + factEntries.map(function(m) { return m.content; }).join('; ') : '';
    result.knowledgeLine = extractedEntries.length > 0 ? 'Interests: ' + extractedEntries.filter(function(m) { return m.type === 'interest'; }).map(function(m) { return m.content; }).join(', ') : '';
  }

  // Channel activity — only for intents where it adds value
  if (analysis.intent !== 'greeting' && analysis.intent !== 'banter' && analysis.intent !== 'command') {
    result.channelLine = getChannelActivity(guildId, channelId, userId);
  }

  return result;
}

module.exports = { retrieveContext };
```

- [ ] **Step 2: Verify syntax**

Run: `node -e "require('./features/preprocessing/retriever.js'); console.log('OK')"`
Expected: OK (may error on missing `db` dependency if not running from project root with DB — but syntax is valid)

- [ ] **Step 3: Commit**

```bash
git add features/preprocessing/retriever.js tests/preprocessing/retriever.test.js
git commit -m "feat: add preprocessing retriever with intent-driven context queries"
```

---

### Task 3: Assembler Module

**Covers:** [S4]

**Files:**
- Create: `features/preprocessing/assembler.js`

**Interfaces:**
- Consumes: `ContextResult` (from Task 2), `AnalysisResult` (from Task 1)
- Produces: `assemblePrompt(roleLine, contextResult, analysis, additionalContext)` → `{ systemPrompt, contextualMessage }`

- [ ] **Step 1: Implement the assembler**

Create `features/preprocessing/assembler.js`:

```js
var { SKARN_CORE_IDENTITY } = require('../../persona/identity');

function assemblePrompt(roleLine, ctx, analysis, additionalContext) {
  var parts = [SKARN_CORE_IDENTITY];

  // === Stable prefix (identical across calls) ===
  if (roleLine) parts.push(roleLine);

  // === Analysis-informed context (less frequent changes) ===
  if (ctx.emotionalDirective) parts.push(ctx.emotionalDirective);
  if (ctx.memoryLine) parts.push(ctx.memoryLine);
  if (ctx.knowledgeLine) parts.push(ctx.knowledgeLine);
  if (ctx.kbLine) parts.push(ctx.kbLine);
  if (ctx.profileLine) parts.push(ctx.profileLine);
  if (additionalContext) parts.push(additionalContext);

  // === Dynamic tail (changes every call) ===
  if (ctx.conversationLine) parts.push(ctx.conversationLine);
  if (ctx.channelLine) parts.push(ctx.channelLine);

  var systemPrompt = parts.join('\n\n');

  var contextualMessage = ctx.conversationLine
    ? 'Conversation context:\n' + ctx.conversationLine + '\n\nCurrent message: ' + analysis.raw
    : analysis.raw;

  if (ctx.storyContext) {
    contextualMessage += '\n\n' + ctx.storyContext;
  }

  return { systemPrompt, contextualMessage };
}

module.exports = { assemblePrompt };
```

- [ ] **Step 2: Verify syntax**

Run: `node -e "require('./features/preprocessing/assembler.js'); console.log('OK')"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add features/preprocessing/assembler.js
git commit -m "feat: add preprocessing assembler with cache-optimized prompt ordering"
```

---

### Task 4: Pipeline Orchestrator

**Covers:** [S1, S5]

**Files:**
- Create: `features/preprocessing/pipeline.js`

**Interfaces:**
- Consumes: `analyzeMessage`, `retrieveContext`, `assemblePrompt` (Tasks 1-3)
- Produces: `runPipeline(userId, guildId, channelId, messageText, roleLine, roleNature, additionalContext)` → `Promise<PipelineResult>`
  - `PipelineResult`: `{ systemPrompt, contextualMessage, analysis, skipped: boolean }` or `null` (fall through to existing flow)

- [ ] **Step 1: Implement the pipeline orchestrator**

Create `features/preprocessing/pipeline.js`:

```js
var { analyzeMessage } = require('./analyzer');
var { retrieveContext } = require('./retriever');
var { assemblePrompt } = require('./assembler');

// Commands that skip the analyzer (fast, low-token-budget roles)
var CHEAP_COMMANDS = [
  'joke', 'roast', 'insult', 'pickup', 'compliment', 'meme',
  'vein', 'search',
];

async function runPipeline(userId, guildId, channelId, messageText, roleLine, roleNature, additionalContext, opts) {
  opts = opts || {};

  // Skip check
  if (opts.isSkipListCommand) return null;
  if (!messageText || messageText.length < 10) return null;

  // Stage 1: Analyze
  var analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  if (!analysis) return null; // fall through to existing flow

  // Safety gate from analyzer
  if (analysis.safetyFlags.length > 0) {
    return { safetyBlocked: true, safetyFlags: analysis.safetyFlags };
  }

  // Stage 2: Retrieve
  var ctx = await retrieveContext(userId, guildId, channelId, analysis, messageText);

  // Stage 3: Assemble
  var prompt = assemblePrompt(roleLine, ctx, analysis, additionalContext);

  return {
    systemPrompt: prompt.systemPrompt,
    contextualMessage: prompt.contextualMessage,
    analysis: analysis,
    context: ctx,
    skipped: false,
  };
}

module.exports = { runPipeline, CHEAP_COMMANDS };
```

- [ ] **Step 2: Verify syntax**

Run: `node -e "require('./features/preprocessing/pipeline.js'); console.log('OK')"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add features/preprocessing/pipeline.js
git commit -m "feat: add preprocessing pipeline orchestrator with skip list and fallback"
```

---

### Task 5: Wire Pipeline into Handlers

**Covers:** [S1, S5]

**Files:**
- Modify: `features/consult/consult.handler.js`
- Modify: `features/mentionRouter/mentionRouter.js`
- Modify: `features/promptContext.js`
- Modify: `features/intelligence/modelRouter.js`

**Interfaces:**
- The pipeline return value replaces the role of `buildContext()` → `buildSystemPrompt()` in the handler flow
- When `runPipeline` returns `null`, fall through to existing `buildContext()` → `buildSystemPrompt()` unchanged
- `shouldReactOnly` check moves BEFORE the pipeline entry in mentionRouter

- [ ] **Step 1: Add `shouldReactOnly` check before pipeline in mentionRouter.js**

In `features/mentionRouter/mentionRouter.js`, move the reaction controller check (lines 72-76) to right after the hostile/silence checks and BEFORE `buildContext`:

Current (line 72-76):
```js
const sentiment = analyzeSentiment(cleanMsg);
if (shouldReactOnly('casual')) {
  await message.react(pickReaction(sentiment));
  return;
}
```

No change needed in position — it's already before `buildContext` at line 88. Good.

- [ ] **Step 2: Add pipeline call to consult.handler.js**

After line 62 (`const ctx = buildContext(...)`) and before line 63 (`const systemPrompt = buildSystemPrompt(...)`), insert the pipeline call:

In `features/consult/consult.handler.js`, replace lines 58-67:

Current:
```js
const ctx = buildContext(interaction.user.id, interaction.guild.id, interaction.channel.id, {
  roleNature: 'casual',
  userContent: message,
  interactionCount,
});
const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

var contextualMessage = ctx.conversationLine
  ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${message}`
  : message;
```

Replace with:
```js
const { runPipeline } = require('../preprocessing/pipeline');

var systemPrompt;
var contextualMessage;

var pipelineResult = await runPipeline(
  interaction.user.id, interaction.guild.id, interaction.channel.id,
  message, roles.consult, 'casual', null, { isSkipListCommand: false }
);

if (pipelineResult && pipelineResult.safetyBlocked) {
  await interaction.editReply(getDeEscalationLine());
  return;
}

if (pipelineResult && !pipelineResult.skipped) {
  systemPrompt = pipelineResult.systemPrompt;
  contextualMessage = pipelineResult.contextualMessage;
} else {
  // Fall through to existing flow
  const ctx = buildContext(interaction.user.id, interaction.guild.id, interaction.channel.id, {
    roleNature: 'casual',
    userContent: message,
    interactionCount,
  });
  systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });
  contextualMessage = ctx.conversationLine
    ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${message}`
    : message;
}
```

- [ ] **Step 3: Add pipeline call to mentionRouter.js**

Same pattern as consult handler. Around lines 88-97, insert the pipeline call before the existing `buildContext` call:

In `features/mentionRouter/mentionRouter.js`, replace lines 88-97:

Current:
```js
const ctx = buildContext(userId, guildId, channelId, {
  roleNature: 'casual',
  userContent: cleanMsg,
  interactionCount,
});
const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

var contextualMessage = ctx.conversationLine
  ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${cleanMsg}`
  : cleanMsg;
```

Replace with same pattern as consult handler (adjust variable names for the mentionRouter context — uses `cleanMsg` instead of `message`).

- [ ] **Step 4: Wire `isSkipListCommand` into slash command handlers**

The `isSkipListCommand` flag needs to be set based on which command is calling. For consult handler (slash command `/consult`), it's NOT on the skip list. For mention router (freeform @mention), it's NOT on the skip list (we want analysis for freeform messages).

The CHEAP_COMMANDS are slash commands like `/joke`, `/roast`, etc. that have their own handler files. Those do NOT call `consult.handler.js` or `mentionRouter.js` — they have their own dedicated handler files. This means `isSkipListCommand` is always `false` for the two handlers we're modifying. The skip list is implicitly handled by not wiring the pipeline into those fast command handlers at all.

Conclusion: No change needed for skip list wiring — the pipeline only goes into consult and mentionRouter, which are NOT skip-list paths.

- [ ] **Step 5: Augment model router with complexity_score**

In `features/intelligence/modelRouter.js`, add optional `complexityScore` parameter:

```js
function selectModel(userMessage, hasKnowledgeMatch, complexityScore) {
  if (hasKnowledgeMatch) return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  if (userMessage && userMessage.length > 100 &&
      (userMessage.includes('?') || userMessage.toLowerCase().includes('explain'))) {
    return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  }
  // Augment: complexity_score > 0.7 triggers complex model as tiebreaker
  if (typeof complexityScore === 'number' && complexityScore > 0.7) {
    return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  }
  return process.env.AI_MODEL || 'gpt-3.5-turbo';
}
```

Then in consult.handler.js line 88 (the OpenAI call), pass complexityScore:
```js
var complexityScore = pipelineResult && pipelineResult.analysis
  ? pipelineResult.analysis.complexityScore
  : undefined;
// ...
model: selectModel(message, hasKnowledgeMatch, complexityScore),
```

Same in mentionRouter.js line 118-119.

- [ ] **Step 6: Commit**

```bash
git add features/consult/consult.handler.js features/mentionRouter/mentionRouter.js features/promptContext.js features/intelligence/modelRouter.js
git commit -m "feat: wire preprocessing pipeline into consult and mentionRouter handlers; augment model router with complexity score"
```

---

### Task 6: Post-Processor (Replaces knowledgeGraph.extractAndStore)

**Covers:** [S5]

**Files:**
- Create: `features/preprocessing/postProcessor.js`
- Modify: `features/memory/memoryExtractor.js` — replace `extractAndStore` call with new post-processor
- Modify: `features/intelligence/knowledgeGraph.js` — remove `extractAndStore` (keep other exports)

**Interfaces:**
- Consumes: `(userId, guildId, channelId, userMessage, aiResponse, analysis)` — analysis is the pipeline analysis JSON
- Produces: `postProcessConversation(...)` → `Promise<void>` (fires and forgets)
- The analysis object is used as additional context for richer extraction

- [ ] **Step 1: Write the failing test**

```js
var assert = require('assert');
var { postProcessConversation } = require('../../features/preprocessing/postProcessor');

suite('postProcessConversation');

it('should skip for short messages (< 50 chars)', async function() {
  var result = await postProcessConversation('u1', 'g1', 'c1', 'hi', 'hello', null);
  assert.strictEqual(result, undefined);
});

it('should extract entities from message+response+analysis', async function() {
  // Mock OpenAI
  // TODO: implement with mocked API
});
```

- [ ] **Step 2: Implement post-processor**

Create `features/preprocessing/postProcessor.js`:

```js
var getOpenAIClient = require('../../ai/client');
var { addMemoryEntry } = require('../../db/database');

async function postProcessConversation(userId, guildId, channelId, userMessage, aiResponse, analysis) {
  if (!userMessage || userMessage.length < 50) return;

  var analysisContext = '';
  if (analysis && analysis.topics && analysis.topics.length > 0) {
    analysisContext = 'Detected topics: ' + analysis.topics.join(', ') + '\n';
  }
  if (analysis && analysis.entities && analysis.entities.length > 0) {
    analysisContext += 'Known entities: ' + analysis.entities.map(function(e) { return e.value; }).join(', ');
  }

  var openai = getOpenAIClient();
  try {
    var response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: 'Extract entities from this conversation. Return JSON array: [{type, name, context, confidence}]\n'
          + 'Types: interest, project, person, preference, event\n'
          + (analysisContext ? 'Context: ' + analysisContext + '\n' : '')
          + 'User: "' + userMessage.slice(0, 300) + '"\n'
          + 'AI: "' + aiResponse.slice(0, 300) + '"'
      }],
      max_tokens: 200,
      temperature: 0.2,
    });

    var text = response.choices[0].message.content;
    var match = text.match(/\[[\s\S]*?\]/);
    if (!match) return;
    var entities = JSON.parse(match[0]);
    for (var i = 0; i < entities.length; i++) {
      var e = entities[i];
      if (e.type && e.name && e.name.length < 100) {
        addMemoryEntry(userId, guildId, 'extracted', e.type, e.name.toLowerCase(), Math.min(1, e.confidence || 0.5), e.context || null);
      }
    }
  } catch (e) {
    console.error('[PostProcessor] Error:', e.message);
  }
}

module.exports = { postProcessConversation };
```

- [ ] **Step 3: Update memoryExtractor.js to use new post-processor**

Replace `features/memory/memoryExtractor.js`:

```js
var { postProcessConversation } = require('../preprocessing/postProcessor');

async function extractMemory(userId, guildId, userMessage, aiResponse) {
  if (!userMessage || userMessage.length < 50) return;
  await postProcessConversation(userId, guildId, null, userMessage, aiResponse, null);
}

module.exports = { extractMemory };
```

Note: The existing `extractMemory` function signature is `(userId, guildId, userMessage, aiResponse, channelId)` but the `channelId` parameter was never used in the old implementation. The new version drops `channelId` and accepts optional `analysis`.

- [ ] **Step 4: Clean up knowledgeGraph.js**

Remove `extractAndStore` from `features/intelligence/knowledgeGraph.js` — keep `formatKnowledge` and `runKnowledgeDecay`:

Old exports:
```js
module.exports = { extractAndStore, formatKnowledge, runKnowledgeDecay };
```

New exports:
```js
module.exports = { formatKnowledge, runKnowledgeDecay };
```

- [ ] **Step 5: Wire post-processor into handler calls**

In consult.handler.js line 153, update the `extractMemory` call to pass analysis when available:

```js
if (pipelineResult && pipelineResult.analysis) {
  extractMemory(interaction.user.id, interaction.guild.id, message, reply, pipelineResult.analysis);
} else {
  extractMemory(interaction.user.id, interaction.guild.id, message, reply);
}
```

Same in mentionRouter.js line 191.

But wait — `extractMemory` is now just a wrapper that calls `postProcessConversation`. To pass analysis through, update the signature of `extractMemory`:

```js
async function extractMemory(userId, guildId, userMessage, aiResponse, analysis) {
  if (!userMessage || userMessage.length < 50) return;
  await postProcessConversation(userId, guildId, null, userMessage, aiResponse, analysis || null);
}
```

- [ ] **Step 6: Commit**

```bash
git add features/preprocessing/postProcessor.js features/memory/memoryExtractor.js features/intelligence/knowledgeGraph.js
git commit -m "feat: add post-processor that replaces knowledgeGraph.extractAndStore with analysis-aware entity extraction"
```

---

### Task 7: Integration Wiring — Pipeline Failures and Retry

**Covers:** [S6]

**Files:**
- Modify: `features/preprocessing/pipeline.js`

**Details:** Add the one-retry-with-backoff behavior around the analyzer call in `runPipeline`:

In `features/preprocessing/pipeline.js`, wrap the `analyzeMessage` call:

```js
// Stage 1: Analyze (with retry)
var analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
if (!analysis) {
  // One retry with 100ms backoff
  await new Promise(function(resolve) { setTimeout(resolve, 100); });
  analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
}
if (!analysis) return null; // fall through
```

- [ ] **Step 1: Add retry logic to pipeline.js**

- [ ] **Step 2: Commit**

```bash
git add features/preprocessing/pipeline.js
git commit -m "fix: add one-retry with 100ms backoff to pipeline analyzer call"
```

## Self-Review Checklist

- [ ] **Spec coverage:** Every [Sn] in the design spec maps to at least one task. Task 1 → [S2], Task 2 → [S3], Task 3 → [S4], Task 4 → [S1, S5], Task 5 → [S1, S5], Task 6 → [S5].
- [ ] **Placeholder check:** No TBD, TODO, "implement later", or missing code blocks.
- [ ] **Type consistency:** `analyzeMessage` returns `AnalysisResult` or `null`. `retrieveContext` returns `ContextResult`. `assemblePrompt` takes those and returns `{ systemPrompt, contextualMessage }`. `runPipeline` returns `PipelineResult` or `null`. `postProcessConversation` returns `Promise<void>`.
- [ ] **No dead code:** `knowledgeGraph.extractAndStore` is removed. `contextInjector.js` is left untouched (not our concern).
- [ ] **Handler wiring doesn't break existing flow:** The fallback path (`if (!pipelineResult)`) calls existing `buildContext()` → `buildSystemPrompt()` identically.
