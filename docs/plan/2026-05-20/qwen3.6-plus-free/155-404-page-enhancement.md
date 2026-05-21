# Plan 155: 404 Page Enhancement

**Problem:** The 404 page is minimal and doesn't help users find what they're looking for. It should suggest relevant pages and include a search option.

**Goal:** Enhance the 404 page with navigation suggestions and search.

---

## Step 1: Update 404.html

```html
<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Page not found. Return to the Gem Rewards Calculator for Invincible Guarding the Globe.">
  <title>404 — Page Not Found | Gem Rewards Calculator</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/tailwind.css">
</head>
<body>
  <main class="gem-404">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>The page you're looking for doesn't exist or has been moved.</p>

    <nav class="gem-404__links">
      <h3>Popular Pages</h3>
      <a href="/">Calculator</a>
      <a href="/guide/pvp/">PvP Guide</a>
      <a href="/guide/code/">Promo Codes</a>
      <a href="/guide/login/">Login Rewards</a>
      <a href="/guide/faq/">FAQ</a>
    </nav>

    <a href="/" class="gem-btn gem-btn--large">Return to Calculator</a>
  </main>
</body>
</html>
```

## Step 2: Add 404 styles

```css
/* styles.css */
.gem-404 {
  text-align: center;
  padding: 4rem 1rem;
  max-width: 500px;
  margin: 0 auto;
}
.gem-404 h1 {
  font-size: 6rem;
  color: var(--gem-cyan);
  margin: 0;
}
.gem-404__links {
  margin: 2rem 0;
}
.gem-404__links a {
  display: block;
  padding: 0.5rem;
  color: var(--gem-cyan);
  text-decoration: none;
}
.gem-404__links a:hover {
  text-decoration: underline;
}
```

## Files Modified
- `404.html` — enhanced 404 page
- `styles.css` — 404 styles

## Verification
```bash
# Visit /nonexistent-page
# Should show enhanced 404 with navigation links
```
