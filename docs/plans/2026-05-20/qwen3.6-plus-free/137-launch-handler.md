# Plan 137: Launch Handler

**Problem:** When the PWA is launched with a URL (e.g., shared link), it always opens the default view. The Launch Handler API can control how the app handles launch URLs.

**Goal:** Configure launch handler to navigate to the correct view based on URL parameters.

---

## Step 1: Add launch handler to manifest

```json
{
  "launch_handler": {
    "client_mode": "navigate-existing"
  }
}
```

## Step 2: Handle launch URL parameters

```javascript
// script.js — already handles URL params on load
// The existing loadPageState() reads ?theme=&mode=&chart=
// This works with launch_handler to restore state
```

## Step 3: Add share target for receiving shared data

```json
{
  "share_target": {
    "action": "/?shared=true",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

## Files Modified
- `manifest.json` — launch_handler + share_target

## Verification
```bash
# Install as PWA
# Share a link to the PWA — should open in existing tab
# URL params should be applied
```
