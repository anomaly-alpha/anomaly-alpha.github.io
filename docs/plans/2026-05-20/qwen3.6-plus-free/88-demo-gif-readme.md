# Plan 88: Demo GIF for README

**Problem:** The README has no visual demonstration of the calculator. Potential users can't see what the tool does without visiting the site.

**Goal:** Create a short animated GIF showing the calculator in action for the README.

---

## Step 1: Record demo

Use a screen recording tool to capture:
1. Page load with dark theme
2. Mode toggle (click Event, then PvP)
3. PvP league change
4. Counter animation
5. Chart display
6. Theme toggle to light mode

Duration: ~15 seconds.

## Step 2: Optimize GIF

```bash
# Using ffmpeg
ffmpeg -i demo.mp4 -vf "scale=800:-1:flags=lanczos" -r 10 demo.gif

# Using gifsicle to optimize
gifsicle -O3 --colors 128 demo.gif -o demo-optimized.gif
```

## Step 3: Add to README

```markdown
## Demo

![Gem Rewards Calculator Demo](docs/demo.gif)

*Interactive gem income calculator with mode filtering, PvP league selection, and charts.*
```

## Files Modified
- `docs/demo.gif` — new file
- `README.md` — demo image

## Verification
```bash
# GIF should be < 2MB
# Should render in GitHub README
```
