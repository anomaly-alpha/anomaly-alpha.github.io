# Plan 99: API Spec Document for Config Shape

**Problem:** The 7 inline JSON configs have undocumented shapes. Contributors must read the HTML/JS to understand what fields exist. There's no type definition or schema reference.

**Goal:** Create an API specification document (OpenAPI-style or TypeScript types) describing every config's shape, fields, types, and constraints.

---

## Step 1: Extract config schemas from the JS

Document each config's shape as TypeScript types (for reference, not for execution):

**File: `docs/CONFIG_SCHEMA.md`**:

```md
# Config Shape Reference

## `game-config` (GAME)

```typescript
interface GameConfig {
  pvp: {
    leagues: Array<{
      name: string;        // e.g. "Intern"
      capacity: number;    // e.g. 500
    }>;                    // Exactly 14 entries
    arenas: {
      restricted: PvpArena;
      open: PvpArena;
    };
    multiverse: PvpArena[]; // 6 grouped leagues
    demotionThreshold: number; // 86
  };
}

interface PvpArena {
  payouts: Array<{
    rankStart: number;
    rankEnd: number;
    gems: number;
    currency?: number;
    tickets?: number;
    totemFragments?: number;
    modules?: number;
  }>;
}
```

## `rewards-config` (REWARDS)

```typescript
interface RewardsConfig {
  categories: Record<string, {
    title: string;
    icon: string;
    color: string;   // Hex color, e.g. "#ff6b35"
    total: number;
  }>;
  cards: Array<{
    id: string;
    category: string;
    title: string;
    gems: number;
    isRevealable?: boolean;
    guideUrl?: string;
    modal: {
      hero: string;
      description: string;
      badge: string;
      tips: string[];  // Exactly 5 entries
    };
  }>;  // Exactly 9 entries
  promoCodes: Array<{
    code: string;
    gems: number;
    tickets?: number;
    expired?: boolean;
    expiredDate?: string;  // ISO date
  }>;
}
```

<!-- Repeat for CHARTS, COUNTDOWN, UI, THEME, contributors-config -->
```

---

## Step 2: Add JSON Schema for runtime validation (Plan 05 refines)

Create JSON Schema files for each config:

**File: `schemas/game-config.schema.json`**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["pvp"],
  "properties": {
    "pvp": {
      "type": "object",
      "required": ["leagues", "arenas", "multiverse", "demotionThreshold"],
      "properties": {
        "leagues": {
          "type": "array",
          "minItems": 14,
          "maxItems": 14,
          "items": {
            "type": "object",
            "required": ["name", "capacity"],
            "properties": {
              "name": { "type": "string" },
              "capacity": { "type": "integer", "minimum": 1 }
            }
          }
        }
      }
    }
  }
}
```

---

## Step 3: Add validation with Ajv

```bash
npm install -D ajv
```

```js
const Ajv = require('ajv');
const ajv = new Ajv();
const schema = require('../schemas/game-config.schema.json');
const validate = ajv.compile(schema);
// Validate against actual config
```

---

## Step 4: Add config schema to CI

```yaml
- name: Validate config schemas
  run: node scripts/validate-schemas.js
```

---

## Files Created: `docs/CONFIG_SCHEMA.md`, `schemas/game-config.schema.json`, `schemas/rewards-config.schema.json`, etc.
