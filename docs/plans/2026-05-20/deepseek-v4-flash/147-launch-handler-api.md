# Plan 147: Launch Handler API for PWA

**Gap:** When a user opens a PWA that's already running, the default behavior varies by OS. The Launch Handler API (`launch_handler` in manifest) lets you control whether the app focuses the existing window, navigates it, or opens a new one.

**Best practice (web.dev):** Use `"launch_handler": {"client_mode": "focus-existing"}` to prevent duplicate windows when launching from home screen.

---

## Step 1: Add launch_handler to manifest

```json
{
  "launch_handler": {
    "client_mode": "focus-existing"
  }
}
```

---

## Step 2: Add to manifest.json

Insert into the existing `manifest.json`:

```json
{
  "name": "Gem Rewards Calculator",
  "launch_handler": {
    "client_mode": "focus-existing"
  }
}
```

---

## Step 3: Handle launch queue (JS)

```js
if ('launchQueue' in window) {
  launchQueue.setConsumer(function (launchParams) {
    // Handle navigation on launch
    if (launchParams.targetURL) {
      var url = new URL(launchParams.targetURL);
      // Apply any URL params (PvP settings, etc.)
      restoreUrlState();
    }
  });
}
```

---

## Step 4: Test PWA launch behavior

```bash
# Install PWA
# Open PWA
# Click home screen icon again
# Expected: focuses existing window (no duplicate)
# Open PWA from a shared URL → URL params are restored via launchQueue
```

---

## Files Modified: `manifest.json`, `script.js`
