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

// Card Modal Data — all 9 card modals triggered by info icon
const CARD_MODAL_DATA = {
    'the-long-haul': {
        category: 'event',
        title: 'The Long Haul',
        gems: 300,
        badge: '★ Top 5%',
        hero: '"Endurance is everything."',
        description: 'A multi-day endurance event that tests your consistency and strategic planning. Your cumulative score across the event duration determines your ranking — only the top 5% earn this reward. The challenge intensifies each day as scores accumulate and rankings shift. Alliance participation unlocks score multipliers and bonus point events.',
        tips: [
            'Play every day to maintain momentum and avoid losing rank position',
            'Steady high scores beat sporadic burst pushes — consistency is king',
            'Join an alliance for bonus score multipliers and coordinated event participation',
            'Watch for 2x score amplifier windows and plan your biggest pushes then',
            'Prioritize daily quests contributing to event score over general progression'
        ]
    },
    'earths-defenders': {
        category: 'event',
        title: "Earth's Defenders",
        gems: 200,
        badge: '★ Top 10%',
        hero: '"Defend Earth. Rise above the rest."',
        description: 'An event centered around defending Earth from incoming threats. Your contribution score is calculated from enemies defeated, damage dealt, and objectives completed. The top 10% of contributors earn this reward. Coordination with alliance members amplifies your effectiveness and unlocks bonus score opportunities.',
        tips: [
            'Maximize daily contribution through quest completion and enemy defeats',
            'Spend event currency efficiently — avoid wasteful upgrades during active windows',
            'Coordinate with alliance for defense bonus multipliers and shared rewards',
            'Watch for bonus score amplification events and target them specifically',
            'Balance offensive and defensive tasks for optimal contribution ranking'
        ]
    },
    'daily-login': {
        category: 'login',
        title: 'Daily Login',
        gems: 910,
        badge: '★ 130×7',
        hero: '"7 days. 910 gems. Every week."',
        description: 'The foundation of your weekly gem income. You get 30 free gems each day, plus an additional 100 gems from chest rewards that require completing daily operations. With the streak running for the first 7 days of each week, that\'s 910 gems total. The weekly reset happens every Monday at server reset.',
        tips: [
            'Complete all daily operations to unlock the full 130 gems (30 free + 100 from chests)',
            'Set a daily reminder to log in at the same time each day for consistency',
            'Never miss a day — broken streaks take weeks to fully recover value from',
            'Stack with daily (910), weekly (60), and monthly (23) login rewards for maximum income',
            'Link your account to a device for convenience features like auto-login'
        ]
    },
    'weekly-login': {
        category: 'login',
        title: 'Weekly Login',
        gems: 60,
        badge: '★ Weekly',
        hero: '"Loyalty has its rewards."',
        description: 'A bonus reward for players who return each week. Claim 60 gems just for logging in once during the weekly period. This stacks with daily login bonuses — together they total 970 gems per week before monthly rewards. The weekly period resets alongside the daily login streak on Monday.',
        tips: [
            'Just one login per week is sufficient — claim early to avoid forgetting',
            'Combine with daily (910) + weekly (60) for a 970 gem/week base income',
            'Use the Monday reset as your reminder to check all login rewards at once',
            'No strategic planning needed — just the habit of checking in weekly'
        ]
    },
    'monthly-login': {
        category: 'login',
        title: 'Monthly Login',
        gems: 23,
        badge: '★ 90÷4',
        hero: '"Every 4 weeks, return stronger."',
        description: 'The monthly hero bonus rewards long-term consistent players. 90 gems are divided into four weekly claiming periods, giving you approximately 23 gems per week effectively. This compounds with daily (910) and weekly (60) login rewards for a total of ~993 gems/week from login bonuses alone.',
        tips: [
            'Check in every 4 weeks to claim your divided portion of the monthly bonus',
            'The monthly schedule aligns with major game content updates and events',
            'Long-term consistent players accumulate significant gem advantages',
            'Combine with daily (910) + weekly (60) for ~993 gems/week total login income',
            'No special strategy — just the habit of returning monthly'
        ]
    },
    'restricted-arena': {
        category: 'pvp',
        title: 'Restricted Arena',
        gems: null,
        badge: '★ Weekly',
        hero: '"Enter the arena. Prove your rank."',
        description: 'A weekly competitive PvP arena where your league and rank determine your baseline rewards. Higher leagues and ranks earn exponentially more gems, cards, and chips. Placement rewards are based on your ranking within your league at the end of the week.',
        tips: [
            'Climb to at least Elite II rank 13 for optimal gem-to-effort value',
            'Higher league multipliers dramatically increase all gem and chip rewards',
            'Cards earned are NOT multiplied by league — always awarded at base rate',
            'Alliance participation can provide ranking protection and bonus rewards',
            'Consistent weekly play prevents rank decay and maintains tier placement'
        ]
    },
    'open-arena': {
        category: 'pvp',
        title: 'Open Arena',
        gems: null,
        badge: '★ Weekly',
        hero: '"Open competition. Climb the ranks."',
        description: 'An open weekly arena for all players regardless of league. Performance is based purely on match results and ranking within your skill tier. Unlike Restricted Arena, the payout structure varies dramatically with rank. Strategic matchmaking and meta team composition significantly impact final placement and rewards.',
        tips: [
            'Play consistently throughout the week rather than rushing last-day placements',
            'Meta team compositions outperform individual skill at higher ranking tiers',
            'Review match history for patterns and adjust your approach accordingly',
            'Higher ranks in open arena grant exponentially better gem multipliers',
            'Coordinate with alliance members for duo and trio queue advantages'
        ]
    },
    'multiverse-war': {
        category: 'pvp',
        title: 'Multiverse Alliance War',
        gems: null,
        badge: '★ 5 Matches / 2 Weeks',
        hero: '"Alliance versus alliance. Global war."',
        description: "The ultimate PvP experience — a 5-match series over two weeks between alliances. Your individual performance contributes to your alliance's overall war score. The stakes are high: demotion becomes a real risk if your personal ranking drops below rank 86. Victory requires coordinated effort, strategic matchups, and consistent high-performance play.",
        tips: [
            'Coordinate with alliance for optimal team compositions every match',
            'Spread your 5 matches evenly across the 2-week period for consistent scores',
            'Individual performance directly affects alliance war ranking — bring your best',
            'After war ends, reassess your league/rank strategy for the next cycle',
            'Rank 86+ triggers demotion zone — monitor your rank throughout the war'
        ]
    },
    'promo-code': {
        category: 'code',
        title: 'Promo Code',
        gems: 300,
        badge: '★ Tap to Reveal',
        hero: '"A secret code whispered among allies."',
        description: 'A promotional code that rewards 300 gems when redeemed. The code is shared through official Invincible game channels, community events, and special promotions. Tap the card to reveal the code, then tap again to copy it to your clipboard for redemption in the in-game store.',
        tips: [
            'Tap the card to reveal the code — a 3D flip animation reveals the characters',
            'Tap the revealed code to copy it instantly to your clipboard',
            'Codes have expiration dates — redeem them promptly when discovered',
            'Follow official Invincible social media for new codes as they release',
            "Some codes are one-time use — don't share claimed codes"
        ]
    }
};

