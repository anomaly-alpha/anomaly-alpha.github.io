# Plan 96: Benchmark Harness for PvP Calculations

**Problem:** PvP calculations run on every selector change. As the codebase grows, these calculations could become slow. There's no benchmark to detect regressions.

**Goal:** Add a benchmark harness that measures `getPvpPayout()` execution time across all league/rank combinations. Track in CI.

---

## Step 1: Create benchmark script

**File: `scripts/benchmark.js`**:

```js
var BENCHMARK_ITERATIONS = 100;

function benchmark() {
  // Load config
  loadAllConfigs();

  var results = {
    restricted: [],
    open: [],
    multiverse: []
  };

  ['restricted', 'open', 'multiverse'].forEach(function (arena) {
    var leagues = arena === 'multiverse' ? GAME.pvp.multiverseLeagues.length : GAME.pvp.leagues.length;
    var ranks = 120;

    for (var league = 0; league < leagues; league++) {
      var leagueTimes = [];
      for (var rank = 1; rank <= ranks; rank++) {
        var start = performance.now();
        for (var i = 0; i < BENCHMARK_ITERATIONS; i++) {
          getPvpPayout(arena, league, rank);
        }
        var avg = (performance.now() - start) / BENCHMARK_ITERATIONS;
        leagueTimes.push(avg);
      }
      var avgLeage = leagueTimes.reduce(function (a, b) { return a + b; }, 0) / leagueTimes.length;
      results[arena].push(avgLeage);
    }
  });

  // Print results
  Object.keys(results).forEach(function (arena) {
    var times = results[arena];
    var avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    var max = Math.max.apply(null, times);
    var min = Math.min.apply(null, times);
    console.log(arena + ': avg=' + avg.toFixed(3) + 'ms max=' + max.toFixed(3) + 'ms min=' + min.toFixed(3) + 'ms');
  });

  // Return summary for CI
  return {
    totalTime: Object.values(results).flat().reduce(function (a, b) { return a + b; }, 0),
    maxTime: Math.max.apply(null, Object.values(results).flat())
  };
}

var summary = benchmark();
console.log('Total: ' + summary.totalTime.toFixed(2) + 'ms, Max: ' + summary.maxTime.toFixed(3) + 'ms');

// Exit with error if too slow
if (summary.maxTime > 5) {
  console.error('✗ PvP calculations too slow (>5ms per call)');
  process.exit(1);
}
```

---

## Step 2: Add benchmark to CI

```yaml
- name: Benchmark PvP calculations
  run: node scripts/benchmark.js
```

---

## Step 3: Track benchmark history

Store benchmark results to detect regressions:

```yaml
- name: Store benchmark
  run: |
    node scripts/benchmark.js --json > benchmark-results.json
```

---

## Step 4: Add benchmark npm script

```json
"benchmark": "node scripts/benchmark.js"
```

---

## Files Created: `scripts/benchmark.js`, `.github/workflows/deploy.yml` (updated), `package.json`
