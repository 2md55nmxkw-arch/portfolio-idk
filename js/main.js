// ---------- navbar: mobile dropdown (main page) ----------
(() => {
  const burger = document.querySelector('.nav__burger');
  const menu = document.getElementById('nav-menu');
  if (!burger || !menu) return;

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }

  burger.addEventListener('click', () => {
    setMenu(burger.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setMenu(false);
      burger.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('.nav__burger, .nav__menu')) setMenu(false);
  });

  menu.addEventListener('click', (e) => {
    if (e.target.closest('a, .nav__close')) setMenu(false);
  });
})();

// ---------- sections come alive as they scroll into view ----------
// css/reveal.css holds the choreography; here we only say when a section starts.
(() => {
  const root = document.documentElement;
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const STAGGER = 260; // ms between sections that come into view together

  function start() {
    clearTimeout(window.revealFailsafe); // set in the <head> of pages that hide the pieces before the first paint
    root.classList.add('reveal-ready'); // from now on the animated pieces wait in their starting pose
    const seen = new IntersectionObserver((entries) => {
      // A section starts when a quarter of it is on screen (or it fills a good part of a small screen),
      // or when it was already scrolled past, e.g. the page was reloaded half-way down.
      // Measuring the section itself, not a line on the screen, means the last one can always start.
      const ready = entries.filter((entry) => entry.intersectionRatio >= 0.25
        || (entry.rootBounds && entry.intersectionRect.height >= entry.rootBounds.height * 0.4)
        || entry.boundingClientRect.top < 0);
      // on a phone several sections fit on one screen: start them top to bottom, not all at once
      ready.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top).forEach((entry, i) => {
        seen.unobserve(entry.target);
        setTimeout(() => entry.target.classList.add('is-in'), i * STAGGER);
      });
    }, { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25] });
    document.querySelectorAll('main > section, .footer, [data-reveal]').forEach((section) => seen.observe(section));
  }

  // wait for the loading screen to lift, so the hero is not animating behind it
  if (root.classList.contains('is-loading')) {
    document.addEventListener('loaderdone', start, { once: true });
  } else if (document.fonts && document.fonts.load) {
    // no loading screen on this page: give the fonts a moment, so the handwriting is not written twice
    const fonts = ['600 1em Oswald', '900 1em "Noto Serif"', '1em Kalam', '1em "Patrick Hand"'].map((font) => document.fonts.load(font));
    Promise.race([Promise.allSettled(fonts), new Promise((resolve) => setTimeout(resolve, 1500))]).then(start);
  } else {
    start();
  }
})();

// ---------- header: backing when scrolled, and the red tag follows the section on screen ----------
(() => {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const links = [...document.querySelectorAll('.nav__links a, .nav__menu a')];
  const sections = [...document.querySelectorAll('main > section')];

  // the bar gets its backing once the page has scrolled under it
  const onScroll = () => nav.classList.toggle('is-stuck', scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!('IntersectionObserver' in window)) return;

  let shown = null;
  function setCurrent(id) {
    if (id === shown) return;
    shown = id;
    for (const link of links) {
      if (id && link.hash === '#' + id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  // The current section is the one crossing a line a third of the way down the screen.
  // A section without a menu item (the gallery) lights nothing up.
  const onLine = new Set();
  const linked = sections.filter((section) => links.some((link) => link.hash === '#' + section.id));
  let chosen = null; // a menu item the visitor has just clicked

  function update() {
    if (chosen) return setCurrent(chosen);
    // at the very end of the page the line may never reach the last sections: light the last one up
    const atEnd = scrollY > 4 && innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    const current = atEnd ? linked.at(-1) : sections.find((section) => onLine.has(section));
    setCurrent(current ? current.id : '');
  }

  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) onLine.add(entry.target);
      else onLine.delete(entry.target);
    }
    update();
  }, { rootMargin: '-35% 0px -65% 0px' });
  sections.forEach((section) => spy.observe(section));
  addEventListener('scroll', update, { passive: true });

  // A clicked item stays lit, even where the page is too short to scroll its section up to the line
  // (on a phone several sections share one screen), until the visitor scrolls by hand again.
  for (const link of links) link.addEventListener('click', () => { chosen = link.hash.slice(1); update(); });
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    addEventListener(type, (e) => {
      if (type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
      if (chosen) { chosen = null; update(); }
    }, { passive: true });
  }
})();

