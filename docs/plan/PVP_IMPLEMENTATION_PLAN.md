# PvP League Rewards Card Implementation Plan

> **Note:** The current system uses per-league payout tables (see `data/arena_payouts.txt` and `data/multiverse_war_payouts.txt`) instead of a multiplier system. Each league has its own bracket-based rewards — no multipliers applied to a base tier.

## Status: ✅ IMPLEMENTED

**Date Completed:** May 1, 2026

---

## Overview
Replace 3 static season cards (lines 491-555 in gem_infographic.html) with 3 interactive PvP cards. Each card represents one PvP type with internal league and rank selectors. Selection persists via localStorage with a clear button to reset.

---

## Additional Changes Made During Implementation

During the May 1 session, the following additional changes were made to the infographic:

1. **Removed Season category** - Season filter and cards entirely removed
2. **Merged Warfare into PvP** - Warfare (Multiverse Alliance War) is now part of PvP cards
3. **Removed Gem Calculator** - Removed the calculator section and its JavaScript
4. **Removed legend, summary boxes** - Removed visual elements that were replaced by unified mode cards
5. **Unified mode cards at top** - Each mode (All, Event, PvP, Daily, Code) now has a large clickable card with total + countdown timer
6. **Charts unified with mode filter** - Charts update based on main mode selection, removed separate chart filters

---

## HTML Structure Fixes (Post-Implementation)

On May 1, several HTML structural issues were discovered and fixed:

### Issues Fixed
1. **PvP card closing tags** - Changed `</div>` to `</article>` for all 3 PvP cards (lines 452, 508, 564)
2. **Main container closing** - Removed premature `</div>` at line 681 that was closing the main container early
3. **Missing `</main>`** - Added closing `</main>` tag before charts section (line 682)
4. **Missing main container close** - Added closing `</div>` at end of file (line 1724)
5. **Nav closing tag** - Changed `</div>` to `</nav>` at line 391 for proper tag matching
6. **JavaScript value fixes**:
   - `totalGems`: Changed from 3217 to 2550 (line 1650)
   - `baseStatic`: Changed from 2650 to 1900 (line 1673)
   - `chartFilterData.all.distribution`: Changed from [1820, 500, 750, 1100, 300] to [0, 500, 750, 1100, 300] (line 1466)

### HTML Tag Verification (Final)
- `<article>`: 3 open, 3 close ✅
- `<main>`: 1 open, 1 close ✅
- `<nav>`: 1 open, 1 close ✅
- Main container: Opens line 323, closes line 1722 ✅
- All sections (cards, charts, search, contributors) inside main container ✅

---

## Cards to Replace

| Card # | PvP Type | Default League | Default Rank | Icon | Border Color |
|--------|----------|----------------|--------------|------|---------------|
| 1 | Restricted Arena | Elite I | 50 | fa-user-lock | purple-accent |
| 2 | Open Arena | Elite III | 50 | fa-fist-raised | cyan-glow |
| 3 | Multiverse Alliance War | Elite II | 50 | fa-globe | pink-glow |

---

## HTML Structure - Replace Lines 491-555

