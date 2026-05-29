# Plan 37: Configurable Reset Time / Timezone

**Problem:** Countdown timers are hardcoded to a specific timezone (likely EST). Players in different timezones see incorrect countdown values. The reset times (weekly Sunday 20:00, daily 20:00) assume a single timezone.

**Goal:** Auto-detect the user's timezone and adjust countdowns accordingly. Allow manual timezone override. Persist the choice.

---

## Step 1: Detect user timezone

```js
// ===== TIMEZONE HANDLING =====

function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getTimezoneOffset() {
  // Return offset in hours from UTC
  return -new Date().getTimezoneOffset() / 60;
}
```

---

## Step 2: Add timezone display

**In `index.html`** (near the countdown section):

```html
<div class="gem-timezone text-xs gem-text--muted mt-1">
  <span>Reset timezone: </span>
  <select id="timezone-select" onchange="changeTimezone(this.value)" class="gem-select gem-select--cyan text-xs"
          aria-label="Select timezone">
  </select>
  <span class="ml-1 gem-text--cyan" id="timezone-detected"></span>
</div>
```

---

## Step 3: Populate timezone options

```js
function populateTimezoneOptions() {
  var select = document.getElementById('timezone-select');
  if (!select) return;

  var common = [
    { label: 'UTC-5 (Eastern)', value: 'America/New_York' },
    { label: 'UTC-6 (Central)', value: 'America/Chicago' },
    { label: 'UTC-7 (Mountain)', value: 'America/Denver' },
    { label: 'UTC-8 (Pacific)', value: 'America/Los_Angeles' },
    { label: 'UTC+0 (UK/UTC)', value: 'Europe/London' },
    { label: 'UTC+1 (CET)', value: 'Europe/Paris' },
    { label: 'UTC+8 (China)', value: 'Asia/Shanghai' },
    { label: 'UTC+9 (Japan)', value: 'Asia/Tokyo' },
    { label: 'UTC+10 (Sydney)', value: 'Australia/Sydney' }
  ];

  // Add detected timezone if not in list
  var detected = getUserTimezone();
  if (!common.some(function (t) { return t.value === detected; })) {
    common.push({ label: detected, value: detected });
  }

  select.innerHTML = common.map(function (tz) {
    var selected = tz.value === detected ? 'selected' : '';
    return '<option value="' + tz.value + '" ' + selected + '>' + tz.label + '</option>';
  }).join('');

  document.getElementById('timezone-detected').textContent = '(detected: ' + detected + ')';
}
```

---

## Step 4: Update countdown calculation

Modify the existing countdown update logic to use the selected timezone:

```js
function getResetTimeInTimezone(tz) {
  // Convert the base reset time to the selected timezone
  var weeklyReset = new Date();
  // ... existing logic but apply timezone offset ...
  // For simplicity, use UTC + selected offset
  var tzOffset = getTimezoneOffsetForTZ(tz);
  return weeklyReset;
}

function getTimezoneOffsetForTZ(tz) {
  try {
    var date = new Date();
    var utc = date.getTime() + date.getTimezoneOffset() * 60000;
    var tzDate = new Date(utc + (3600000 * getOffsetForTimezone(tz)));
    return tzDate;
  } catch (e) {
    return date;
  }
}

function getOffsetForTimezone(tz) {
  // Simplified: map common timezones to UTC offsets
  var offsets = {
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Asia/Shanghai': 8,
    'Asia/Tokyo': 9,
    'Australia/Sydney': 10
  };
  return offsets[tz] || getTimezoneOffset();
}

function changeTimezone(tz) {
  localStorage.setItem('gem_timezone', tz);
  // Trigger countdown refresh
  updateCountdowns();
}
```

---

## Step 5: Load saved timezone

```js
function loadTimezonePreference() {
  var saved = localStorage.getItem('gem_timezone');
  if (saved) {
    var select = document.getElementById('timezone-select');
    if (select) select.value = saved;
  }
}
```

Add to `DOMContentLoaded`.

---

## Step 6: Update countdown display logic

Where countdowns are rendered, pass the selected timezone offset:

```js
function updateCountdowns() {
  var tz = document.getElementById('timezone-select')?.value || getUserTimezone();
  // ... use tz for all countdown calculations ...
}
```

---

## Step 7: Show the date in the selected timezone

```html
<span class="gem-text--cyan text-xs" id="reset-date-label"></span>
```

```js
function formatResetDate(date, tz) {
  try {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: tz,
      timeZoneName: 'short'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return date.toString();
  }
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add timezone selector |
| `script.js` | Add timezone functions, update countdown logic |

---

## Verification

```bash
# Open in Chrome
# Check detected timezone matches system
# Change timezone to "Asia/Tokyo"
# Verify countdown adjusts by correct number of hours
# Refresh page — timezone persists
# Verify reset date label shows correct day/time for selected TZ
```
