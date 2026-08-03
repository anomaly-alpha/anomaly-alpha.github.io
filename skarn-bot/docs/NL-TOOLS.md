# Skarn — Natural-Language Tools Guide

Skarn can **do things** when you ask in plain language — no slash command needed.
Ask with `@Skarn` (or just `skarn ...` in a server channel), and he'll recognize the
request and call the matching tool, then answer in character with the real result.

There are **9 tools** today. Everything below is an example *phrasing* — Skarn's
model understands natural language, so these are starters, not an exact script.

> **How it works:** when you mention Skarn, he gets the tool list and decides
> which one fits your request. If a tool fails (weather service down, empty news
> cache), he says so in character instead of guessing. Tools are an *addition* —
> exact activation phrases like `skarn weather` still work exactly as before.

---

## 1. Weather — `get_weather`

Live current conditions + 3-day forecast for a place. If you don't say where,
Skarn will ask which place.

| Example |
|---|
| `@Skarn what's the weather in Tokyo?` |
| `skarn is it raining in Paris?` |
| `what's the forecast for New York this weekend?` |
| `how hot is it in Dubai right now?` |

Returns: temperature (°C/°F), condition, humidity, wind, and a 3-day forecast.

---

## 2. News — `get_news`

Today's headlines. Skarn reads the cached news feed and refreshes it on demand
if it's empty.

| Example |
|---|
| `@Skarn what's in the news?` |
| `any headlines today?` |
| `what's happening in the world?` |
| `skarn give me the top stories` |

Returns: up to 5 headline + snippet lines.

---

## 3. Roll dice — `roll_dice`

A **real** roll (d2–d100, default d6) — Skarn doesn't invent the number.

| Example |
|---|
| `@Skarn can you roll the dice for me?` |
| `roll a d20 for me` |
| `skarn roll for initiative` |
| `give me a d100 roll` |

Returns: e.g. `🎲 Rolled a 17 (d20)`.

---

## 4. Flip a coin — `flip_coin`

A **real** coin flip — heads or tails.

| Example |
|---|
| `@Skarn flip a coin` |
| `heads or tails?` |
| `skarn, coin flip — call it` |

Returns: `🪙 Heads!` or `🪙 Tails!`.

---

## 5. Your stats — `get_user_stats`

Your conversation stats with Skarn in that server: message count, questions
asked, threads, first conversation, top topics, engagement, and mood trend.

| Example |
|---|
| `@Skarn what are my stats?` |
| `how many messages have I sent?` |
| `skarn show me my conversation stats` |

Returns: a short plain-text block. Only **your own** stats — Skarn can't look
up another user's.

---

## 6. Search the web — `search_web`

Current information Skarn doesn't know offhand.

| Example |
|---|
| `@Skarn search for the latest iPhone release date` |
| `who won the game last night?` |
| `skarn look up how to fix a leaking faucet` |

Returns: search results fed back so Skarn can answer with current info.

---

## 7. Remind you later — `set_reminder`

Set a reminder for you. Duration formats: `30m`, `2h`, `1d`, and up to 1 year.

| Example |
|---|
| `@Skarn remind me to take out the trash in 30 minutes` |
| `remind me to call mom in 2 hours` |
| `skarn set a reminder to submit the report tomorrow` |

---

## 8. Remember something — `etch_memory`

Save a fact about you so Skarn remembers it permanently (until you forget it).

| Example |
|---|
| `@Skarn remember that my birthday is July 4th` |
| `skarn, remember I'm allergic to peanuts` |
| `note this: I work from home on Fridays` |

---

## 9. Recall what he knows — `get_memory`

Ask Skarn what he remembers about you.

| Example |
|---|
| `@Skarn what do you remember about me?` |
| `skarn, what do you know about me?` |
| `recall the facts you've saved about me` |

---

## Tips

- **Mention or prefix:** `@Skarn <request>` or `skarn <request>` both work.
- **Be specific when it matters:** for weather, naming the place (`"weather in
  Kyoto"`) skips the follow-up question.
- **No exact commands needed:** the model interprets your phrasing — these
  examples are starting points, not a script.
- **Graceful failures:** if a live service is down, Skarn says so in character
  rather than making something up.
- **Activation phrases still work:** `skarn weather`, `skarn dice`, `skarn
  news`, `skarn stats`, etc. are unchanged deterministic fast-paths.

---

*Tools defined in `features/tools/toolDefinitions.js`, executed in
`features/tools/toolRunner.js`, offered on turn 1 of the shared AI pipeline
(`features/ai/sharedPipeline.js`). Spec:
`docs/specs/2026-08-02/deepseek-v4-flash/skarn-tool-invocation-design.md`.*