// PvP Defaults - loaded from config in DOMContentLoaded
let pvpDefaults;

// ===== CHART CONFIGURATION =====

// Config loaded from CHARTS in DOMContentLoaded

// ===== CHART FILTER DATA =====

const DC = '#333';
const CM = { event:'#ff6b35', pvp:'#e91e8a', login:'#f39c12', code:'#2ecc71' };

const modeTotals = { event: 0, pvp: 0, login: 0, code: 0 };

function buildModeData(mode, totals) {
  if (!GAME || !REWARDS) {
    return { distribution: [0,0,0,0,0], rewards: [0,0,0,0,0,0,0], spider: [[0,0,0,0],[0,0,0,0]], colors: [], rewardColors: [] };
  }

  const spiderTargets = GAME.spiderTargets || { events: 550, pvp: 1500, login: 360, code: 330 };
  const d = [0,0,0,0,0], r = [0,0,0,0,0,0,0], sp = [[0,0,0,0,0],[0,0,0,0,0]];
  const CM = CHARTS ? CHARTS.colors : { event:'#ff6b35', pvp:'#e91e8a', login:'#f39c12', code:'#2ecc71' };
  const DC = '#333';

  if (mode === 'all') {
    d[1] = getModeTotal('event');
    d[2] = getModeTotal('pvp');
    d[3] = getModeTotal('login');
    d[4] = getModeTotal('code');
    r[3] = d[1]; r[4] = REWARDS.cards[2].gems; r[5] = d[2]; r[6] = d[3];
    sp[0] = [d[1], d[2], d[3], d[4]]; sp[1] = [spiderTargets.events, spiderTargets.pvp, spiderTargets.login, spiderTargets.code];
  } else if (mode === 'event') {
    d[1] = getModeTotal('event'); r[3] = REWARDS.cards[1].gems; r[4] = REWARDS.cards[2].gems;
    sp[0] = [d[1], 0, 0, 0]; sp[1] = [spiderTargets.events, 0, 0, 0];
  } else if (mode === 'pvp') {
    d[2] = getModeTotal('pvp'); r[5] = d[2];
    sp[0] = [0, d[2], 0, 0]; sp[1] = [0, spiderTargets.pvp, 0, 0];
  } else if (mode === 'login') {
    d[3] = getModeTotal('login'); r[6] = d[3];
    sp[0] = [0, 0, d[3], 0]; sp[1] = [0, 0, spiderTargets.login, 0];
  } else if (mode === 'code') {
    d[4] = getModeTotal('code'); r[3] = d[4];
    sp[0] = [0, 0, 0, d[4]]; sp[1] = [0, 0, 0, spiderTargets.code];
  }

  const cols = d.map((v, i) => {
    if (v === 0) return DC;
    if (i === 1) return CM.event;
    if (i === 2) return CM.pvp;
    if (i === 3) return CM.login;
    return CM.code;
  });
  const rCols = r.map((v, i) => {
    if (v === 0) return DC;
    if (i === 3 || i === 4) return CM.event;
    if (i === 5) return CM.pvp;
    if (i === 6) return CM.login;
    return CM.code;
  });
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

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '0, 229, 255';
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

function savePageState() {
  const container = document.getElementById('chartsContainer');
  localStorage.setItem('gem_modes', JSON.stringify(selectedModes));
  localStorage.setItem('gem_chartFilter', currentChartFilter);
  localStorage.setItem('gem_chartsVisible', container ? String(!container.classList.contains('hidden')) : 'true');
}

function loadPageState() {
  const theme = localStorage.getItem('gem_theme');
  const modesRaw = localStorage.getItem('gem_modes');
  const chartFilter = localStorage.getItem('gem_chartFilter');
  const chartsVisible = localStorage.getItem('gem_chartsVisible');

  try {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    }

    let hidden = true;
    if (chartsVisible === 'false') {
      const container = document.getElementById('chartsContainer');
      const toggleBtn = document.querySelector('.gem-charts-toggle');
      const label = document.querySelector('#chartsToggleLabel span:nth-child(2)');
      const icon = document.getElementById('chartsToggleIcon');
      if (container) container.classList.add('hidden');
      if (toggleBtn) toggleBtn.classList.add('collapsed');
      if (label) label.textContent = 'Show Charts';
      if (icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
    } else if (chartsVisible === 'true') {
      hidden = false;
      const container = document.getElementById('chartsContainer');
      const toggleBtn = document.querySelector('.gem-charts-toggle');
      const label = document.querySelector('#chartsToggleLabel span:nth-child(2)');
      const icon = document.getElementById('chartsToggleIcon');
      if (container) container.classList.remove('hidden');
      if (toggleBtn) toggleBtn.classList.remove('collapsed');
      if (label) label.textContent = 'Hide Charts';
      if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
    }

    if (modesRaw) {
      const savedModes = JSON.parse(modesRaw);
      const validModes = ['event', 'pvp', 'login', 'code'];
      if (savedModes.length > 0) {
        selectedModes = savedModes.filter(m => validModes.includes(m));
        if (selectedModes.length === 0) selectedModes = validModes;
      }
    }
    updateModeButtonStates();
    updateAllPageTotals(true);
    if (!hidden) updateChartsByModes(selectedModes);
    document.querySelectorAll('[data-category]').forEach(card => {
      const cat = card.dataset.category;
      card.style.display = selectedModes.includes(cat) ? 'block' : 'none';
    });

    if (chartFilter && chartFilter !== 'all') {
      filterChart(chartFilter);
    }
  } catch (e) {
    // Ignore corrupt state
  }
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
  savePageState();
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

function updateAllPageTotals(skipAnimation) {
  const mainTotal = selectedModes.reduce((sum, mode) => sum + getModeTotal(mode), 0);
  const mainCounter = document.getElementById('totalCounter');
  if (mainCounter) {
    if (skipAnimation) {
      mainCounter.textContent = mainTotal.toLocaleString();
    } else {
      animateValue('totalCounter', mainTotal, 400);
    }
  }

  ['event', 'pvp', 'login', 'code'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    const total = mode === 'pvp' ? getModeTotal('pvp') : Math.round(getModeTotal(mode));
    if (btn) {
      const totalEl = btn.querySelector('.gem-mode-btn__count');
      if (totalEl) {
        if (skipAnimation) {
          totalEl.textContent = total.toLocaleString();
        } else {
          totalEl.textContent = total;
          animateValue(totalEl, total, 400);
        }
      }
    }
    modeTotals[mode] = total;
  });

  const allBtn = document.querySelector('.gem-mode-btn--all');
  if (allBtn) {
    const allTotalEl = allBtn.querySelector('.gem-mode-btn__count');
    if (allTotalEl) {
      if (skipAnimation) {
        allTotalEl.textContent = mainTotal.toLocaleString();
      } else {
        animateValue(allTotalEl, mainTotal, 400);
      }
    }
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
  const filtered = order.filter(m => modes.includes(m));
  return {
    labels: filtered.map(m => m.charAt(0).toUpperCase() + m.slice(1)),
    data: filtered.map(m => getModeTotal(m)),
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
  categoryChart.update('none');

  const catRewardsData = category === 'all'
    ? getRewardsChartData(selectedModes)
    : getRewardsChartData([category]);
  rewardsChart.data.labels = catRewardsData.labels;
  rewardsChart.data.datasets[0].data = catRewardsData.data;
  rewardsChart.data.datasets[0].backgroundColor = catRewardsData.colors;
  if (catRewardsData.data.length > 0) {
    rewardsChart.options.scales.y.max = Math.max(...catRewardsData.data);
  }
  rewardsChart.update('none');

  spiderChart.data.datasets[0].data = data.spider[0];
  spiderChart.data.datasets[1].data = data.spider[1];
  spiderChart.update('none');
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
    if (v > 0) {
      const activeMode = modes.find(m => chartFilterData[m].distribution[i] > 0);
      combinedData.colors[i] = colorMap[activeMode] || '#00e5ff';
    } else {
      combinedData.colors[i] = '#333333';
    }
  });

  combinedData.rewards.forEach((v, i) => {
    combinedData.rewardColors[i] = v > 0 ? '#00e5ff' : '#333333';
  });

  categoryChart.data.datasets[0].data = combinedData.distribution.slice(1);
  categoryChart.data.datasets[0].backgroundColor = combinedData.colors.slice(1);
  categoryChart.update('none');

  const rewardsData = getRewardsChartData(modes);
  rewardsChart.data.labels = rewardsData.labels;
  rewardsChart.data.datasets[0].data = rewardsData.data;
  rewardsChart.data.datasets[0].backgroundColor = rewardsData.colors;
  if (rewardsData.data.length > 0) {
    rewardsChart.options.scales.y.max = Math.max(...rewardsData.data);
  }
  rewardsChart.update('none');

  const spiderActual = [0, 0, 0, 0];
  const spiderTarget = spiderChart.data.datasets[1].data;

  modes.forEach(mode => {
    const data = chartFilterData[mode];
    if (data) {
      for (let j = 0; j < 4; j++) {
        spiderActual[j] += data.spider[0][j];
      }
    }
  });

  spiderChart.data.datasets[0].data = spiderActual;
  spiderChart.data.datasets[1].data = spiderTarget;
  spiderChart.update('none');
}

function filterChart(filter) {
  currentChartFilter = filter;
  const data = chartFilterData[filter];
  const buttons = document.querySelectorAll('.chart-filter-btn');

  const colorMap = {
    event: { base: 'orange-accent' },
    login: { base: 'yellow-accent' },
    code: { base: 'green-accent' },
    pvp: { base: 'pink-glow' }
  };

  buttons.forEach(btn => {
    const btnLower = btn.textContent.toLowerCase();
    const isAllBtn = btn.textContent === 'All';
    const isActive = btnLower === filter || (filter === 'all' && isAllBtn);
    const colorConfig = colorMap[btnLower];

    btn.classList.remove('bg-cyan-glow/20', 'border-cyan-glow/30', 'active');
    btn.classList.add('bg-cyan-glow/10', 'border-cyan-glow/20');

    if (isActive) {
      btn.classList.add('bg-cyan-glow/20', 'border-cyan-glow/30');
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add('active');
    } else if (colorConfig) {
      const base = colorConfig.base;
      btn.classList.remove('bg-cyan-glow/10', 'border-cyan-glow/20');
      btn.classList.add(`bg-${base}/10`, `border-${base}/20`);
      if (filter === btnLower) {
        btn.classList.add(`bg-${base}/20`, `border-${base}/30`);
        btn.classList.remove(`bg-${base}/10`, `border-${base}/20`);
      }
    }
  });

  categoryChart.data.datasets[0].data = data.distribution.slice(1);
  categoryChart.data.datasets[0].backgroundColor = data.colors.slice(1);
  categoryChart.update('none');

  const filterRewardsData = filter === 'all'
    ? getRewardsChartData(selectedModes)
    : getRewardsChartData([filter]);
  rewardsChart.data.labels = filterRewardsData.labels;
  rewardsChart.data.datasets[0].data = filterRewardsData.data;
  rewardsChart.data.datasets[0].backgroundColor = filterRewardsData.colors;
  if (filterRewardsData.data.length > 0) {
    rewardsChart.options.scales.y.max = Math.max(...filterRewardsData.data);
  }
  rewardsChart.update('none');

  spiderChart.data.datasets[0].data = data.spider[0];
  spiderChart.data.datasets[1].data = data.spider[1];
  spiderChart.update('none');
  savePageState();
}

// ===== UI COMPONENTS =====

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
  savePageState();
}


