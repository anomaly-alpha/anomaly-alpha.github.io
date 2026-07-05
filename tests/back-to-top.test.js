// back-to-top.test.js

describe('Button Structure', function() {
  it('should have button element with correct class', function() {
    const btn = document.querySelector('.gem-back-to-top');
    assert_true(btn !== null, 'button should exist');
  });

  it('should be hidden on load', function() {
    const btn = document.querySelector('.gem-back-to-top');
    assert_true(btn.hasAttribute('hidden'), 'button should have hidden attribute');
  });

  it('should have aria-label', function() {
    const btn = document.querySelector('.gem-back-to-top');
    assertEqual(btn.getAttribute('aria-label'), 'Back to top');
  });

  it('should contain arrow SVG', function() {
    const arrow = document.querySelector('.gem-back-to-top__arrow');
    assert_true(arrow !== null, 'arrow SVG should exist');
  });

  it('should contain progress ring SVG', function() {
    const progress = document.querySelector('.gem-back-to-top__progress');
    assert_true(progress !== null, 'progress ring should exist');
  });
});

describe('Button Styling', function() {
  it('should be positioned fixed', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.position, 'fixed');
  });

  it('should be at bottom-right', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.bottom, '2rem');
    assertEqual(style.right, '2rem');
  });

  it('should have opacity 0 when hidden', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.opacity, '0');
  });

  it('should have pointer-events none when hidden', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.pointerEvents, 'none');
  });
});

describe('Scroll Behavior', function() {
  it('should show button when scrollY > 300', function() {
    const btn = document.querySelector('.gem-back-to-top');
    // Ensure hidden state first
    btn.setAttribute('hidden', '');
    btn.classList.remove('gem-back-to-top--visible', 'gem-back-to-top--hiding');

    Object.defineProperty(window, 'scrollY', { value: 400, writable: true, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    assert_true(btn.classList.contains('gem-back-to-top--visible'), 'should have visible class');
    assert_false(btn.hasAttribute('hidden'), 'should remove hidden attribute');
  });

  it('should hide button when scrollY <= 300', function() {
    const btn = document.querySelector('.gem-back-to-top');
    // Ensure visible state first
    btn.removeAttribute('hidden');
    btn.classList.add('gem-back-to-top--visible');
    btn.classList.remove('gem-back-to-top--hiding');

    Object.defineProperty(window, 'scrollY', { value: 100, writable: true, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    assert_true(btn.classList.contains('gem-back-to-top--hiding'), 'should have hiding class');
  });

  it('should update progress ring on scroll', function() {
    const circle = document.querySelector('.gem-back-to-top__progress circle');
    Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    const offset = circle.getAttribute('stroke-dashoffset');
    assert_true(offset !== '100.53', 'progress ring should update');
  });
});

describe('Reduced Motion', function() {
  it('should not add animation classes when reduced motion preferred', function() {
    // Mock matchMedia
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = function() {
      return { matches: true, addEventListener: function() {} };
    };

    const btn = document.querySelector('.gem-back-to-top');
    btn.setAttribute('hidden', '');
    btn.classList.remove('gem-back-to-top--visible', 'gem-back-to-top--hiding');

    Object.defineProperty(window, 'scrollY', { value: 400, writable: true, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    // Should use hidden attribute only, no animation classes
    assert_false(btn.classList.contains('gem-back-to-top--visible'), 'should not add visible class');

    window.matchMedia = originalMatchMedia;
  });
});

describe('Integration', function() {
  it('click should scroll to top', function() {
    const btn = document.querySelector('.gem-back-to-top');
    let scrolledToTop = false;
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function(opts) {
      if (opts && opts.top === 0) scrolledToTop = true;
    };

    btn.click();
    assert_true(scrolledToTop, 'should call scrollTo with top: 0');

    window.scrollTo = originalScrollTo;
  });

  it('should have correct z-index', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.zIndex, '50');
  });

  it('should be circular', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.borderRadius, '50%');
  });
});
