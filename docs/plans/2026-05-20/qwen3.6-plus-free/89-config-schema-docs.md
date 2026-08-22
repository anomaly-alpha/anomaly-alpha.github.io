# Plan 89: Config Schema Documentation

**Problem:** `docs/CONFIG_SCHEMA.md` exists but may be incomplete. New contributors need a complete reference for all 7 inline JSON configs.

**Goal:** Create comprehensive config schema documentation with examples.

---

## Step 1: Create/update CONFIG_SCHEMA.md

```markdown
# Config Schema Reference

## game-config (`#game-config`)

```json
{
  "pvp": {
    "leagues": [
      { "id": "string", "name": "string", "playerCount": "number" }
    ],
    "arenas": {
      "restricted": {
        "leagueId": [
          { "rankStart": "number", "rankEnd": "number", "gems": "number", "currency": "number", "tickets": "number?" }
        ]
      },
      "open": { /* same structure */ }
    },
    "multiverse": {
      "leagueGroup": [
        { "rankStart": "number", "rankEnd": "number", "gems": "number", "frags": "number", "modules": "number" }
      ]
    },
    "demotionThreshold": 86,
    "defaults": { "league": "string", "rank": "number" }
  },
  "spiderTargets": { "events": "number", "pvp": "number", "login": "number", "code": "number" }
}
```

## rewards-config (`#rewards-config`)

```json
{
  "categories": {
    "event|pvp|login|code": {
      "title": "string", "icon": "string", "color": "hex", "total": "number"
    }
  },
  "cards": [
    {
      "id": "string", "category": "string", "title": "string",
      "gems": "number?", "badge": "string?", "modal": { "hero": "string", "description": "string", "tips": ["string"] }
    }
  ],
  "promoCodes": [
    { "code": "string", "gems": "number", "tickets": "number", "expired": "boolean?", "expiredDate": "string?" }
  ]
}
```

## chart-config, countdown-config, ui-config, theme-config
[... similar schema for each ...]
```

## Files Modified
- `docs/CONFIG_SCHEMA.md` — comprehensive update

## Verification
```bash
cat docs/CONFIG_SCHEMA.md
# Should cover all 7 configs with types and examples
```
