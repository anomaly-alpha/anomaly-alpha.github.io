/*
  Gem Infographic - JavaScript
  ============================
  All interactive functionality extracted from gem_infographic.html
  Data loaded from embedded JSON configurations
*/

// ===== CONFIG LOADING =====

function loadConfig(id) {
  const el = document.getElementById(id);
  return el ? JSON.parse(el.textContent) : {};
}

let GAME, REWARDS, CHARTS, COUNTDOWN, UI, THEME;

function loadAllConfigs() {
  GAME = loadConfig('game-config');
  REWARDS = loadConfig('rewards-config');
  CHARTS = loadConfig('chart-config');
  COUNTDOWN = loadConfig('countdown-config');
  UI = loadConfig('ui-config');
  THEME = loadConfig('theme-config');
}

// PvP Defaults - loaded from config in DOMContentLoaded
let pvpDefaults;

// ===== CHART CONFIGURATION =====

// Config loaded from CHARTS in DOMContentLoaded

// ===== CHART FILTER DATA =====

const DC = '#333';
const CM = { event:'#ff6b35', pvp:'#e91e8a', login:'#f39c12', code:'#2ecc71' };

const modeTotals = { event: 0, pvp: 0, login: 0, code: 0 };

function buildModeData(mode, totals) {
  if (!GAME || !REWARDS) return { distribution: [0,0,0,0,0], rewards: [0,0,0,0,0,0,0], spider: [[0,0,0,0],[0,0,0,0]], colors: [], rewardColors: [] };

  const spiderTargets = GAME.spiderTargets || { events: 550, pvp: 1500, login: 360, code: 330 };
  const d = [0,0,0,0,0], r = [0,0,0,0,0,0,0], sp = [[0,0,0,0,0],[0,0,0,0,0]];
  const CM = CHARTS ? CHARTS.colors : { event:'#ff6b35', pvp:'#e91e8a', login:'#f39c12', code:'#2ecc71' };
  const DC = '#333';

  if (mode === 'all') {
    d[1] = REWARDS.categories.event.total;
    d[2] = totals.pvp;
    d[3] = REWARDS.categories.login.total;
    d[4] = REWARDS.categories.code.total;
    r[3] = d[1]; r[4] = REWARDS.cards[2].gems; r[5] = totals.pvp; r[6] = d[3];
    sp[0] = d.slice(1); sp[1] = [spiderTargets.events, spiderTargets.pvp, spiderTargets.login, spiderTargets.code];
  } else if (mode === 'event') {
    d[1] = REWARDS.categories.event.total; r[3] = REWARDS.cards[1].gems; r[4] = REWARDS.cards[2].gems;
    sp[0] = [d[1], 0, 0, 0]; sp[1] = [spiderTargets.events, 0, 0, 0];
  } else if (mode === 'pvp') {
    d[2] = totals.pvp; r[5] = totals.pvp;
    sp[0] = [0, d[2], 0, 0]; sp[1] = [0, spiderTargets.pvp, 0, 0];
  } else if (mode === 'login') {
    d[3] = REWARDS.categories.login.total; r[6] = d[3];
    sp[0] = [0, 0, d[3], 0]; sp[1] = [0, 0, spiderTargets.login, 0];
  } else if (mode === 'code') {
    d[4] = REWARDS.categories.code.total; r[3] = d[4];
    sp[0] = [0, 0, 0, d[4]]; sp[1] = [0, 0, 0, spiderTargets.code];
  }
  const cols = d.map((v,i) => v>0 ? (i===1?CM.event:i===2?CM.pvp:i===3?CM.login:CM.code) : DC);
  const rCols = r.map((v,i) => v>0 ? (i===3?CM.event:i===4?CM.event:i===5?CM.pvp:i===6?CM.login:CM.code) : DC);
  return { distribution: d, rewards: r, spider: sp, colors: cols, rewardColors: rCols };
}

let chartFilterData = {
  all: buildModeData('all', modeTotals),
  event: buildModeData('event', modeTotals),
  pvp: buildModeData('pvp', modeTotals),
  login: buildModeData('login', modeTotals),
  code: buildModeData('code', modeTotals)
};

// ===== COUNTDOWN TIMER CONFIGURATION =====

let COUNTDOWN_TARGETS = {};

function buildCountdownTargets() {
  if (!COUNTDOWN) return;
  const cfg = COUNTDOWN;
  COUNTDOWN_TARGETS = {
    weekly: getNextSunday(cfg.weekly),
    daily: getNextDailyReset(cfg.daily),
    multiverseArena: new Date(Date.now() + (cfg.events?.multiverseArena?.daysOffset || 30) * 24 * 60 * 60 * 1000),
    cecilNightmares: new Date(Date.now() + (cfg.events?.cecilNightmares?.daysOffset || 3) * 24 * 60 * 60 * 1000)
  };
}

