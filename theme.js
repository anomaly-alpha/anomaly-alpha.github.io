// ===== THEME =====
// Loaded synchronously in <head> so the stored preference applies before first
// paint. Applies the class to <html> (every light-mode rule in styles.css is
// scoped to :root.light-mode) and injects the toggle control.
(function () {
  'use strict';

  var KEY = 'gem_theme';
  var LIGHT_CLASS = 'light-mode';
  var root = document.documentElement;

  function storedTheme() {
    try {
      var value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function savedTheme() {
    try {
      localStorage.setItem(KEY, current());
    } catch (error) {}
  }

  function urlTheme() {
    var match = /[?&]theme=(light|dark)(?:&|$)/.exec(window.location.search);
    return match ? match[1] : null;
  }

  function current() {
    return root.classList.contains(LIGHT_CLASS) ? 'light' : 'dark';
  }

  function themeColorMeta() {
    return document.querySelector('meta[name="theme-color"]');
  }

  function applyCharts() {
    if (typeof window.Chart === 'undefined') return;
    var light = current() === 'light';
    var tick = light ? 'rgba(26,32,44,.72)' : 'rgba(255,255,255,.72)';
    var grid = light ? 'rgba(26,32,44,.12)' : 'rgba(255,255,255,.10)';
    Array.prototype.forEach.call(document.querySelectorAll('canvas'), function (canvas) {
      var chart = window.Chart.getChart(canvas);
      if (!chart) return;
      var options = chart.options;
      Object.keys(options.scales || {}).forEach(function (key) {
        var scale = options.scales[key];
        if (!scale) return;
        if (scale.ticks) scale.ticks.color = tick;
        if (scale.grid) scale.grid.color = grid;
        if (scale.angleLines) scale.angleLines.color = grid;
        if (scale.pointLabels) scale.pointLabels.color = tick;
      });
      var legendLabels = options.plugins && options.plugins.legend && options.plugins.legend.labels;
      if (legendLabels) legendLabels.color = tick;
      chart.update('none');
    });
  }

  function syncControls() {
    var light = current() === 'light';
    var label = light ? 'Switch to dark theme' : 'Switch to light theme';
    Array.prototype.forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (button) {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', light ? 'true' : 'false');
    });
  }

  function apply(theme) {
    var light = theme === 'light';
    root.classList.toggle(LIGHT_CLASS, light);
    var meta = themeColorMeta();
    if (meta) meta.setAttribute('content', light ? '#f0f4f8' : '#050a14');
    syncControls();
    applyCharts();
  }

  function toggle() {
    apply(current() === 'light' ? 'dark' : 'light');
    savedTheme();
  }

  function controlMarkup() {
    var sun = '<svg class="gem-theme-toggle__sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L384 96l82.9 12.9c5.2 1 9.7 4.6 11.8 9.6s1.7 10.6-1 15.1l-47.6 63.4 47.6 63.5c2.7 4.5 3.1 10.1 1 15.1s-6.6 8.6-11.8 9.6L384 288l-12.9 82.9c-1 5.2-4.6 9.7-9.6 11.8s-10.6 1.7-15.1-1L280 334l-66.4 47.7c-4.5 2.7-10.1 3.1-15.1 1s-8.6-6.6-9.6-11.8L176 288l-82.9-12.9c-5.2-1-9.7-4.6-11.8-9.6s-1.7-10.6 1-15.1l47.6-63.5-47.6-63.4c-2.7-4.5-3.1-10.1-1-15.1s6.6-8.6 11.8-9.6L176 96l12.9-82.9c1-5.2 4.6-9.7 9.6-11.8s10.6-1.7 15.1 1L280 50l66.4-47.7c4.5-2.7 10.1-3.4 15.1-1.3zM280 138.7a117.3 117.3 0 1 0 0 234.6 117.3 117.3 0 1 0 0-234.6z"/></svg>';
    var moon = '<svg class="gem-theme-toggle__moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"/></svg>';
    return sun + moon;
  }

  function injectControl() {
    if (document.querySelector('[data-theme-toggle]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'gem-theme-toggle';
    button.setAttribute('data-theme-toggle', '');
    button.innerHTML = controlMarkup();
    button.addEventListener('click', toggle);
    document.body.appendChild(button);
    syncControls();
  }

  function ready(onReady) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
    else onReady();
  }

  // Charts are created lazily by script.js, so recolour them once they exist
  // rather than only when the theme changes afterwards.
  function syncChartsSoon() {
    var tries = 0;
    (function attempt() {
      applyCharts();
      var missing = typeof window.Chart === 'undefined' || Array.prototype.some.call(
        document.querySelectorAll('canvas'),
        function (canvas) { return !window.Chart.getChart(canvas); }
      );
      if (missing && ++tries < 24) window.setTimeout(attempt, 250);
    })();
  }

  apply(urlTheme() || storedTheme() || 'dark');

  window.addEventListener('storage', function (event) {
    if (event.key === KEY && (event.newValue === 'light' || event.newValue === 'dark')) apply(event.newValue);
  });

  ready(function () {
    injectControl();
    // <meta name="theme-color"> and the toggle are parsed after this script runs,
    // so re-apply once the document exists to sync both.
    apply(current());
    var chartsToggle = document.querySelector('.gem-charts-toggle');
    if (chartsToggle) chartsToggle.addEventListener('click', syncChartsSoon);
    syncChartsSoon();
  });
})();
