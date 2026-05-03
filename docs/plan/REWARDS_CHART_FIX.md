# Rewards Chart Fix Plan

> **Note:** Values in this document reflect the bug state at time of fix. Current correct values: login=1,393/week, total=4,043/week.

## Problem
Rewards bar chart has 7 static bars with hardcoded values, doesn't respond to selected modes, bars don't fill container height.

## Decisions
| Question | Answer |
|----------|--------|
| Bar count | Only selected modes (1-4 bars) |
| Labels | Mode names only (Title case) |
| Values | PvP: getModeTotal('pvp'), Events: 500, Login: 293, Code: 300 |
| Colors | Mode colors (#ff6b35, #e91e8a, #f39c12, #2ecc71) |
| Bar order | Events, PvP, Login, Code (matches mode buttons) |
| Full height | y.max = tallest bar value (dynamic) |
| Animation | Bars animate in/out on toggle |
| Empty state | Empty chart with axes (labels: [], data: []) |
| Filtered view | Show only filtered mode's bar (1 bar) |

## New Helper Function
```js
function getRewardsChartData(modes) {
  if (!modes || modes.length === 0) return { labels: [], data: [], colors: [] };
  const order = ['event', 'pvp', 'login', 'code'];
  const colorMap = { event: '#ff6b35', pvp: '#e91e8a', login: '#f39c12', code: '#2ecc71' };
  const valueMap = {
    event: GAME.ev.event[0][1] + GAME.ev.event[1][1],
    pvp: getModeTotal('pvp'),
    login: getModeTotal('login'),
    code: GAME.ev.code[0][1]
  };
  const filtered = modes.filter(m => order.includes(m));
  return {
    labels: filtered.map(m => m.charAt(0).toUpperCase() + m.slice(1)),
    data: filtered.map(m => valueMap[m] || 0),
    colors: filtered.map(m => colorMap[m] || '#333333')
  };
}
```

## Implementation Steps

### Step 1: Add helper function
Place before chart initialization section (before line 993).

### Step 2: Update rewardsChart init (line 1017-1041)
Replace 7 static bars with dynamic 4-bar default:
```js
const initData = getRewardsChartData(['event', 'pvp', 'login', 'code']);
new Chart(document.getElementById('rewardsChart'), {
  type: 'bar',
  data: {
    labels: initData.labels,
    datasets: [{
      label: 'Gems',
      data: initData.data,
      backgroundColor: initData.colors,
      borderRadius: 4,
      borderSkipped: false
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    animation: { ...chartAnimationConfig, delay: 100 },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,229,255,0.1)' },
        ticks: { display: false },
        max: Math.max(...initData.data) || 100
      },
      x: { grid: { display: false }, ticks: { display: false } }
    },
    plugins: {
      legend: { display: false },
      tooltip: chartTooltipConfig
    }
  }
});
```

### Step 3: Update updateChartsByModes (line 486-488)
```js
const rewardsData = getRewardsChartData(modes);
rewardsChart.data.labels = rewardsData.labels;
rewardsChart.data.datasets[0].data = rewardsData.data;
rewardsChart.data.datasets[0].backgroundColor = rewardsData.colors;
if (rewardsData.data.length > 0) {
  rewardsChart.options.scales.y.max = Math.max(...rewardsData.data);
}
rewardsChart.update('active');
```

### Step 4: Update filterChart rewards update (line 543-545)
```js
const rewardsData = getRewardsChartData([filter]);
rewardsChart.data.labels = rewardsData.labels;
rewardsChart.data.datasets[0].data = rewardsData.data;
rewardsChart.data.datasets[0].backgroundColor = rewardsData.colors;
if (rewardsData.data.length > 0) {
  rewardsChart.options.scales.y.max = Math.max(...rewardsData.data);
}
rewardsChart.update('active');
```

### Step 5: Update updateChartsByCategory (line 447-449)
Use same getRewardsChartData pattern for category-based updates.

## Verification
After fix:
- Bar chart shows only selected modes as bars (1-4 bars)
- Each bar colored by mode color
- Bars animate in/out when modes toggled
- Tallest bar reaches chart top (y.max set dynamically)
- Filtered view shows 1 bar for single mode
- Mode order: Events, PvP, Login, Code