function getNextSunday(config) {
  const now = new Date();
  const nextSunday = new Date(now);
  const day = config?.day || 'sunday';
  const dayMap = {'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6};
  const targetDay = dayMap[day] || 0;
  nextSunday.setDate(now.getDate() + (7 - now.getDay() + targetDay) % 7);
  nextSunday.setHours(config?.hour || 20, config?.minute || 0, 0, 0);
  if (nextSunday <= now) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }
  return nextSunday;
}

function getNextDailyReset(config) {
  const now = new Date();
  const targetHour = config?.hour || 20;
  const targetMinute = config?.minute || 0;
  const offsetHours = config?.offsetHours || -4;

  const estOffset = offsetHours * 60 * 60 * 1000;
  const estNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + estOffset);

  const nextReset = new Date(now);
  if (estNow.getHours() >= targetHour || (estNow.getHours() === targetHour && estNow.getMinutes() >= targetMinute)) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  nextReset.setHours(targetHour - now.getTimezoneOffset() / 60, targetMinute, 0, 0);
  return nextReset;
}

function formatCountdown(distance) {
  if (distance < 0) return "NOW!";

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  const secs = seconds.toString().padStart(2, '0');
  const mins = minutes.toString().padStart(2, '0');

  if (days > 0) {
    return `${days}d ${hours}h ${mins}:${secs}`;
  } else if (hours > 0) {
    return `${hours}h ${mins}:${secs}`;
  } else {
    return `${mins}:${secs}`;
  }
}

// ===== UTILITY FUNCTIONS =====

function copyCode() {
  navigator.clipboard.writeText('30KGTG');
  const feedback = document.createElement('div');
  feedback.className = 'gem-toast gem-toast--success';
  feedback.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Code copied!';
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 2000);
}

function revealCode(card) {
  const hint = card.querySelector('.gem-code__hint');
  const reveal = card.querySelector('.gem-code__reveal');

  if (card.classList.contains('reveal-done')) {
    navigator.clipboard.writeText('30KGTG');
    reveal.classList.add('copied');
    setTimeout(() => {
      reveal.classList.remove('copied');
    }, 2500);
  } else {
    hint.style.display = 'none';
    reveal.classList.remove('hidden');
    reveal.classList.add('revealed');
    card.classList.add('reveal-done');
  }
}

function getPvpPayout(leagueId, rank) {
  if (!GAME || !GAME.pvp) return { gems: 0, cards: 0, chips: 0, isDemotion: false };

  const league = GAME.pvp.leagues.find(l => l.id === leagueId);
  const multiplier = league ? league.multiplier : 1;
  const tier = GAME.pvp.tiers.find(t => rank >= t.rankStart && rank <= t.rankEnd);

  if (!tier) return { gems: 0, cards: 0, chips: 0, isDemotion: false };

  return {
    gems: Math.round(tier.gems * multiplier),
    cards: tier.cards,
    chips: Math.round(tier.chips * multiplier),
    isDemotion: rank >= GAME.pvp.demotionThreshold
  };
}

function getModeTotal(mode) {
  if (!REWARDS) return 0;

  if (mode === 'pvp') {
    const l1 = document.getElementById('pvp1-league')?.value || 'eliteII';
    const r1 = parseInt(document.getElementById('pvp1-rank')?.value) || 13;
    const l2 = document.getElementById('pvp2-league')?.value || 'eliteII';
    const r2 = parseInt(document.getElementById('pvp2-rank')?.value) || 13;
    const l3 = document.getElementById('pvp3-league')?.value || 'eliteII';
    const r3 = parseInt(document.getElementById('pvp3-rank')?.value) || 13;
    const p1 = getPvpPayout(l1, r1).gems;
    const p2 = getPvpPayout(l2, r2).gems;
    const p3 = getPvpPayout(l3, r3).gems;
    return p1 + p2 + p3 || 1428;
  }

  if (mode === 'login') {
    if (!REWARDS.loginRewards) return 0;
    const daily = REWARDS.loginRewards.find(e => e.name === 'Daily')?.weeklyTotal || 0;
    const weekly = REWARDS.loginRewards.find(e => e.name === 'Weekly')?.weeklyTotal || 0;
    const monthly = REWARDS.loginRewards.find(e => e.name === 'Monthly')?.weeklyTotal || 0;
    return daily + weekly + monthly;
  }

  if (mode === 'event') {
    return REWARDS.categories.event.total;
  }

  if (mode === 'code') {
    return REWARDS.categories.code.total;
  }

  return 0;
}

function calculateSelectedTotal() {
  return selectedModes.reduce((sum, mode) => sum + getModeTotal(mode), 0);
}

