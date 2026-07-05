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
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 1 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-reports/ci',
    },
  },
};