```html
<!-- PvP Card 1: Restricted Arena -->
<div class="card-hover relative bg-purple-accent/8 p-6 rounded-xl border border-purple-accent/20 overflow-hidden cursor-pointer group card-fade-in tooltip-trigger" style="animation-delay: 0s;" data-category="pvp">
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-accent to-transparent opacity-50"></div>
    <div class="absolute top-5 right-8 w-1 h-1 bg-white rounded-full sparkle" style="animation-delay: 0s;"></div>
    <div class="absolute top-5 right-10 w-1 h-1 bg-purple-accent rounded-full sparkle" style="animation-delay: 0.3s;"></div>
    <div class="w-[50px] h-[50px] bg-gradient-to-br from-pink-glow to-pink-glow rotate-45 mb-4 relative shadow-[0_0_20px_rgba(233,30,138,0.5)]">
        <div class="gem-icon absolute inset-0"></div>
    </div>
    <h3 class="text-white text-2xl font-bold uppercase tracking-wider mb-2">Restricted Arena</h3>
    <div class="inline-flex items-center gap-2 bg-purple-accent/15 px-4 py-1 rounded-full text-xs uppercase tracking-wider text-purple-accent border border-purple-accent/30 mb-4">
        <span>Player vs Player</span>
    </div>
    
    <!-- League Selector -->
    <div class="flex items-center gap-2 mb-3">
        <label class="text-white/60 text-xs">League:</label>
        <select id="pvp1-league" onchange="updatePvpCard(1)" class="bg-white/10 border border-purple-accent/30 rounded px-2 py-1 text-white text-sm cursor-pointer">
            <option value="eliteI">Elite I</option>
            <option value="eliteII">Elite II</option>
            <option value="eliteIII">Elite III</option>
            <option value="invincible">Invincible</option>
        </select>
    </div>
    
    <!-- Rank Selector with Clear Button -->
    <div class="flex items-center gap-2 mb-4">
        <label class="text-white/60 text-xs">Rank:</label>
        <select id="pvp1-rank" onchange="updatePvpCard(1)" class="bg-white/10 border border-purple-accent/30 rounded px-2 py-1 text-white text-sm w-20 cursor-pointer">
            <!-- Options 1-120 generated by JS -->
        </select>
        <button onclick="clearPvpSelection(1)" class="text-white/40 hover:text-white/80 text-xs p-1" title="Reset to default">
            <i class="fas fa-times-circle"></i>
        </button>
    </div>
    
    <div class="border-t border-white/10 my-3"></div>
    
    <p class="text-4xl font-bold text-white mb-1 drop-shadow-[0_0_20px_rgba(0,229,255,0.5)]">
        <span id="pvp1-gems">0</span> <span class="text-lg text-white/60 font-semibold">GEMS</span>
    </p>
    
    <div class="flex gap-4 text-sm text-white/60 mb-2">
        <span><i class="fas fa-layer-group text-purple-accent"></i> <span id="pvp1-cards">0</span> Cards</span>
        <span><i class="fas fa-coins text-yellow-accent"></i> <span id="pvp1-chips">0</span> Chips</span>
    </div>
    
    <div class="inline-flex items-center gap-1 bg-purple-accent/15 px-3 py-1 rounded-full text-xs text-purple-accent border border-purple-accent/30 mb-3">
        <i class="fas fa-clock"></i> Weekly
    </div>
    
    <div id="pvp1-demotion" class="hidden bg-red-500/20 border border-red-500/50 rounded-lg p-2 text-center mb-2">
        <i class="fas fa-exclamation-triangle text-red-400 mr-1"></i>
        <span class="text-red-400 text-xs font-bold">DEMOTION ZONE</span>
    </div>
    
    <span class="inline-block bg-purple-accent/10 text-purple-accent text-xs px-2 py-1 rounded border border-purple-accent/30">
        <span id="pvp1-percent">0%</span> of total
    </span>
</div>

<!-- PvP Card 2: Open Arena (copy structure, change IDs and colors to cyan-glow) -->

<!-- PvP Card 3: Multiverse Alliance War (copy structure, change IDs and colors to pink-glow) -->
```

---

## JavaScript - Add to Script Section