function animateValue(elementId, newValue, duration = 400) {
  let el;
  if (typeof elementId === 'string') {
    el = document.getElementById(elementId);
  } else if (elementId instanceof Element) {
    el = elementId;
  }
  if (!el) return;
  const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  const diff = newValue - current;
  if (diff === 0) {
    el.textContent = newValue.toLocaleString();
    return;
  }
  const startTime = performance.now();
  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    const value = Math.round(current + (diff * eased));
    el.textContent = value.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== FILTER & MODE FUNCTIONS =====

let selectedModes = ['event', 'pvp', 'login', 'code'];
let currentMode = 'all';

function filterCards(category, evt) {
  const cards = document.querySelectorAll('[data-category]');

  if (category === 'all') {
selectedModes = UI?.defaults?.selectedModes ? [...UI.defaults.selectedModes] : ['event', 'pvp', 'login', 'code'];
    updateAllButtons();
  } else {
    const modeIndex = selectedModes.indexOf(category);
    if (modeIndex > -1) {
      selectedModes.splice(modeIndex, 1);
    } else {
      selectedModes.push(category);
    }
    if (selectedModes.length === 0) selectedModes = ['event', 'pvp', 'login', 'code'];
  }

  updateModeButtonStates();
  updateAllPageTotals();

  cards.forEach(card => {
    const cardCategory = card.dataset.category;
    if (selectedModes.includes(cardCategory)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });

  updateChartsByModes(selectedModes);
  updateCountdowns();

  currentMode = selectedModes.length === 4 ? 'all' : selectedModes.join(',');
}

function updateAllButtons() {
  selectedModes = ['event', 'pvp', 'login', 'code'];
}

function updateModeButtonStates() {
  const isAllSelected = selectedModes.length === 4;

  const allBtn = document.querySelector('.gem-mode-btn--all');
  if (allBtn) {
    allBtn.classList.toggle('active', isAllSelected);
  }

  ['event', 'pvp', 'login', 'code'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    if (btn) {
      btn.classList.toggle('active', selectedModes.includes(mode));
    }
  });
}

function updateAllPageTotals() {
  const mainTotal = selectedModes.reduce((sum, mode) => sum + getModeTotal(mode), 0);
  const mainCounter = document.getElementById('totalCounter');
  if (mainCounter) animateValue('totalCounter', mainTotal, 400);

  ['event', 'pvp', 'login', 'code'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    const total = mode === 'pvp' ? getModeTotal('pvp') : Math.round(getModeTotal(mode));
    if (btn) {
      const totalEl = btn.querySelector('.gem-mode-btn__count');
      if (totalEl) {
        totalEl.textContent = total;
        animateValue(totalEl, total, 400);
      }
    }
    modeTotals[mode] = total;
  });

  const allBtn = document.querySelector('.gem-mode-btn--all');
  if (allBtn) {
    const allTotalEl = allBtn.querySelector('.gem-mode-btn__count');
    if (allTotalEl) animateValue(allTotalEl, mainTotal, 400);
  }

  chartFilterData.all = buildModeData('all', modeTotals);
  chartFilterData.event = buildModeData('event', modeTotals);
  chartFilterData.pvp = buildModeData('pvp', modeTotals);
  chartFilterData.login = buildModeData('login', modeTotals);
  chartFilterData.code = buildModeData('code', modeTotals);
}

function getRewardsChartData(modes) {
  if (!modes || modes.length === 0) return { labels: [], data: [], colors: [] };
  const order = ['code', 'event', 'pvp', 'login'];
  const colorMap = { event: '#ff6b35', pvp: '#e91e8a', login: '#f39c12', code: '#2ecc71' };
  const valueMap = {
    event: REWARDS.categories.event.total,
    pvp: getModeTotal('pvp'),
    login: getModeTotal('login'),
    code: REWARDS.categories.code.total
  };
  const filtered = modes.filter(m => order.includes(m));
  return {
    labels: filtered.map(m => m.charAt(0).toUpperCase() + m.slice(1)),
    data: filtered.map(m => valueMap[m] || 0),
    colors: filtered.map(m => colorMap[m] || '#333333')
  };
}

// ===== CHART FUNCTIONS =====

let categoryChart, rewardsChart, spiderChart;
let currentChartFilter = 'all';

function updateChartsByCategory(category) {
  const data = chartFilterData[category] || chartFilterData['all'];
  categoryChart.data.datasets[0].data = data.distribution.slice(1);
  categoryChart.data.datasets[0].backgroundColor = data.colors.slice(1);
  categoryChart.update('active');

  const catRewardsData = category === 'all'
    ? getRewardsChartData(selectedModes)
    : getRewardsChartData([category]);
  rewardsChart.data.labels = catRewardsData.labels;
  rewardsChart.data.datasets[0].data = catRewardsData.data;
  rewardsChart.data.datasets[0].backgroundColor = catRewardsData.colors;
  if (catRewardsData.data.length > 0) {
    rewardsChart.options.scales.y.max = Math.max(...catRewardsData.data);
  }
  rewardsChart.update('active');

  spiderChart.data.datasets[0].data = data.spider[0];
  spiderChart.data.datasets[1].data = data.spider[1];
  spiderChart.update('active');
}

