# Skarn Discord-Native Persona — Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/discord-native-persona.md)

**Covers:** `skarn-bot/docs/specs/2026-07-18-discord-native-persona.md`

**Goal:** Upgrade Skarn's persona to feel like a Discord native — casual speech, varied response formats, emoji reactions, typing simulation, and context awareness.

**Tech Stack:** discord.js v14, existing OpenAI integration, sentiment package (already installed)

**Files changed:** 4 new, 5 modified

---

## Task 1: Response Post-Processor

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/discordNative/postProcess.js`

- [ ] **Step 1: Create the post-processor module**

```js
const ROLE_NATURE = {
  consult: 'casual',
  roast: 'casual',
  compliment: 'casual',
  insult: 'casual',
  pickup: 'casual',
  joke: 'casual',
  meme: 'casual',
  fortune: 'casual',
  improv: 'casual',

  story: 'moderate',
  song: 'moderate',
  debate: 'moderate',
  adventure: 'moderate',
  realm: 'moderate',
  realm_combat: 'moderate',
  realm_npc: 'moderate',

  homework: 'serious',
  recipe: 'serious',
  code: 'serious',
  aitrivia: 'serious',
  vein: 'serious',
  charades: 'serious',
  wouldyourather: 'serious',
  unpopularopinion: 'serious',
};

const CASUAL_ABBREVIATIONS = [' fr', ' ngl', ' tbh', ' imo', ' ngl tbh'];
const CASUAL_EMOJIS = ['💀', '😭', '🔥', '💯', '🗿', '👀', '😂', '🤌'];

function postProcess(response, roleNature) {
  if (!response || response.length === 0) return response;

  if (roleNature === 'casual') {
    response = applyLowercase(response);
    response = stripPeriod(response, 60);
    response = injectAbbreviation(response);
    response = injectEmoji(response);
  } else if (roleNature === 'moderate') {
    response = stripPeriod(response, 60, 0.2);
  } else {
    response = stripPeriod(response, 40, 0.1);
  }

  return response;
}

