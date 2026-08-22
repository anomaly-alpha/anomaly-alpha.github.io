# Plan 54: Share as Image

**Problem:** Users can't easily share their gem breakdown with alliance members. Links work but are less engaging than an image.

**Goal:** Add "Share as Image" that generates a PNG screenshot of the gem breakdown using the Canvas API.

---

## Step 1: Build the share canvas

```js
function shareAsImage() {
  var canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 500;
  var ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, 600, 500);

  // Border glow
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 580, 480);

  // Title
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 24px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Gem Rewards Summary', 300, 50);

  // Total
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Rajdhani, sans-serif';
  ctx.fillText('Total: ' + getCurrentTotal().toLocaleString() + ' gems/week', 300, 110);

  // Breakdown
  var categories = [
    { name: 'Events', value: getModeTotal('event'), color: '#ff6b35', y: 170 },
    { name: 'PvP', value: getModeTotal('pvp'), color: '#e91e8a', y: 220 },
    { name: 'Login', value: getModeTotal('login'), color: '#f39c12', y: 270 },
    { name: 'Codes', value: getModeTotal('code'), color: '#2ecc71', y: 320 },
  ];

  ctx.font = '18px Rajdhani, sans-serif';
  ctx.textAlign = 'left';

  categories.forEach(function (cat) {
    var pct = getCurrentTotal() > 0 ? Math.round((cat.value / getCurrentTotal()) * 100) : 0;
    ctx.fillStyle = cat.color;
    ctx.fillRect(50, cat.y - 12, Math.min(400, (cat.value / 5000) * 400), 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cat.name, 50, cat.y + 10);
    ctx.textAlign = 'right';
    ctx.fillText(cat.value.toLocaleString() + ' (' + pct + '%)', 550, cat.y + 10);
    ctx.textAlign = 'left';
  });

  // PvP settings
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PvP: ' + getSelectText('pvp1-league') + '/' + getSelectValue('pvp1-rank') +
    ' | ' + getSelectText('pvp2-league') + '/' + getSelectValue('pvp2-rank') +
    ' | ' + getSelectText('pvp3-league') + '/' + getSelectValue('pvp3-rank'), 300, 400);

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '12px Rajdhani, sans-serif';
  ctx.fillText('anomaly-alpha.github.io', 300, 450);

  // Download
  canvas.toBlob(function (blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gem-rewards-' + new Date().toISOString().slice(0, 10) + '.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}
```

---

## Step 2: Add share button

```html
<button class="gem-btn--icon text-xs" onclick="shareAsImage()" title="Share as image">
  <svg ...image icon...></svg> Image
</button>
```

---

## Step 3: Add Font detection fallback

Canvas may not have Rajdhani loaded yet. Fallback to sans-serif:

```js
ctx.font = 'bold 24px Rajdhani, sans-serif';
// If Rajdhani hasn't loaded, the browser falls back to sans-serif
// which is acceptable for the image.
```

---

## Files Modified: `index.html`, `script.js`