function updateChartsByModes(modes) {
  const combinedData = {
    distribution: [0, 0, 0, 0, 0],
    rewards: new Array(7).fill(0),
    colors: ['#333333', '#333333', '#333333', '#333333', '#333333'],
    rewardColors: new Array(7).fill('#333333')
  };

  const colorMap = { event: '#ff6b35', pvp: '#e91e8a', login: '#f39c12', code: '#2ecc71' };

  modes.forEach(mode => {
    const data = chartFilterData[mode];
    if (data) {
      combinedData.distribution = combinedData.distribution.map((v, i) => v + (data.distribution[i] || 0));
      combinedData.rewards = combinedData.rewards.map((v, i) => v + (data.rewards[i] || 0));
    }
  });

  combinedData.distribution.forEach((v, i) => {
    combinedData.colors[i] = v > 0 ? (colorMap[modes.find(m => chartFilterData[m].distribution[i] > 0)] || '#00e5ff') : '#333333';
  });

  combinedData.rewards.forEach((v, i) => {
    combinedData.rewardColors[i] = v > 0 ? '#00e5ff' : '#333333';
  });

  categoryChart.data.datasets[0].data = combinedData.distribution.slice(1);
  categoryChart.data.datasets[0].backgroundColor = combinedData.colors.slice(1);
  categoryChart.update('active');

  const rewardsData = getRewardsChartData(modes);
  rewardsChart.data.labels = rewardsData.labels;
  rewardsChart.data.datasets[0].data = rewardsData.data;
  rewardsChart.data.datasets[0].backgroundColor = rewardsData.colors;
  if (rewardsData.data.length > 0) {
    rewardsChart.options.scales.y.max = Math.max(...rewardsData.data);
  }
  rewardsChart.update('active');

  const spiderData = [combinedData.distribution.slice(1), [550, 1500, 360, 330]];
  spiderChart.data.datasets[0].data = spiderData[0];
  spiderChart.data.datasets[1].data = spiderData[1];
  spiderChart.update('active');
}

function filterChart(filter) {
  currentChartFilter = filter;
  const data = chartFilterData[filter];
  const buttons = document.querySelectorAll('.chart-filter-btn');

  buttons.forEach(btn => {
    btn.classList.remove('bg-cyan-glow/20', 'border-cyan-glow/30', 'active');
    btn.classList.add('bg-cyan-glow/10', 'border-cyan-glow/20');
    if (btn.textContent.toLowerCase() === filter || (filter === 'all' && btn.textContent === 'All')) {
      btn.classList.add('bg-cyan-glow/20', 'border-cyan-glow/30');
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add('active');
    } else if (btn.textContent.toLowerCase() === 'event') {
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add('bg-orange-accent/10', 'border-orange-accent/20');
      if (filter === 'event') {
        btn.classList.add('bg-orange-accent/20', 'border-orange-accent/30');
        btn.classList.remove('bg-orange-accent/10', 'border-orange-accent/20');
      }
    } else if (btn.textContent.toLowerCase() === 'login') {
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add('bg-yellow-accent/10', 'border-yellow-accent/20');
      if (filter === 'login') {
        btn.classList.add('bg-yellow-accent/20', 'border-yellow-accent/30');
        btn.classList.remove('bg-yellow-accent/10', 'border-yellow-accent/20');
      }
    } else if (btn.textContent.toLowerCase() === 'code') {
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add('bg-green-accent/10', 'border-green-accent/20');
      if (filter === 'code') {
        btn.classList.add('bg-green-accent/20', 'border-green-accent/30');
        btn.classList.remove('bg-green-accent/10', 'border-green-accent/20');
      }
    } else if (btn.textContent.toLowerCase() === 'pvp') {
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add('bg-pink-glow/10', 'border-pink-glow/20');
      if (filter === 'pvp') {
        btn.classList.add('bg-pink-glow/20', 'border-pink-glow/30');
        btn.classList.remove('bg-pink-glow/10', 'border-pink-glow/20');
      }
    }
  });

  categoryChart.data.datasets[0].data = data.distribution.slice(1);
  categoryChart.data.datasets[0].backgroundColor = data.colors.slice(1);
  categoryChart.update('active');

  const filterRewardsData = filter === 'all'
    ? getRewardsChartData(selectedModes)
    : getRewardsChartData([filter]);
  rewardsChart.data.labels = filterRewardsData.labels;
  rewardsChart.data.datasets[0].data = filterRewardsData.data;
  rewardsChart.data.datasets[0].backgroundColor = filterRewardsData.colors;
  if (filterRewardsData.data.length > 0) {
    rewardsChart.options.scales.y.max = Math.max(...filterRewardsData.data);
  }
  rewardsChart.update('active');

  spiderChart.data.datasets[0].data = data.spider[0];
  spiderChart.data.datasets[1].data = data.spider[1];
  spiderChart.update('active');
}

// ===== UI COMPONENTS =====

// Theme Toggle
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const icon = document.getElementById('themeIcon');
  if (document.body.classList.contains('light-mode')) {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
}

// Charts Toggle
function toggleCharts() {
  const container = document.getElementById('chartsContainer');
  const toggleBtn = document.querySelector('.gem-charts-toggle');
  const label = document.querySelector('#chartsToggleLabel span:nth-child(2)');
  const icon = document.getElementById('chartsToggleIcon');

  container.classList.toggle('hidden');
  toggleBtn.classList.toggle('collapsed');

  if (container.classList.contains('hidden')) {
    label.textContent = 'Show Charts';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  } else {
    label.textContent = 'Hide Charts';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  }
}

