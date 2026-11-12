module.exports = {
  ci: {
    collect: {
      url: [
        'https://anomaly-alpha.github.io/',
        'https://anomaly-alpha.github.io/guide/code/',
        'https://anomaly-alpha.github.io/guide/event/',
        'https://anomaly-alpha.github.io/guide/pvp/',
        'https://anomaly-alpha.github.io/guide/login/',
        'https://anomaly-alpha.github.io/guide/faq/',
        'https://anomaly-alpha.github.io/guide/beginners/',
        'https://anomaly-alpha.github.io/guide/xp/',
      ],
      settings: {
        formFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1600,
          cpuSlowdownMultiplier: 4,
        },
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 660,
          deviceScaleFactor: 2.625,
        },
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // Performance thresholds sit outside a measured noise band, not at Core Web Vitals
      // targets. Repeating the audit on bytes that did not change (2026-11-08) swung the
      // same page wildly: pvp scored 77 / 82 / 97 with LCP 3.9 / 3.7 / 1.5 s, and faq
      // 87 / 100 / 99. The cause is one number, the hero <h1>'s element render delay,
      // which moves 188 ms -> 1166 ms between runs with identical ~105 ms TTFB and no
      // render-blocking resources (defer'd script.js + async GA4 compete for the main
      // thread at first paint). A 2500 ms LCP budget therefore fired on unchanged code.
      // These are regression tripwires: lower them only alongside a real fix for that
      // delay, not because a page "should" hit 2.5 s.
      assertions: {
        'categories:performance': ['warn', { minScore: 0.75 }], // measured band 77-100
        'categories:accessibility': ['warn', { minScore: 0.95 }], // measured 100 everywhere
        'categories:seo': ['error', { minScore: 1 }], // measured 100 everywhere
        'categories:best-practices': ['warn', { minScore: 0.9 }], // measured 100 everywhere
        // CLS was never stable, and this budget is what proved it. Across 24 runs of the
        // same bytes it came back bimodal: 0.000 on 22 runs, exactly 1.0000 on 2 (code and
        // login), always blaming the same node, body > div.gem-container. The cause was
        // the FOUC guard: html{visibility:hidden} and html{visibility:visible} sat in one
        // <style> block, so "visible" won immediately and guarded nothing, while both
        // stylesheets arrived async (preload + onload="this.rel='stylesheet'"). Whether
        // they landed before or after first paint was the coin flip. They are render-
        // blocking now, so this stays strict at 0.1: it is the tripwire that catches the
        // pattern being reintroduced, and it should never need the noise-band treatment.
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4500 }], // slow mode max 3.9 s
        'total-blocking-time': ['warn', { maxNumericValue: 500 }], // measured 80-330 ms
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-reports/ci',
    },
  },
};