// ---------- gallery: a photo opens up close ----------
(() => {
  const box = document.querySelector('.lightbox');
  const shots = [...document.querySelectorAll('.shot__open')];
  if (!box || !box.showModal || !shots.length) return; // no <dialog>: the links just open the picture

  const img = box.querySelector('.lightbox__img');
  const count = box.querySelector('.lightbox__count');
  const wrap = (i) => (i + shots.length) % shots.length;
  let index = 0;

  function show(i, direction) {
    index = wrap(i);
    const link = shots[index];
    const { w, h } = link.dataset;
    img.src = link.href;
    img.width = w;
    img.height = h;
    img.style.setProperty('--w', w);
    img.style.setProperty('--ar', w / h);
    img.alt = link.querySelector('img').alt;
    count.textContent = `${index + 1} / ${shots.length}`;
    // replay the entrance for the new photo
    box.dataset.dir = direction;
    img.classList.remove('is-in');
    void img.offsetWidth;
    img.classList.add('is-in');
    // have the neighbours ready
    for (const n of [index + 1, index - 1]) new Image().src = shots[wrap(n)].href;
  }

  shots.forEach((link, i) => link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // "open in a new tab" still works
    e.preventDefault();
    show(i, 'open');
    box.showModal();
    const root = document.documentElement;
    root.style.setProperty('--scrollbar', `${innerWidth - root.clientWidth}px`); // 0 where scrollbars float over the page
    root.classList.add('has-lightbox');
  }));

  box.querySelector('.lightbox__btn--prev').addEventListener('click', () => show(index - 1, 'prev'));
  box.querySelector('.lightbox__btn--next').addEventListener('click', () => show(index + 1, 'next'));
  box.querySelector('.lightbox__btn--close').addEventListener('click', () => box.close());
  box.addEventListener('close', () => document.documentElement.classList.remove('has-lightbox'));

  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1, 'next');
    if (e.key === 'ArrowLeft') show(index - 1, 'prev');
  });

  // swipe left / right; a plain click beside the photo closes
  let startX = null;
  let swiped = false;
  box.addEventListener('pointerdown', (e) => { startX = e.clientX; swiped = false; });
  box.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 50) return;
    swiped = true;
    show(index + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
  });
  box.addEventListener('click', (e) => {
    if (swiped) return;
    if (e.target === box || e.target.classList.contains('lightbox__figure')) box.close();
  });
})();

// ---------- arriving at "page#entry" ----------
// The browser jumps to the entry before the web fonts are in; when they arrive, the text above
// re-wraps and the entry slides out of place. Aim once more, unless the visitor has already moved.
// The place is taken from the layout (offsetTop), not from where the entry is drawn right now:
// it may still be waiting, shifted, for its entrance animation.
(() => {
  let target = null;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* malformed hash */ }
  if (!target) return;

  let moved = false;
  let watch = null;
  const stop = () => { moved = true; if (watch) watch.disconnect(); };
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    addEventListener(type, stop, { once: true, passive: true });
  }
  const aim = () => {
    if (moved) return;
    let top = 0;
    for (let el = target; el; el = el.offsetParent) top += el.offsetTop;
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    scrollTo({ top: top - margin, behavior: 'instant' });
  };
  // every time the page changes height in its first seconds (a font or a picture has arrived), aim again
  if ('ResizeObserver' in window) {
    watch = new ResizeObserver(aim);
    watch.observe(document.body);
    setTimeout(() => watch.disconnect(), 6000);
  }
  if (document.fonts) document.fonts.ready.then(aim);
  addEventListener('load', aim, { once: true });
})();

// ---------- 0401 ----------
// The hidden reel at /0401/ is not linked anywhere. Two ways in: type 0401 anywhere on the site,
// or click one of the "0401" stamps four times within two seconds.
(() => {
  const open = () => location.assign('/0401/');

  let typed = '';
  let lastKey = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const now = Date.now();
    if (now - lastKey > 2000) typed = '';
    lastKey = now;
    if (!/^\d$/.test(e.key)) { typed = ''; return; }
    typed = (typed + e.key).slice(-4);
    if (typed === '0401') open();
  });

  let clicks = [];
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('[data-secret-trigger]')) return;
    const now = Date.now();
    clicks = [...clicks.filter((t) => now - t < 2000), now];
    if (clicks.length >= 4) { clicks = []; open(); }
  });
})();
