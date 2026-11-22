// Music banner collapse state. The banner markup and its Spotify link are written
// into every page at build time, so the link works with JavaScript disabled; this
// file only restores and persists the collapsed preference.
(function () {
  var KEY = 'gem_music_banner';
  var banner = document.getElementById('musicBanner');
  var toggle = document.getElementById('musicBannerToggle');
  var trigger = document.getElementById('musicBannerTrigger');
  if (!banner || !toggle || !trigger) return;

  function setCollapsed(collapsed, persist) {
    banner.classList.toggle('gem-music-banner--minimized', collapsed);
    trigger.hidden = !collapsed;
    toggle.textContent = collapsed ? '+' : '\u2212';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expand music banner' : 'Minimize music banner');
    if (persist) {
      try { localStorage.setItem(KEY, collapsed ? 'collapsed' : 'expanded'); } catch (e) {}
    }
  }

  toggle.addEventListener('click', function () {
    setCollapsed(!banner.classList.contains('gem-music-banner--minimized'), true);
  });
  trigger.addEventListener('click', function () {
    setCollapsed(false, true);
  });

  try {
    if (localStorage.getItem(KEY) === 'collapsed') setCollapsed(true, false);
  } catch (e) {}
})();
