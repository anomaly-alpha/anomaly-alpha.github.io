# Plan 45: Gem Income Share Image

**Problem:** Users want to share their gem income breakdown on social media or Discord, but there's no easy way to generate a shareable image.

**Goal:** Add a "Share" button that generates a canvas-based image of the income breakdown for downloading/sharing.

---

## Step 1: Add share button

```html
<!-- index.html -->
<button class="gem-btn" onclick="generateShareImage()">
  <svg>...</svg> Share Income
</button>
```

## Step 2: Generate share image

```javascript
// script.js
function generateShareImage() {
  var canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  var ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, 1200, 630);

  // Title
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 48px Rajdhani, sans-serif';
  ctx.fillText('Weekly Gem Income', 60, 80);

  // Total
  var total = calculateGrandTotal();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Rajdhani, sans-serif';
  ctx.fillText(total.toLocaleString() + ' gems/week', 60, 160);

  // Categories
  var categories = [
    { name: 'Events', value: calculateCategoryTotal('event'), color: '#ff6b35' },
    { name: 'PvP', value: calculateCategoryTotal('pvp'), color: '#e91e8a' },
    { name: 'Login', value: calculateCategoryTotal('login'), color: '#f39c12' },
    { name: 'Code', value: calculateCategoryTotal('code'), color: '#2ecc71' }
  ];

  var y = 240;
  categories.forEach(function(cat) {
    ctx.fillStyle = cat.color;
    ctx.fillRect(60, y, (cat.value / total) * 1000, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Rajdhani, sans-serif';
    ctx.fillText(cat.name + ': ' + cat.value.toLocaleString(), 60, y + 30);
    y += 60;
  });

  // Download
  canvas.toBlob(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gem-income.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}
```

## Files Modified
- `index.html` — share button
- `script.js` — generateShareImage function

## Verification
```bash
npm run build
# Click Share Income — should download PNG
# Open image — should show income breakdown
```
