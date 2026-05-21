# Plan 82: Dangerous JS Audit

**Problem:** `script.js` uses `innerHTML` in multiple places, which is a potential XSS vector if any config data comes from user input. While current data is inline JSON, future changes could introduce unsafe patterns.

**Goal:** Audit all `innerHTML` usage and replace with safer alternatives where possible.

---

## Step 1: Audit innerHTML usage

```bash
grep -n 'innerHTML' script.js
```

## Step 2: Create safe HTML builder

```javascript
// script.js — add helper
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function safeHtml(tag, attrs, content) {
  var attrStr = Object.keys(attrs).map(function(key) {
    return key + '="' + escapeHtml(attrs[key]) + '"';
  }).join(' ');
  return '<' + tag + ' ' + attrStr + '>' + content + '</' + tag + '>';
}
```

## Step 3: Replace innerHTML with textContent where possible

```javascript
// Before
el.innerHTML = value;

// After (when value is plain text)
el.textContent = value;

// After (when value is HTML from trusted config)
// Keep innerHTML but add comment noting it's trusted
el.innerHTML = /* trusted config data */ htmlString;
```

## Files Modified
- `script.js` — escapeHtml helper, innerHTML audit

## Verification
```bash
npm run build
# grep for remaining innerHTML — all should be with trusted data
```