```javascript
// PvP League Data - Easy to Update
const pvpLeagueData = {
    // Elite III - Base (100%) - From user data
    eliteIII: {
        tiers: [
            { min: 1, max: 1, gems: 710, cards: 4, chips: 1000 },
            { min: 2, max: 2, gems: 670, cards: 3, chips: 900 },
            { min: 3, max: 3, gems: 640, cards: 2, chips: 800 },
            { min: 4, max: 10, gems: 600, cards: 1, chips: 600 },
            { min: 11, max: 30, gems: 560, cards: 1, chips: 600 },
            { min: 31, max: 60, gems: 520, cards: 1, chips: 600 },
            { min: 61, max: 120, gems: 490, cards: 1, chips: 500 }
        ]
    },
    // Elite II - 85% of Elite III
    eliteII: {
        modifier: 0.85,
        baseTiers: 'eliteIII'
    },
    // Elite I - 70% of Elite III
    eliteI: {
        modifier: 0.70,
        baseTiers: 'eliteIII'
    },
    // Invincible - 125% of Elite III (25% better)
    invincible: {
        modifier: 1.25,
        baseTiers: 'eliteIII'
    }
};

// PvP Type Configuration
const pvpTypes = {
    1: { name: "Restricted Arena", icon: "fa-user-lock", frequency: "Weekly", color: "purple-accent", colorClass: "bg-purple-accent", borderClass: "border-purple-accent", defaultLeague: "eliteI" },
    2: { name: "Open Arena", icon: "fa-fist-raised", frequency: "Weekly", color: "cyan-glow", colorClass: "bg-cyan-glow", borderClass: "border-cyan-glow", defaultLeague: "eliteIII" },
    3: { name: "Multiverse Alliance War", icon: "fa-globe", frequency: "5 matches / 2 weeks", color: "pink-glow", colorClass: "bg-pink-glow", borderClass: "border-pink-glow", defaultLeague: "eliteII" }
};

// Generate rank options 1-120
function generateRankOptions(selectId) {
    const select = document.getElementById(selectId);
    for (let i = 1; i <= 120; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        select.appendChild(option);
    }
}

// Get payout for given league and rank
function getPvpPayout(leagueKey, rank) {
    const league = pvpLeagueData[leagueKey];
    const baseKey = league.baseTiers || leagueKey;
    const tiers = pvpLeagueData[baseKey].tiers;
    
    const tier = tiers.find(t => rank >= t.min && rank <= t.max);
    const modifier = league.modifier || 1;
    
    return {
        gems: Math.round(tier.gems * modifier),
        cards: tier.cards,
        chips: Math.round(tier.chips * modifier),
        isDemotion: rank >= 86
    };
}

// Animate value change
function animateValue(elementId, newValue, duration = 400) {
    const el = document.getElementById(elementId);
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

// Update single PvP card
function updatePvpCard(cardId) {
    const league = document.getElementById(`pvp${cardId}-league`).value;
    const rank = parseInt(document.getElementById(`pvp${cardId}-rank`).value);
    
    const payout = getPvpPayout(league, rank);
    const type = pvpTypes[cardId];
    
    // Animate value changes
    animateValue(`pvp${cardId}-gems`, payout.gems);
    animateValue(`pvp${cardId}-cards`, payout.cards);
    animateValue(`pvp${cardId}-chips`, payout.chips);
    
    // Update percentage (2550 = current total)
    const totalGems = 2550;
    const percent = ((payout.gems / totalGems) * 100).toFixed(1);
    document.getElementById(`pvp${cardId}-percent`).textContent = percent + '%';
    
    // Show/hide demotion warning
    const demotionEl = document.getElementById(`pvp${cardId}-demotion`);
    if (payout.isDemotion) {
        demotionEl.classList.remove('hidden');
    } else {
        demotionEl.classList.add('hidden');
    }
    
    // Save to localStorage
    savePvpSelection(cardId);
}

// Save selection to localStorage
function savePvpSelection(cardId) {
    const league = document.getElementById(`pvp${cardId}-league`).value;
    const rank = document.getElementById(`pvp${cardId}-rank`).value;
    localStorage.setItem(`pvp${cardId}_league`, league);
    localStorage.setItem(`pvp${cardId}_rank`, rank);
}

// Load selection from localStorage
function loadPvpSelection(cardId) {
    const savedLeague = localStorage.getItem(`pvp${cardId}_league`);
    const savedRank = localStorage.getItem(`pvp${cardId}_rank`);
    
    if (savedLeague) {
        document.getElementById(`pvp${cardId}-league`).value = savedLeague;
    }
    if (savedRank) {
        document.getElementById(`pvp${cardId}-rank`).value = savedRank;
    }
    
    updatePvpCard(cardId);
}

// Clear selection - reset to defaults
function clearPvpSelection(cardId) {
    const defaults = { 1: { league: 'eliteI' }, 2: { league: 'eliteIII' }, 3: { league: 'eliteII' } };
    const defaultRank = 50;
    
    document.getElementById(`pvp${cardId}-league`).value = defaults[cardId].league;
    document.getElementById(`pvp${cardId}-rank`).value = defaultRank;
    
    localStorage.removeItem(`pvp${cardId}_league`);
    localStorage.removeItem(`pvp${cardId}_rank`);
    
    updatePvpCard(cardId);
}

// Initialize all PvP cards on page load
function initializePvPCards() {
    // Generate rank options
    generateRankOptions('pvp1-rank');
    generateRankOptions('pvp2-rank');
    generateRankOptions('pvp3-rank');
    
    // Load saved or use defaults
    loadPvpSelection(1);
    loadPvpSelection(2);
    loadPvpSelection(3);
}

// Run initialization
initializePvPCards();

// Update main total when PvP values change
function updateTotalGems() {
    let total = 0;
    // Sum current PvP card values
    for (let i = 1; i <= 3; i++) {
        const gemsText = document.getElementById(`pvp${i}-gems`).textContent;
        total += parseInt(gemsText.replace(/,/g, '')) || 0;
    }
    // Add static amounts (Event: 500, Daily: 1100, Code: 300 = 1900)
    const baseStatic = 1900;
    const newTotal = baseStatic + total;
    animateValue('totalCounter', newTotal, 400);
}
```

---

## Implementation Steps

1. **Replace HTML Cards (lines 491-555)**
   - Remove 3 static season cards
   - Insert 3 new PvP cards with selectors

2. **Add JavaScript Data Structure**
   - Insert `pvpLeagueData` object
   - Insert `pvpTypes` configuration

3. **Add JavaScript Functions**
   - generateRankOptions()
   - getPvpPayout()
   - animateValue()
   - updatePvpCard()
   - savePvpSelection()
   - loadPvpSelection()
   - clearPvpSelection()
   - initializePvPCards()

4. **Test**
   - Verify selectors work
   - Verify animations trigger
   - Verify localStorage saves/loads
   - Verify clear button resets

---

## Quick Reference

| Card | PvP Type | Default League | Default Rank | Color |
|------|----------|----------------|---------------|-------|
| 1 | Restricted Arena | Elite I | 50 | purple-accent |
| 2 | Open Arena | Elite III | 50 | cyan-glow |
| 3 | Multiverse Alliance War | Elite II | 50 | pink-glow |

**Demotion Zone:** Rank 86+
**Max Rank:** 120
**Modifier Values:** Elite I = 70%, Elite II = 85%, Elite III = 100%, Invincible = 125%