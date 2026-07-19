# AI Chat Mode Gate — Spec v1

## [S1] Problem

Skarn currently responds to 100% of messages in AI-enabled channels (subject to rate limits). This creates noise — Skarn chimes in on conversations that don't involve him, filling the channel with irrelevant responses.

## [S2] Solution

Tiered gating for AI channel auto-respond:

1. **Always respond** (no gate): @mentions (already handled separately), replies to Skarn's messages (already handled by reply-to-bot routing)
2. **Always skip** (no gate): messages under 20 characters
3. **Heuristic respond**: messages containing `?` or `skarn` — skip the AI gate, respond directly
4. **AI gate**: everything else — a lightweight 5-token AI call decides YES/NO

## [S3] Implementation

### S3.1 New function in `features/discordNative/chatGate.js`

```js
const getOpenAIClient = require('../../ai/client');

async function shouldRespond(content) {
  if (!content || content.length < 20) return false;
  if (content.includes('?') || content.includes('skarn')) return true;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: 'A Discord bot is watching a channel. Message: "' + content.slice(0, 200) + '". Would the bot have something relevant to say? Answer only YES or NO.'
      }],
      max_tokens: 5,
      temperature: 0.1,
    });
    return completion.choices[0].message.content.trim() === 'YES';
  } catch {
    return false;
  }
}

module.exports = { shouldRespond };
```

### S3.2 Modify AI channel auto-respond in bot.js

Replace the current block (lines 302-313) with:

```js
  // AI channel auto-respond with smart gating
  if (process.env.AI_MODEL) {
    const cfg = loadJSON('config.json');
    const aiChans = cfg[message.guild?.id]?.aiChannels || [];
    if (aiChans.includes(message.channel.id)) {
      const { canInteract } = require('./features/proactive/absenceDetector');
      if (!canInteract(message.author.id, message.guild?.id)) return;
      if (!canRespond(message.author.id)) return;

      // Gate: skip short messages
      if (msg.length < 20) return;

      // Gate: AI decides for everything else
      const { shouldRespond } = require('./features/discordNative/chatGate');
      if (!await shouldRespond(msg)) return;

      await handleMention(message, client);
      recordResponse(message.author.id);
      return;
    }
  }
```

### S3.3 Add "skarn chat mode" status check

In the opt-in/out/status pre-check block, add:

```js
    if (/^(skarn\s+)?chat\s*mode\b/.test(msg)) {
      const cfg = loadJSON('config.json');
      const aiChans = cfg[message.guild?.id]?.aiChannels || [];
      const isEnabled = aiChans.includes(message.channel.id);
      await message.reply(isEnabled ? "this channel has auto chat mode on. i'll chime in when i have something to say." : "auto chat mode is off in this channel.");
      return;
    }
```

## [S4] Files to modify

- Create: `skarn-bot/features/discordNative/chatGate.js`
- Modify: `skarn-bot/bot.js` (AI channel block + keyword handler)
