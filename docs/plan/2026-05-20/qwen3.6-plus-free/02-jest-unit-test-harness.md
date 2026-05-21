# Plan 02: Jest Unit Test Harness

**Problem:** No automated tests exist. All verification is manual — checking the browser, clicking cards, changing PvP selects. Any regression (broken payout calculation, missing card, chart crash) is only caught by the user.

**Goal:** Set up Jest with a minimal test suite covering the core `getPvpPayout()` function and `loadConfig()` helper, runnable via `npm test`.

---

## Step 1: Install Jest and add test script

```bash
npm install --save-dev jest
```

```json
// package.json — add to scripts
"test": "jest --verbose",
"test:watch": "jest --watch"
```

## Step 2: Create test setup file

Since `script.js` uses global functions and inline JSON configs, create a test harness that loads the config objects without DOM dependencies.

```javascript
// tests/setup.js
const fs = require('fs');
const path = require('path');

// Parse inline JSON configs from index.html
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const configMatch = html.match(/<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g);

global.GAME = null;
global.REWARDS = null;

configMatch.forEach(block => {
  const idMatch = block.match(/id="([^"]+)"/);
  const jsonMatch = block.match(/>([\s\S]*)<\/script>/);
  if (idMatch && jsonMatch) {
    const data = JSON.parse(jsonMatch[1].trim());
    if (idMatch[1] === 'game-config') global.GAME = data;
    if (idMatch[1] === 'rewards-config') global.REWARDS = data;
  }
});
```

## Step 3: Write core PvP payout tests

```javascript
// tests/pvp-payout.test.js
// @jest-environment node

function getPvpPayout(arena, leagueId, rank) {
  const arenas = GAME.pvp.arenas[arena];
  if (!arenas || !arenas[leagueId]) return null;
  const table = arenas[leagueId];
  for (const row of table) {
    if (rank >= row.rankStart && rank <= row.rankEnd) {
      return { gems: row.gems, currency: row.currency, tickets: row.tickets || 0 };
    }
  }
  return null;
}

describe('getPvpPayout', () => {
  test('returns correct payout for Elite II rank 13 restricted', () => {
    const result = getPvpPayout('restricted', 'eliteII', 13);
    expect(result.gems).toBe(450);
    expect(result.currency).toBe(490);
  });

  test('returns correct payout for Intern rank 1 open', () => {
    const result = getPvpPayout('open', 'intern', 1);
    expect(result.gems).toBe(230);
    expect(result.shards).toBe('Lucan x1');
  });

  test('returns null for invalid arena', () => {
    expect(getPvpPayout('nonexistent', 'intern', 1)).toBeNull();
  });

  test('returns correct payout for Invincible rank 1', () => {
    const result = getPvpPayout('restricted', 'invincible', 1);
    expect(result.gems).toBe(750);
    expect(result.tickets).toBe(5);
  });
});
```

## Files Modified
- `package.json` — added jest dependency, test scripts
- `tests/setup.js` — new file, config loader for tests
- `tests/pvp-payout.test.js` — new file, core PvP tests

## Verification
```bash
npm test
# Should show 4 passing tests
```