// Search
let searchExpanded = false;

function toggleSearch() {
  const btn = document.getElementById('searchToggleBtn');
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');

  if (!searchExpanded) {
    btn.classList.add('hidden');
    input.classList.remove('hidden');
    input.classList.remove('w-0', 'px-0');
    input.classList.add('w-48', 'px-3');
    input.focus();
    clearBtn.classList.remove('hidden');
    searchExpanded = true;
  }
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  const btn = document.getElementById('searchToggleBtn');

  input.value = '';
  input.classList.add('w-0', 'px-0');
  input.classList.remove('w-48', 'px-3');
  setTimeout(() => {
    input.classList.add('hidden');
    btn.classList.remove('hidden');
  }, 300);
  clearBtn.classList.add('hidden');
  searchExpanded = false;

  document.querySelectorAll('[data-category]').forEach(card => {
    card.style.display = 'block';
    card.classList.remove('opacity-30');
    const title = card.querySelector('h3');
    if (title) title.innerHTML = title.textContent;
  });

  const noResults = document.getElementById('noSearchResults');
  if (noResults) noResults.remove();
}

function searchRewards(query) {
  const cards = document.querySelectorAll('[data-category]');
  const clearBtn = document.getElementById('searchClearBtn');

  if (query.length === 0) {
    clearSearch();
    return;
  }

  clearBtn.classList.remove('hidden');

  const noResults = document.getElementById('noSearchResults');
  if (noResults) noResults.remove();

  let matchCount = 0;
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const title = card.querySelector('h3');
    const desc = card.querySelector('.text-white\\/60');
    const category = card.dataset.category;
    const gemsText = card.querySelector('.text-5xl')?.textContent || '';

    const searchableText = (
      (title ? title.textContent : '') + ' ' +
      (desc ? desc.textContent : '') + ' ' +
      category + ' ' +
      gemsText
    ).toLowerCase();

    if (searchableText.includes(lowerQuery)) {
      card.style.display = 'block';
      card.classList.remove('opacity-30');
      matchCount++;

      if (title) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        title.innerHTML = title.textContent.replace(regex, '<span class="gem-search__highlight">$1</span>');
      }
    } else {
      card.style.display = 'none';
    }
  });

  if (matchCount === 0) {
    const grid = document.querySelector('.gem-grid--cards');
    if (grid) {
      const msg = document.createElement('div');
      msg.id = 'noSearchResults';
      msg.className = 'gem-search--empty col-span-full';
      msg.innerHTML = `<i class="fas fa-search text-white/30 mb-2"></i>No rewards found for "${query}"<p class="text-xs text-white/40 mt-2">Try: login, pvp, event, code</p>`;
      grid.appendChild(msg);
    }
  }
}

function handleSearchKeydown(e) {
  if (e.key === 'Escape') {
    clearSearch();
  }
}

// Save/Share Menu
function toggleSaveMenu() {
  const menu = document.getElementById('saveMenu');
  menu.classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('saveMenu');
  const btn = e.target.closest('[onclick="toggleSaveMenu()"]');
  if (!btn && !menu?.contains(e.target)) {
    menu?.classList.add('hidden');
  }
});

function saveCurrentView() {
  const name = prompt('Enter a name for this view:', 'My View');
  if (!name) return;

  const view = {
    id: 'view_' + Date.now(),
    name: name,
    mode: currentMode,
    chartFilter: currentChartFilter,
    theme: document.body.classList.contains('light-mode') ? 'light' : 'dark',
    createdAt: new Date().toISOString()
  };

  const saved = JSON.parse(localStorage.getItem('gemInfographicViews') || '[]');
  saved.push(view);
  localStorage.setItem('gemInfographicViews', JSON.stringify(saved));

  showToast('View "' + name + '" saved!', 'success');
  toggleSaveMenu();
}

function loadSavedView() {
  const saved = JSON.parse(localStorage.getItem('gemInfographicViews') || '[]');
  if (saved.length === 0) {
    showToast('No saved views yet', 'info');
    toggleSaveMenu();
    return;
  }

  const options = saved.map((v, i) => v.name + (v.createdAt ? ' (' + new Date(v.createdAt).toLocaleDateString() + ')' : '')).join('\n');
  const choice = prompt('Enter the number of the view to load:\n' + options.split('\n').map((v, i) => (i+1) + '. ' + v).join('\n'));

  const index = parseInt(choice) - 1;
  if (index >= 0 && index < saved.length) {
    const view = saved[index];
    if (view.theme === 'light') {
      document.body.classList.add('light-mode');
      document.getElementById('themeIcon').classList.remove('fa-moon');
      document.getElementById('themeIcon').classList.add('fa-sun');
    }
    showToast('View "' + view.name + '" loaded!', 'success');
  }
  toggleSaveMenu();
}

function shareLink() {
  const params = new URLSearchParams({
    mode: currentMode,
    chart: currentChartFilter,
    theme: document.body.classList.contains('light-mode') ? 'light' : 'dark'
  });
  const url = window.location.origin + window.location.pathname + '?' + params.toString();
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard!', 'success');
  });
  toggleSaveMenu();
}

