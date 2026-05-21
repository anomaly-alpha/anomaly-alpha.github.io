# Plan 86: Table of Contents for Guide Pages

**Problem:** Guide pages are long-form content without navigation. Users must scroll to find specific sections. There's no way to jump to "payout tables" or "promo codes" within a page.

**Goal:** Add a sticky table of contents (ToC) to each guide page, generated from heading structure.

---

## Step 1: Extract headings

```js
function generateTOC() {
  var headings = document.querySelectorAll('main h2, main h3');
  if (headings.length < 3) return;

  var toc = document.createElement('nav');
  toc.className = 'gem-toc';
  toc.setAttribute('aria-label', 'Table of contents');

  var list = document.createElement('ul');
  list.className = 'gem-toc__list';

  headings.forEach(function (h, i) {
    if (!h.id) h.id = 'section-' + i;
    var li = document.createElement('li');
    li.className = 'gem-toc__item' + (h.tagName === 'H3' ? ' gem-toc__item--sub' : '');
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });

  toc.appendChild(list);
  var main = document.querySelector('main');
  if (main) main.insertBefore(toc, main.firstChild.nextSibling);
}
```

---

## Step 2: Add TOC only on guide pages

Guide pages should already have this function available. Call it on page load:

```js
if (document.querySelector('.gem-guide')) {
  generateTOC();
}
```

---

## Step 3: CSS for TOC

```css
.gem-toc {
  background: rgba(0, 229, 255, 0.03);
  border: 1px solid rgba(0, 229, 255, 0.1);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  position: sticky;
  top: 1rem;
  z-index: 10;
  max-height: 80vh;
  overflow-y: auto;
}
.gem-toc__list { list-style: none; padding: 0; margin: 0; }
.gem-toc__item { font-size: 0.8rem; margin-bottom: 0.25rem; }
.gem-toc__item--sub { padding-left: 1rem; font-size: 0.75rem; }
.gem-toc__item a { color: var(--gem-text--secondary); text-decoration: none; }
.gem-toc__item a:hover { color: var(--gem-cyan); }
```

---

## Step 4: Add scrollspy (highlight current section)

```js
function initScrollspy() {
  var headings = document.querySelectorAll('main h2, main h3');
  var links = document.querySelectorAll('.gem-toc__item a');

  window.addEventListener('scroll', function () {
    var current = '';
    headings.forEach(function (h) {
      if (window.scrollY >= h.offsetTop - 100) {
        current = h.id;
      }
    });
    links.forEach(function (a) {
      a.classList.toggle('gem-toc__item--active', a.getAttribute('href') === '#' + current);
    });
  }, { passive: true });
}
```

---

## Files Modified: `script.js`, `styles.css`, `guide/*/index.html`
