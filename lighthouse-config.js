module.exports = {
  extends: 'lighthouse:default',
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
      disabled: false,
    },
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  },
};
