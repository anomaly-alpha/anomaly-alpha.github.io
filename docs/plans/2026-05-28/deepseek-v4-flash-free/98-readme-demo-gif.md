# Plan 98: README Interactive Demo GIF

**Problem:** The README describes features in text. Users must visit the live site to understand the calculator. An animated GIF showing the core interaction would increase engagement and reduce bounce rate from GitHub visitors.

**Goal:** Create an animated demo GIF showing the key interaction: changing PvP league/rank and watching the gem counter animate.

---

## Step 1: Record a screen capture

```bash
# Using FFmpeg (or any screen recorder):
ffmpeg -f avfoundation -i 1 -t 10 -r 10 output.mp4

# Or use a dedicated GIF tool like:
# - Kap (macOS)
# - ScreenToGif (Windows)
# - Peek (Linux)
```

---

## Step 2: Convert to GIF

```bash
# From MP4 to GIF:
ffmpeg -i output.mp4 -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 output.gif
```

---

## Step 3: Optimize GIF size

```bash
# Using gifsicle:
gifsicle -O3 --colors 64 --lossy=80 -o demo-optimized.gif output.gif
# Target: <500 KB for a 10-second demo
```

---

## Step 4: Add to README

```md
## Demo

![Gem Rewards Calculator Demo](demo/demo.gif)
```

---

## Step 5: Create `demo/` directory

```bash
mkdir -p demo
mv demo-optimized.gif demo/demo.gif
```

---

## Step 6: What to record

The GIF should show:
1. Loading the page (0-1s)
2. Clicking a PvP league selector (1-3s)
3. Changing the rank (3-5s)
4. Watching the total gem counter animate up (5-7s)
5. Toggling a mode filter (7-9s)

---

## Step 7: Add alt text for accessibility

```md
![Demo of the Gem Rewards Calculator showing PvP league selection, rank change, animated counter, and mode filtering](demo/demo.gif)
```

---

## Files Created: `demo/demo.gif`, `demo/` directory
