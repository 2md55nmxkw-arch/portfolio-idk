// Loading screen: fills the bar with real progress (fonts + every picture on the page);
// the girl in the picture sleeps while it fills, wakes up near the end, and the screen
// lifts on "READY.". The page is already laid out underneath.
(() => {
  const root = document.documentElement;
  const loader = document.querySelector('.loader');
  if (!loader || !root.classList.contains('is-loading')) return;

  const MIN_TIME = 1700;  // ms - the bar never fills faster than this, so the screen does not just flash by
  const MAX_TIME = 12000; // ms - never keep a visitor waiting behind the screen
  const HOLD = 600;       // ms - "READY." stays this long before the screen lifts
  // waking up, as in the reference animation (assets/source/loader.gif)
  const WAKE_AT = [0.76, 0.92, 1]; // how full the bar is when she opens her eyes, lifts her head, sits up
  const FRAME_TIME = 180; // ms - a drawing stays at least this long
  const SIT_TIME = 240;   // ms - sitting up with her eyes still shut, before "READY."
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const page = document.querySelector('.page');
  const stage = loader.querySelector('.loader__stage');
  const art = loader.querySelector('.loader__art');
  const wakeArt = loader.querySelector('.loader__wake img');
  const bar = loader.querySelector('.loader__bar');
  const fill = loader.querySelector('.loader__fill');
  const glyphs = [...loader.querySelectorAll('.loader__pct > use')]; // three digits + the percent sign
  const ADVANCE = 11.5;   // distance from one digit to the next, in the units of the svg
  const NARROW = 7.5;     // the leading 1 of "100" is tucked in, so the number stays clear of the window in the picture

  if (page) page.inert = true;  // nothing behind the screen can be focused or clicked

  // the picture of the screen itself fades in if it was not ready yet
  if (!art.complete) {
    art.classList.add('is-pending');
    art.addEventListener('load', () => art.classList.remove('is-pending'), { once: true });
    art.addEventListener('error', () => art.classList.remove('is-pending'), { once: true });
  }

  // ---------- what we wait for ----------
  let total = 0;
  let done = 0;
  const track = (promise) => {
    total += 1;
    const tick = () => { done += 1; };
    Promise.resolve(promise).then(tick, tick);
  };

  // the fonts the page is set in
  if (document.fonts && document.fonts.load) {
    ['500 1em Oswald', '900 1em "Noto Serif"', 'italic 600 1em "Noto Serif"', '1em Kalam']
      .forEach((font) => track(document.fonts.load(font)));
  }

  // every picture that is part of the current layout: fetch it now rather than on scroll
  for (const img of document.images) {
    if (!img.getClientRects().length) continue; // hidden at this screen size - never needed
    img.loading = 'eager';
    track(img.complete ? null : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }));
  }

  // textures and icons referenced from the stylesheets
  track(document.readyState === 'complete' ? null : new Promise((resolve) => {
    addEventListener('load', resolve, { once: true });
  }));

  // ---------- drawing ----------
  let shownPercent = -1;
  function draw(value) {
    fill.style.setProperty('--p', value.toFixed(4));
    const percent = Math.round(value * 100);
    if (percent === shownPercent) return;
    shownPercent = percent;
    bar.setAttribute('aria-valuenow', percent);
    const text = String(percent);
    let x = 0;
    glyphs.slice(0, 3).forEach((use, i) => {
      if (i < text.length) {
        use.setAttribute('href', '#lg-' + text[i]);
        use.setAttribute('x', x);
        x += text.length === 3 && i === 0 ? NARROW : ADVANCE;
      } else {
        use.removeAttribute('href');
      }
    });
    glyphs[3].setAttribute('x', x + 0.5);
  }

  function finish() {
    clearTimeout(window.loaderFailsafe);
    if (page) page.inert = false;
    root.classList.remove('is-loading');
    loader.classList.add('is-done');
    document.dispatchEvent(new Event('loaderdone')); // js/main.js starts the entrance animations
    const remove = () => loader.remove();
    loader.addEventListener('transitionend', (e) => { if (e.target === loader) remove(); });
    setTimeout(remove, 1200);
  }

  // ---------- waking up ----------
  // 0 asleep, 1 eyes open, 2 head up, 3 sitting up, 4 "READY." (css/loader.css shows the drawing)
  let wake = 0;
  let wakeSince = 0;
  const setWake = (n, now) => {
    wake = n;
    wakeSince = now;
    stage.dataset.wake = n;
  };
  const canWake = () => wakeArt && wakeArt.complete && wakeArt.naturalWidth > 0;

  const start = performance.now();
  let last = start;
  let shown = 0;
  function frame(now) {
    const elapsed = now - start;
    const real = elapsed > MAX_TIME ? 1 : done / total;
    const target = reduced ? real : Math.min(real, elapsed / MIN_TIME);
    // glide towards the target instead of jumping
    shown += (target - shown) * (1 - Math.exp(-(now - last) / 110));
    last = now;
    if (target >= 1 && shown > 0.994) shown = 1;
    draw(shown);

    if (reduced) {                 // no motion wanted: she sleeps on, the screen simply lifts
      if (shown >= 1) return finish();
      return requestAnimationFrame(frame);
    }

    const want = WAKE_AT.filter((at) => shown >= at).length;
    const since = now - wakeSince;
    if (wake < want && (wake === 0 || since >= FRAME_TIME)) {
      if (canWake()) setWake(wake + 1, now);
      else if (shown >= 1) setWake(4, now);  // her drawings never arrived: straight to "READY."
    } else if (wake === 3 && shown >= 1 && since >= SIT_TIME) {
      setWake(4, now);
    } else if (wake === 4 && since >= HOLD) {
      return finish();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
