# Plan 13: Deduplicate Contributor Data

**Problem:** Contributor names and colors appear in THREE places: the `contributors-config` inline JSON (rendered directly into HTML), the `author` array in the JSON-LD structured data, and the `meta` tags. If a contributor changes their name or color, all three places must be manually kept in sync.

**Goal:** Single source of truth for contributor data. Render JSON-LD from the same config that drives HTML, eliminating sync drift.

---

## Step 1: Refactor contributors-config to be the single source
Keep `contributors-config` as the canonical source. Refactor the HTML template and JSON-LD to both read from it.

In `index.html`, find the section that renders contributors into HTML. It likely looks like:

```html
<!-- Something like: -->
<div class="contributors">
  <span style="color: #00e5ff">Anomaly</span>
  <span style="color: #e91e8a">TheOneTruePanda</span>
  ...
</div>
```

Replace with a render function that reads `contributors-config`:

```javascript
function renderContributors() {
  var config = loadConfig('contributors-config');
  var container = document.querySelector('.contributors');
  if (!container || !config.contributors) return;
  container.innerHTML = config.contributors.map(function(c) {
    return '<span style="color:' + c.color + '">' + c.name + '</span>';
  }).join('');
}
```

## Step 2: Update JSON-LD to use the same config
Find the JSON-LD script in the HTML that has hardcoded author entries. Update it to generate from config:

```javascript
// In a script that runs after loadAllConfigs():
function updateJsonLdContributors() {
  var config = loadConfig('contributors-config');
  var jsonLd = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  var graph = jsonLd['@graph'];
  var webpage = graph.find(function(g) { return g['@type'] === 'WebPage'; });
  if (webpage && config.contributors) {
    webpage.author = config.contributors.map(function(c) {
      return { '@type': 'Person', 'name': c.name };
    });
  }
  document.querySelector('script[type="application/ld+json"]').textContent = JSON.stringify(jsonLd);
}
```

## Step 3: Update meta tags
If any `<meta>` tags reference contributor names (e.g., `author` meta), update those too.

## Files Modified
- `index.html` — refactor contributor rendering to read from config
- `script.js` — add renderContributors() function

## Verification
```bash
# Change a contributor name in contributors-config
# Reload page — HTML, JSON-LD, and meta tags all reflect the change
```