function applyLowercase(text) {
  if (Math.random() > 0.3) return text;
  if (text.length > 80) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function stripPeriod(text, maxLength, probability = 0.4) {
  if (Math.random() > probability) return text;
  if (text.length > maxLength) return text;
  if (text.endsWith('.') && !text.endsWith('...')) {
    return text.slice(0, -1);
  }
  return text;
}

function injectAbbreviation(text) {
  if (Math.random() > 0.15) return text;
  if (text.length > 200) return text;
  const lower = text.toLowerCase();
  if (lower.endsWith(' fr') || lower.endsWith(' ngl') || lower.endsWith(' tbh') || lower.endsWith(' imo')) return text;
  const abbr = CASUAL_ABBREVIATIONS[Math.floor(Math.random() * CASUAL_ABBREVIATIONS.length)];
  return text + abbr;
}

function injectEmoji(text) {
  if (Math.random() > 0.1) return text;
  if (text.length > 200) return text;
  const emoji = CASUAL_EMOJIS[Math.floor(Math.random() * CASUAL_EMOJIS.length)];
  return text + ' ' + emoji;
}

function splitMessage(text, maxLength = 400) {
  if (text.length <= maxLength) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxLength && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

module.exports = { postProcess, splitMessage, ROLE_NATURE };
```

**Note on splitting interaction:** The post-processor's `splitMessage` (400 chars for casual) runs BEFORE the existing 2000-char Discord limit splitting in the handler. If post-processing produces chunks under 400 chars, the 2000-char fallback never triggers. If a serious role response is under 2000 chars, no splitting occurs at all. Both layers work independently.

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/discordNative/
git commit -m "feat(skarn): add Discord-native response post-processor"
```

---

## Task 2: Reaction System

**Covers:** [S6]

**Files:**
- Create: `skarn-bot/features/discordNative/reactionSystem.js`

- [ ] **Step 1: Create the reaction system module**

```js
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const COOLDOWN_MS = 60 * 1000;
const REACTION_CHANCE = 0.03;
const cooldowns = new Map();

const STANDARD_REACTIONS = ['💀', '😭', '🔥', '💯', '🗿', '👀'];

async function maybeReact(message, client, isAsleep) {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (isAsleep) return; // Don't react during sleep mode

  // Don't react to clearly negative messages
  const score = sentiment.analyze(message.content).comparative;
  if (score < -0.5) return;

  const channelId = message.channel.id;
  const now = Date.now();

  const lastReaction = cooldowns.get(channelId) || 0;
  if (now - lastReaction < COOLDOWN_MS) return;

  if (Math.random() > REACTION_CHANCE) return;

  const botMember = message.guild.members.me;
  if (!message.channel.permissionsFor(botMember)?.has('AddReactions')) return;

  let emoji;
  try {
    const guildEmojis = await message.guild.emojis.fetch();
    if (guildEmojis.size > 0 && Math.random() > 0.5) {
      emoji = guildEmojis.random();
    }
  } catch {
    // Fall through to standard
  }

  if (!emoji) {
    emoji = STANDARD_REACTIONS[Math.floor(Math.random() * STANDARD_REACTIONS.length)];
  }

  try {
    await message.react(emoji);
    cooldowns.set(channelId, now);
  } catch {
    // Permission issue or emoji unavailable
  }
}

module.exports = { maybeReact };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/discordNative/reactionSystem.js
git commit -m "feat(skarn): add emoji reaction system for passive presence"
```

---

## Task 3: Typing Simulation

**Covers:** [S7]

**Files:**
- Create: `skarn-bot/features/discordNative/typingSim.js`

- [ ] **Step 1: Create the typing simulation module**

```js
function getTypingDelay(responseLength) {
  if (responseLength < 100) return 500 + Math.random() * 1000;
  if (responseLength < 300) return 1000 + Math.random() * 2000;
  return 2000 + Math.random() * 2000;
}

async function simulateTyping(channel, responseLength) {
  try {
    await channel.sendTyping();
    const delay = getTypingDelay(responseLength);
    await new Promise(resolve => setTimeout(resolve, delay));
  } catch {
    // Permission issue — skip silently
  }
}

module.exports = { simulateTyping };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/discordNative/typingSim.js
git commit -m "feat(skarn): add typing simulation for casual commands"
```

---

## Task 4: Context Injector

**Covers:** [S8]

**Files:**
- Create: `skarn-bot/features/discordNative/contextInjector.js`

- [ ] **Step 1: Create the context injector module**

```js
async function getRecentContext(channel, limit = 5) {
  try {
    const messages = await channel.messages.fetch({ limit: limit + 1 });
    const recent = [...messages.values()]
      .filter(m => !m.author.bot)
      .slice(0, limit)
      .reverse()
      .map(m => `[${m.author.username}]: ${m.content}`)
      .join('\n');
    return recent || '';
  } catch {
    return '';
  }
}

function buildContextualPrompt(userMessage, context) {
  if (!context) return userMessage;
  return `Recent messages in this channel:\n${context}\n\nCurrent message: ${userMessage}`;
}

module.exports = { getRecentContext, buildContextualPrompt };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/discordNative/contextInjector.js
git commit -m "feat(skarn): add context injector for conversational awareness"
```

---

## Task 5: System Prompt Rewrite

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/persona/identity.js`

- [ ] **Step 1: Replace SKARN_CORE_IDENTITY**

Replace the entire `SKARN_CORE_IDENTITY` constant with the Discord-native version from [S3] of the spec.

- [ ] **Step 2: Update consult role token budget in roles.js**

Change `roleTokenBudgets.consult` from `700` to `900`.

- [ ] **Step 3: Update consult role line**

Replace the `roles.consult` value with the new Discord-native version from [S4] of the spec.

- [ ] **Step 4: Add ROLE_NATURE export to roles.js**

Add the `ROLE_NATURE` object (from [S4]) and export it alongside `roles` and `roleTokenBudgets`.

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/persona/identity.js skarn-bot/persona/roles.js
git commit -m "feat(skarn): rewrite system prompt for Discord-native voice"
```

---

## Task 6: Integrate Post-Processor and Typing into /consult

**Covers:** [S9]

**Files:**
- Modify: `skarn-bot/features/consult/consult.handler.js`

- [ ] **Step 1: Add imports**

```js
const { postProcess, splitMessage, ROLE_NATURE } = require('../discordNative/postProcess');
const { simulateTyping } = require('../discordNative/typingSim');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
```

- [ ] **Step 2: Add context injection before AI call**

Before the `getOpenAIClient().chat.completions.create` call, add:

```js
const context = await getRecentContext(interaction.channel, 5);
const contextualMessage = buildContextualPrompt(message, context);
```

- [ ] **Step 3: Replace user message with contextual message**

Change the `messages` array to use `contextualMessage` instead of `message`:

```js
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: contextualMessage },
],
```

- [ ] **Step 4: Add post-processing and typing simulation**

After getting the completion and before splitting/sending, add:

```js
let reply = completion.choices[0].message.content;
reply = postProcess(reply, ROLE_NATURE.consult);

await simulateTyping(interaction.channel, reply.length);
```

- [ ] **Step 5: Update splitting to use post-processor's splitMessage**

Replace the existing 2000-char splitting block with:

```js
const chunks = splitMessage(reply, 400);
if (chunks.length === 1) {
  await interaction.editReply(chunks[0]);
} else {
  await interaction.editReply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp(chunks[i]);
  }
}
```

**Note:** `splitMessage` handles both casual (400-char) and serious (no split) cases. The existing 2000-char Discord limit splitting is no longer needed since `splitMessage` produces chunks well under that limit.

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/features/consult/consult.handler.js
git commit -m "feat(skarn): integrate post-processor and typing sim into /consult"
```

---

## Task 7: Integrate Post-Processor and Typing into @mention Router

**Covers:** [S9]

**Files:**
- Modify: `skarn-bot/features/mentionRouter/mentionRouter.js`

- [ ] **Step 1: Add imports**

```js
const { postProcess, splitMessage, ROLE_NATURE } = require('../discordNative/postProcess');
const { simulateTyping } = require('../discordNative/typingSim');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
```

- [ ] **Step 2: Add context injection before AI call**

Before the `getOpenAIClient().chat.completions.create` call, add:

```js
const context = await getRecentContext(message.channel, 5);
const contextualMessage = buildContextualPrompt(cleanMsg, context);
```

- [ ] **Step 3: Replace cleanMsg with contextual message**

Change the `messages` array to use `contextualMessage` instead of `cleanMsg`.

- [ ] **Step 4: Add post-processing and typing simulation**

After getting the completion, add:

```js
let reply = completion.choices[0].message.content;
reply = postProcess(reply, ROLE_NATURE.consult);

await simulateTyping(message.channel, reply.length);
```

- [ ] **Step 5: Update reply to handle message splitting**

Replace `await message.reply(reply)` with:

```js
const chunks = splitMessage(reply, 400);
await message.reply(chunks[0]);
for (let i = 1; i < chunks.length; i++) {
  await message.channel.send(chunks[i]);
}
```

**Note:** The mention router currently uses `temperature: 0.85` (different from consult's `0.8`). Preserve this difference — no change to temperature.

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/features/mentionRouter/mentionRouter.js
git commit -m "feat(skarn): integrate post-processor and typing sim into @mentions"
```

---

## Task 8: Wire Up Reaction System in bot.js

**Covers:** [S6], [S9]

**Files:**
- Modify: `skarn-bot/bot.js`

- [ ] **Step 1: Add import**

```js
const { maybeReact } = require('./features/discordNative/reactionSystem');
```

- [ ] **Step 2: Add reaction check in messageCreate handler**

After the mention router call and before keyword triggers (around line 177):

```js
// Skarn passive reactions
maybeReact(message, client, isAsleep);
```

**Note:** `isAsleep` is a module-level variable in `bot.js` that tracks sleep mode state. The reaction system checks it and skips reacting during sleep.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat(skarn): wire up emoji reaction system"
```

---

## Summary

| Task | Covers | Files Created/Modified |
|------|--------|----------------------|
| 1 | [S5] | `features/discordNative/postProcess.js` |
| 2 | [S6] | `features/discordNative/reactionSystem.js` |
| 3 | [S7] | `features/discordNative/typingSim.js` |
| 4 | [S8] | `features/discordNative/contextInjector.js` |
| 5 | [S3], [S4] | `persona/identity.js`, `persona/roles.js` |
| 6 | [S9] | `features/consult/consult.handler.js` |
| 7 | [S9] | `features/mentionRouter/mentionRouter.js` |
| 8 | [S6], [S9] | `bot.js` |

**Total:** 4 new files, 5 modified files

---

## Key Decisions

1. **Post-processor is probabilistic**: Each transformation has a chance to fire, so responses vary naturally rather than always being transformed the same way.

2. **Role classification**: Casual/moderate/serious tiers control how aggressively responses are transformed. Serious commands (homework, code, recipe) get minimal processing.

3. **Reactions are passive**: Skarn reacts to 3% of messages, with a 60-second cooldown per channel. This creates presence without spam.

4. **Typing simulation happens AFTER AI response**: The AI generates the full response first, then Skarn "types" for a realistic delay before sending. This avoids blocking the AI call.

5. **Context injection is lightweight**: 5 recent messages prepended to the user prompt. No new DB tables, just Discord API fetches.

6. **Token budget increase**: `consult` goes from 700 to 900 to accommodate context messages in the prompt.

7. **Mention cooldown stays at 1s**: The current 1s cooldown has been working fine. No change needed (original spec said 15s, but code uses 1s).

8. **Sleep mode blocks reactions**: A sleeping bot shouldn't add emoji reactions. `maybeReact` receives `isAsleep` from `bot.js` and returns early if true.

9. **Temperature preserved per surface**: `consult.handler.js` uses `temperature: 0.8`, `mentionRouter.js` uses `temperature: 0.85`. These stay different.

10. **OpenAI client is a function**: `require('../../ai/client')` returns `getOpenAIClient()`, not the client directly. All call sites use `getOpenAIClient()`.

11. **Token budget field is `max_completion_tokens`**: Not `max_tokens` — the existing code already uses the correct field name.

12. **Post-processor splitting replaces existing splitting**: The 400-char casual split runs first. The existing 2000-char Discord limit splitting is removed from consult handler since `splitMessage` produces chunks well under that limit. Mention router also gets splitting support.