// Toast Notifications
function showToast(message, type) {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-green-accent',
    error: 'bg-red-500',
    info: 'bg-cyan-glow'
  };
  toast.className = `gem-toast gem-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// Drill-Down Modal
function showCategoryDrillDown(category) {
  const data = categoryData[category];
  const modal = document.getElementById('drilldownModal');
  const iconEl = document.getElementById('drilldownIcon');
  const titleEl = document.getElementById('drilldownTitle');
  const totalEl = document.getElementById('drilldownTotal');
  const contentEl = document.getElementById('drilldownContent');

  iconEl.className = `gem-modal__icon-box ${data.bgColor}/20`;
  iconEl.innerHTML = `<i class="fas ${data.icon} text-${data.color} text-xl"></i>`;
  titleEl.textContent = data.title;
  titleEl.className = `gem-modal__title text-${data.color}`;
  totalEl.textContent = data.total.toLocaleString() + ' Gems';

  contentEl.innerHTML = data.rewards.map(r => `
    <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
      <div>
        <p class="text-white font-bold">${r.name}</p>
        <p class="text-white/50 text-sm">${r.desc}</p>
      </div>
      <div class="text-right">
        <p class="text-${data.color} font-bold text-lg">${r.gems.toLocaleString()}</p>
        <p class="text-white/40 text-xs">${r.pct}</p>
      </div>
    </div>
  `).join('');

  modal.classList.remove('hidden');
  modal.classList.add('gem-modal--visible');
  document.body.style.overflow = 'hidden';
}

function closeDrillDown() {
  const modal = document.getElementById('drilldownModal');
  modal.classList.add('hidden');
  modal.classList.remove('gem-modal--visible');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeDrillDown();
});

// Export Functions
async function exportAsImage() {
  showToast('Generating image...', 'info');
  const container = document.querySelector('.max-w-7xl');
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#050a14',
      scale: 2
    });
    const link = document.createElement('a');
    link.download = 'gem-rewards-' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Image exported!', 'success');
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
  toggleSaveMenu();
}

function exportData() {
  const data = {
    totalGems: getModeTotal('event') + getModeTotal('pvp') + getModeTotal('login') + getModeTotal('code'),
    categories: {
      season: 1820,
      event: getModeTotal('event'),
      pvp: getModeTotal('pvp'),
      login: getModeTotal('login'),
      code: getModeTotal('code')
    },
    rewards: [
      { name: 'Elite League I', gems: 810, category: 'season' },
      { name: 'Invincible League', gems: 560, category: 'season' },
      { name: 'Elite League II', gems: 450, category: 'season' },
      { name: 'Multiverse Alliance War', gems: 750, category: 'pvp' },
      { name: 'The Long Haul', gems: 300, category: 'event' },
      { name: "Earth's Defenders", gems: 200, category: 'event' },
      { name: 'Promo Code', gems: 300, category: 'code' },
      { name: 'Daily Payout', gems: 30, category: 'login' },
      { name: 'Weekly Payout', gems: 60, category: 'login' },
      { name: 'Monthly Payout', gems: 90, category: 'login' }
    ]
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gem-rewards-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ===== COUNTDOWN TIMERS =====

let lastSecond = -1;

function updateCountdowns() {
  const now = new Date();
  const currentSecond = now.getSeconds();

  if (currentSecond !== lastSecond && lastSecond !== -1) {
    document.querySelectorAll('[id^="countdown-"]').forEach(el => {
      el.classList.remove('gem-animate--countdown-pulse');
      void el.offsetWidth;
      el.classList.add('gem-animate--countdown-pulse');
    });
  }
  lastSecond = currentSecond;

  const eventEl = document.getElementById('countdown-event');
  const pvpEl = document.getElementById('countdown-pvp');
  const loginEl = document.getElementById('countdown-login');
  const codeEl = document.getElementById('countdown-code');

  const showEvent = selectedModes.includes('event');
  const showPvp = selectedModes.includes('pvp');
  const showLogin = selectedModes.includes('login');
  const showCode = selectedModes.includes('code');

  if (showEvent) {
    const nightmaresMs = COUNTDOWN_TARGETS.cecilNightmares.getTime() - now.getTime();
    eventEl.textContent = formatCountdown(nightmaresMs);
  } else {
    eventEl.textContent = '--:--:--';
  }

  if (showPvp) {
    const multiverseMs = COUNTDOWN_TARGETS.multiverseArena.getTime() - now.getTime();
    pvpEl.textContent = formatCountdown(multiverseMs);
  } else {
    pvpEl.textContent = '--:--:--';
  }

  if (showLogin) {
    const dailyMs = COUNTDOWN_TARGETS.daily.getTime() - now.getTime();
    loginEl.textContent = formatCountdown(dailyMs);
  } else {
    loginEl.textContent = '--:--:--';
  }

  if (showCode) {
    const dailyMs = COUNTDOWN_TARGETS.daily.getTime() - now.getTime();
    codeEl.textContent = formatCountdown(dailyMs);
  } else {
    codeEl.textContent = '--:--:--';
  }
}

// ===== PVP CARD FUNCTIONS =====

function generateRankOptions(selectId) {
  const select = document.getElementById(selectId);
  for (let i = 1; i <= 120; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    select.appendChild(option);
  }
}

function updatePvpCard(cardId) {
  const league = document.getElementById(`pvp${cardId}-league`).value;
  const rank = parseInt(document.getElementById(`pvp${cardId}-rank`).value);
  const payout = getPvpPayout(league, rank);
  animateValue(`pvp${cardId}-gems`, payout.gems);
  animateValue(`pvp${cardId}-cards`, payout.cards);
  animateValue(`pvp${cardId}-chips`, payout.chips);
  const demotionEl = document.getElementById(`pvp${cardId}-demotion`);
  if (demotionEl) {
    if (payout.isDemotion) {
      demotionEl.classList.remove('hidden');
    } else {
      demotionEl.classList.add('hidden');
    }
  }
  savePvpSelection(cardId);
  updateAllPageTotals();
}

function savePvpSelection(cardId) {
  const league = document.getElementById(`pvp${cardId}-league`).value;
  const rank = document.getElementById(`pvp${cardId}-rank`).value;
  localStorage.setItem(`pvp${cardId}_league`, league);
  localStorage.setItem(`pvp${cardId}_rank`, rank);
}

function loadPvpSelection(cardId) {
  const savedLeague = localStorage.getItem(`pvp${cardId}_league`);
  const savedRank = localStorage.getItem(`pvp${cardId}_rank`);
  const defaults = pvpDefaults[cardId];
  if (savedLeague) {
    document.getElementById(`pvp${cardId}-league`).value = savedLeague;
  } else {
    document.getElementById(`pvp${cardId}-league`).value = defaults.league;
  }
  if (savedRank) {
    document.getElementById(`pvp${cardId}-rank`).value = savedRank;
  } else {
    document.getElementById(`pvp${cardId}-rank`).value = defaults.rank;
  }
  updatePvpCard(cardId);
}

function clearPvpSelection(cardId) {
  const defaults = pvpDefaults[cardId];
  document.getElementById(`pvp${cardId}-league`).value = defaults.league;
  document.getElementById(`pvp${cardId}-rank`).value = defaults.rank;
  localStorage.removeItem(`pvp${cardId}_league`);
  localStorage.removeItem(`pvp${cardId}_rank`);
  updatePvpCard(cardId);
}

function initializePvPCards() {
  generateRankOptions('pvp1-rank');
  generateRankOptions('pvp2-rank');
  generateRankOptions('pvp3-rank');
  loadPvpSelection(1);
  loadPvpSelection(2);
  loadPvpSelection(3);
  updateAllPageTotals();
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', function() {
  loadAllConfigs();
  buildCountdownTargets();

  // Rebuild chartFilterData now that configs are loaded
  Object.assign(modeTotals, { event: 0, pvp: 0, login: 0, code: 0 });
  chartFilterData = {
    all: buildModeData('all', modeTotals),
    event: buildModeData('event', modeTotals),
    pvp: buildModeData('pvp', modeTotals),
    login: buildModeData('login', modeTotals),
    code: buildModeData('code', modeTotals)
  };

  pvpDefaults = {
    1: GAME.pvp.defaults,
    2: GAME.pvp.defaults,
    3: GAME.pvp.defaults
  };

  const chartAnimConfig = CHARTS.animation || { duration: 750, easing: 'easeOutQuart' };
  const chartTtipConfig = CHARTS.tooltip || { backgroundColor: 'rgba(10, 35, 60, 0.95)', borderColor: 'rgba(0, 229, 255, 0.5)', borderWidth: 1, titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' }, bodyFont: { family: 'Rajdhani', size: 13 }, padding: 12, cornerRadius: 8, displayColors: true, boxPadding: 4, callbacks: { label: function(context) { const value = context.raw; const total = context.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0; const avg = total / context.dataset.data.length; const vsAvg = value > avg ? '+' : ''; return [ `${value.toLocaleString()} Gems`, `${pct}% of category`, value > avg ? `${vsAvg}${(value - avg).toLocaleString()} vs avg` : '' ]; } } };

  const initDistribution = CHARTS.initialData?.distribution || [500, 750, 293, 300];
  const initSpiderActual = CHARTS.initialData?.spiderActual || [500, 750, 293, 300];
  const spiderTargets = GAME.spiderTargets ? [GAME.spiderTargets.events, GAME.spiderTargets.pvp, GAME.spiderTargets.login, GAME.spiderTargets.code] : [550, 1500, 360, 330];

  Chart.defaults.color = '#ffffff';
  Chart.defaults.borderColor = 'rgba(0, 229, 255, 0.2)';

  new Chart(document.getElementById('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: CHARTS.labels?.distribution || ['Events', 'PvP', 'Login', 'Code'],
      datasets: [{
        data: initDistribution,
        backgroundColor: [CHARTS.colors.event, CHARTS.colors.pvp, CHARTS.colors.login, CHARTS.colors.code],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      animation: { duration: chartAnimConfig.duration, easing: chartAnimConfig.easing, delay: 0 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 20, font: { family: 'Rajdhani', size: 12 } }
        },
        tooltip: chartTtipConfig
      }
    }
  });

  const rewardsInitData = getRewardsChartData(['event', 'pvp', 'login', 'code']);
  new Chart(document.getElementById('rewardsChart'), {
    type: 'bar',
    data: {
      labels: rewardsInitData.labels,
      datasets: [{
        label: 'Gems',
        data: rewardsInitData.data,
        backgroundColor: rewardsInitData.colors,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: chartAnimConfig.duration, easing: chartAnimConfig.easing, delay: 100 },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,229,255,0.1)' }, ticks: { display: false }, max: Math.max(...rewardsInitData.data) || 100 },
        x: { grid: { display: false }, ticks: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: chartTtipConfig
      }
    }
  });

  new Chart(document.getElementById('spiderChart'), {
    type: 'radar',
    data: {
      labels: CHARTS.labels?.spider || ['Events', 'PvP', 'Login', 'Code'],
      datasets: [{
        label: 'Gems',
        data: initSpiderActual,
        backgroundColor: 'rgba(0, 229, 255, 0.2)',
        borderColor: CHARTS.colors.cyan,
        pointBackgroundColor: CHARTS.colors.cyan,
        borderWidth: 2
      }, {
        label: 'Target',
        data: spiderTargets,
        backgroundColor: 'rgba(233, 30, 138, 0.1)',
        borderColor: CHARTS.colors.pink,
        pointBackgroundColor: CHARTS.colors.pink,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: chartAnimConfig.duration, easing: chartAnimConfig.easing, delay: 200 },
      scales: {
        r: {
          beginAtZero: true,
          grid: { color: 'rgba(0,229,255,0.2)' },
          pointLabels: { color: '#fff', font: { size: 10 } },
          ticks: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: chartTtipConfig
      }
    }
  });

  categoryChart = Chart.getChart('categoryChart');
  rewardsChart = Chart.getChart('rewardsChart');
  spiderChart = Chart.getChart('spiderChart');

  initializePvPCards();

  [1, 2, 3].forEach(i => {
    localStorage.removeItem(`pvp${i}_league`);
    localStorage.removeItem(`pvp${i}_rank`);
    document.getElementById(`pvp${i}-league`).value = pvpDefaults[i].league;
    document.getElementById(`pvp${i}-rank`).value = pvpDefaults[i].rank;
    updatePvpCard(i);
  });

  selectedModes = ['event', 'pvp', 'login', 'code'];
  updateModeButtonStates();
  updateAllPageTotals();

  ['all', 'code', 'event', 'pvp', 'login'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    if (!btn) return;
    btn.addEventListener('mouseenter', () => {
      const cards = mode === 'all'
        ? document.querySelectorAll('.gem-card')
        : document.querySelectorAll(`.gem-card[data-category="${mode}"]`);
      cards.forEach(card => card.classList.add(`gem-card--mode-highlight--${mode}`));
    });
    btn.addEventListener('mouseleave', () => {
      document.querySelectorAll('[class*="gem-card--mode-highlight--"]').forEach(card => {
        card.className = card.className.replace(/gem-card--mode-highlight--\w+/g, '');
      });
    });
  });

  setInterval(updateCountdowns, 1000);
  updateCountdowns();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('theme') === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('themeIcon').classList.remove('fa-moon');
    document.getElementById('themeIcon').classList.add('fa-sun');
  }
  if (urlParams.get('mode')) {
    filterCards(urlParams.get('mode'), { currentTarget: document.querySelector('.gem-mode-btn--' + urlParams.get('mode')) || document.querySelector('.gem-mode-btn--all') });
  }
  if (urlParams.get('chart')) {
    filterChart(urlParams.get('chart'));
  }
});

// Debug helpers
window.debugPvp = () => {
  const l1 = document.getElementById('pvp1-league').value;
  const r1 = parseInt(document.getElementById('pvp1-rank').value);
  alert('l1=' + l1 + ' r1=' + r1 + '\np1=' + getPvpPayout(l1, r1).gems);
};

window.debugMode = () => {
  const l1 = document.getElementById('pvp1-league').value;
  const r1 = parseInt(document.getElementById('pvp1-rank').value);
  const l2 = document.getElementById('pvp2-league').value;
  const r2 = parseInt(document.getElementById('pvp2-rank').value);
  const l3 = document.getElementById('pvp3-league').value;
  const r3 = parseInt(document.getElementById('pvp3-rank').value);
  const p1 = getPvpPayout(l1, r1).gems;
  const p2 = getPvpPayout(l2, r2).gems;
  const p3 = getPvpPayout(l3, r3).gems;
  alert('p1=' + p1 + ' p2=' + p2 + ' p3=' + p3 + '\nSum=' + (p1+p2+p3));
};