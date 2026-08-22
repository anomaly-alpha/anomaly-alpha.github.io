# Plan 160: Accessibility Statement Page

**Gap:** The site has no accessibility statement. WCAG 2.2 encourages publishing an accessibility statement describing compliance level, known issues, and how to report problems.

**Best practice (W3C):** Create an accessibility statement page with: compliance target (WCAG 2.2 AA), known issues, testing methodology, and contact for accessibility feedback.

---

## Step 1: Create template

**File: `guide/accessibility/index.html`**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="description" content="Accessibility statement for the Gem Rewards Calculator — WCAG 2.2 AA compliance, known issues, and feedback contact.">
  <title>Accessibility — Gem Rewards Calculator</title>
  <!-- same CSS/Tailwind links as other guides -->
</head>
<body>
  <main id="main-content">
    <h1>Accessibility Statement</h1>

    <section>
      <h2>Compliance Status</h2>
      <p>We aim to meet WCAG 2.2 Level AA. Automated testing via axe-core and Lighthouse shows zero critical/serious violations.</p>
    </section>

    <section>
      <h2>Known Limitations</h2>
      <ul>
        <li>Charts (Chart.js) are canvas-based and lack full text representation — a data table is provided as fallback.</li>
        <li>Some icons rely on color to convey category — text labels are also provided.</li>
      </ul>
    </section>

    <section>
      <h2>Testing</h2>
      <p>We test with:</p>
      <ul>
        <li>axe-core automated checks (CI pipeline)</li>
        <li>Lighthouse accessibility audit</li>
        <li>Manual keyboard navigation testing</li>
        <li>Screen reader testing (VoiceOver, NVDA)</li>
      </ul>
    </section>

    <section>
      <h2>Feedback</h2>
      <p>To report accessibility issues, <a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/issues">open a GitHub issue</a> with "a11y" in the title.</p>
    </section>
  </main>
</body>
</html>
```

---

## Step 2: Add to footer

```html
<a href="guide/accessibility/" class="gem-text--muted text-xs hover:gem-text--cyan">Accessibility</a>
```

---

## Step 3: Add to sitemap.xml

```xml
<url>
  <loc>https://anomaly-alpha.github.io/guide/accessibility/</loc>
  <changefreq>monthly</changefreq>
  <priority>0.3</priority>
</url>
```

---

## Files Created: `guide/accessibility/index.html`
