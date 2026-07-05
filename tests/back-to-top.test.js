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
