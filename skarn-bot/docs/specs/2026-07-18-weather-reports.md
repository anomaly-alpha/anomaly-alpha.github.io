# Daily Weather Reports

## [S1] Problem

Users want weather reports posted to channels automatically every day, and on-demand weather reports styled in Skarn's voice. The existing `/weather` command only shows raw data.

## [S2] Two modes

1. **On-demand**: `/weather report <location>` — Skarn-styled AI summary. `/weather report <location> raw` — clean data.
2. **Daily auto-post**: `/weathertrack add <location> <channel> <time>` — schedules a daily report.

## [S3] Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/weather report <location>` | Everyone | AI-generated Skarn-styled forecast |
| `/weather report <location> raw` | Everyone | Clean data embed, no AI |
| `/weathertrack add <location> <channel> <time>` | Manage Channels | Schedule daily report |
| `/weathertrack remove <location> <channel>` | Manage Channels | Remove a daily report |
| `/weathertrack list` | Everyone | Show all configured reports |

## [S4] Data source

- API: `wttr.in/<location>?format=j1` (free, no key)
- Fields: temp (C/F), condition, humidity, wind, forecast for next 3 days

## [S5] Config structure

```json
{
  "guildId": {
    "weatherTracks": [
      {
        "location": "London",
        "channelId": "123456789",
        "time": "08:00",
        "lastPosted": "2026-07-18"
      }
    ]
  }
}
```

Stored in `data/config.json` alongside existing config.

## [S6] Scheduler

- `lib/weatherScheduler.js` — exports `startScheduler(client)`
- `setInterval` every 60 seconds
- On each tick: load config, iterate `weatherTracks`, check if current time matches `time` and `lastPosted` ≠ today
- Stagger posts: 2-second delay between channels to avoid rate limits
- Posts update `lastPosted` to today's date after successful send
- Runs during bot sleep mode (background task, not user-triggered)

## [S7] AI summary generation

When `AI_MODEL` is set:
1. Fetch weather data from wttr.in
2. Build system prompt: "You are Skarn. Summarize today's weather in 2-3 sentences. Be vivid, use metaphors from your ancient perspective. Mention key details: temp, condition, wind. Keep it under 300 characters."
3. Send to AI model
4. Post as embed with Skarn's summary + data fields

When `AI_MODEL` is not set:
- Fall back to raw data embed

## [S8] On-demand report

`/weather report <location>`:
1. `deferReply()` (AI call may take a moment)
2. Fetch weather from wttr.in
3. If `raw` option: build data embed, `editReply`
4. Else: send to AI for Skarn summary, build embed with summary + data, `editReply`

## [S9] Error handling

| Error | Behavior |
|-------|----------|
| Invalid location | Reply "Could not find weather for that location" |
| wttr.in down | Reply "Weather service unavailable" |
| Channel deleted / no perms | Log warning, skip, don't crash |
| AI call fails | Fall back to raw data embed |
| Rate limit (429) | Retry once after delay |

## [S10] Files

| File | Action | Purpose |
|------|--------|---------|
| `commands/weather.js` | Modify | Add `report` subcommand |
| `commands/weathertrack.js` | Create | Add/remove/list daily reports |
| `lib/weatherScheduler.js` | Create | Scheduler loop |
| `bot.js` | Modify | Import and start scheduler |

## [S11] Out of scope

- Multiple locations in one report
- Weather alerts / severe weather notifications
- Historical weather data
- Temperature unit preference per user

## [S12] Verification

1. `/weather report London` — Skarn-styled embed appears
2. `/weather report London raw` — clean data embed
3. `/weathertrack add London #general 08:00` — confirmation
4. `/weathertrack list` — shows configured track
5. Wait for scheduled time (or change clock) — report posts to channel
6. Delete the channel — scheduler logs warning, continues
7. Remove `AI_MODEL` — falls back to raw embed