// Card Modal
function showCardModal(cardId) {
    const data = CARD_MODAL_DATA[cardId];
    if (!data) return;

    const icon = document.getElementById('cardModalIcon');
    const title = document.getElementById('cardModalTitle');
    const badge = document.getElementById('cardModalBadge');
    const total = document.getElementById('cardModalTotal');
    const content = document.getElementById('cardModalContent');

    const colorMap = { event: '#ff6b35', pvp: '#e91e8a', login: '#f39c12', code: '#2ecc71' };
    const color = colorMap[data.category] || '#00e5ff';
    const rgb = hexToRgb(color);

    icon.style.background = `rgba(${rgb}, 0.15)`;
    icon.style.border = `1px solid rgba(${rgb}, 0.4)`;
    icon.innerHTML = `<i class="fas fa-info-circle" style="color: ${color}; font-size: 1.25rem;"></i>`;

    title.textContent = data.title.toUpperCase();
    title.style.color = color;

    if (data.badge) {
        badge.textContent = data.badge;
        badge.className = 'gem-modal__badge gem-modal__badge--star';
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }

    let gemsDisplay = '';
    if (data.gems !== null) {
        gemsDisplay = `${data.gems.toLocaleString()} Gems`;
    } else {
        const pvpCardMap = { 'restricted-arena': 1, 'open-arena': 2, 'multiverse-war': 3 };
        const cardNum = pvpCardMap[cardId];
        if (cardNum) {
            const league = document.getElementById(`pvp${cardNum}-league`)?.value || 'eliteII';
            const rank = parseInt(document.getElementById(`pvp${cardNum}-rank`)?.value) || 13;
            const payout = getPvpPayout(league, rank);
            gemsDisplay = `${payout.gems.toLocaleString()} Gems · ${payout.cards} Cards · ${payout.chips.toLocaleString()} Chips`;
        }
    }
    total.textContent = gemsDisplay;
    total.style.color = color;

    let html = '';
    if (data.hero) html += `<p class="gem-modal__hero">${data.hero}</p>`;
    if (data.description) html += `<p class="gem-modal__body-text">${data.description}</p>`;

    if (cardId === 'multiverse-war') {
        const rank = parseInt(document.getElementById('pvp3-rank')?.value) || 13;
        const threshold = GAME?.pvp?.demotionThreshold || 86;
        const isDanger = rank >= threshold;
        const warningClass = isDanger ? '' : 'gem-modal__demotion-warning--safe';
        const iconClass = isDanger ? 'fa-exclamation-triangle' : 'fa-shield-check';
        const warnText = isDanger
            ? `Demotion Zone — Rank ${rank} is at or above threshold ${threshold}. Win matches to avoid demotion.`
            : `Safe Zone — Rank ${rank} is below threshold ${threshold}. Keep climbing.`;
        html += `<div class="gem-modal__demotion-warning ${warningClass}">
            <i class="fas ${iconClass}"></i>
            <span>${warnText}</span>
        </div>`;
    }

    if (data.tips?.length) {
        html += `
        <div class="gem-modal__tips">
            <div class="gem-modal__tips-header"><i class="fas fa-lightbulb"></i> Tips &amp; Strategy</div>
            <ul>${data.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>`;
    }
    content.innerHTML = html;

    const modal = document.getElementById('cardModal');
    modal.classList.remove('hidden');
    modal.classList.add('gem-modal--visible');
    document.body.style.overflow = 'hidden';
}

