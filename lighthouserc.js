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
        // CLS is the one stable metric (0 on 6 of 7 runs), so it stays strict: the single
        // 0.194 reading came from the same slow-mode outlier above and is worth seeing.
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