function closeCardModal() {
    const modal = document.getElementById('cardModal');
    modal.classList.add('hidden');
    modal.classList.remove('gem-modal--visible');
    document.body.style.overflow = '';
}



document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCardModal();
});


// ===== COUNTDOWN TIMERS =====

function updateCountdowns() {
  const now = new Date();

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

function updatePvpCard(cardId, skipTotals) {
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
  if (!skipTotals) {
    updateAllPageTotals();
    updateChartsByModes(selectedModes);
  }
}

function savePvpSelection(cardId) {
  const league = document.getElementById(`pvp${cardId}-league`).value;
  const rank = document.getElementById(`pvp${cardId}-rank`).value;
  localStorage.setItem(`pvp${cardId}_league`, league);
  localStorage.setItem(`pvp${cardId}_rank`, rank);
}

function loadPvpSelection(cardId) {
  const defaults = pvpDefaults[cardId];
  document.getElementById(`pvp${cardId}-league`).value = localStorage.getItem(`pvp${cardId}_league`) || defaults.league;
  document.getElementById(`pvp${cardId}-rank`).value = localStorage.getItem(`pvp${cardId}_rank`) || defaults.rank;
  updatePvpCard(cardId, true);
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
  updateAllPageTotals(true);
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

  function tooltipLabelCallback(context) {
    return `${context.raw.toLocaleString()} Gems`;
  }

  const chartTtipConfig = CHARTS.tooltip || {
    backgroundColor: 'rgba(10, 35, 60, 0.95)',
    borderColor: 'rgba(0, 229, 255, 0.5)',
    borderWidth: 1,
    titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' },
    bodyFont: { family: 'Rajdhani', size: 13 },
    padding: 12,
    cornerRadius: 8,
    displayColors: true,
    boxPadding: 4,
    callbacks: { label: tooltipLabelCallback }
  };

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
        borderWidth: 0
      }]
    },
    options: {
      responsive: false,
      animation: { duration: 0 },
      interaction: { mode: undefined },
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
      responsive: false,
      animation: { duration: 0 },
      interaction: { mode: undefined },
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
      responsive: false,
      animation: { duration: 0 },
      interaction: { mode: undefined },
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

  loadPageState();

  const colorMap = { event: '#ff6b35', pvp: '#e91e8a', login: '#f39c12', code: '#2ecc71', cyan: '#00e5ff', purple: '#9b59b6' };
  document.querySelectorAll('.gem-card').forEach(card => {
    const cat = card.dataset.category;
    const color = colorMap[cat] || colorMap.cyan;
    card.style.setProperty('--card-color', color);
  });

  const cardsByCategory = { code: [], event: [], pvp: [], login: [] };
  document.querySelectorAll('.gem-card[data-category]').forEach(card => {
    const cat = card.dataset.category;
    if (cardsByCategory[cat]) cardsByCategory[cat].push(card);
  });

  ['all', 'code', 'event', 'pvp', 'login'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    if (!btn) return;
    btn.addEventListener('mouseenter', () => {
      if (mode === 'all') return;
      cardsByCategory[mode].forEach(card => card.classList.add(`gem-card--mode-highlight--${mode}`));
    });
    btn.addEventListener('mouseleave', () => {
      ['event', 'pvp', 'login', 'code', 'all'].forEach(m => {
        cardsByCategory[m]?.forEach(card => card.classList.remove(`gem-card--mode-highlight--${m}`));
      });
    });
  });

  setInterval(updateCountdowns, 5000);
  updateCountdowns();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('theme') === 'light') {
    document.body.classList.add('light-mode');
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