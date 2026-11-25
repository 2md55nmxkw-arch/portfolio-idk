// 0401 — the hidden reel.
// A little film drawn on a canvas: our Teto dances in front of the site's own city and room, between
// two strips of film. There is no player: it loads, starts and loops.
//
// The dance re-stages a short video frame for frame (14 frames a second). motion.js says, for every
// frame, which pose she is in, where she stands, how she is stretched, what the camera does and how
// bright the picture is; the drawings are ours (dancer.js), the sound (assets/soundtrack.mp3) is the
// video's own: 16 seconds of music, then a quiet second and a half.
//
// Sound: browsers only let a page play audio by itself if the visitor has already interacted with
// the site (for example, arrived here through the hidden trigger on the main page). Otherwise the
// picture starts silently and the music joins in, in sync, on the first click, tap or key press.
(() => {
  'use strict';

  const W = 1024;
  const H = 576;
  const MOTION = window.REEL_MOTION;
  const FPS = MOTION.fps;
  const FRAMES = MOTION.frames;
  const DANCE_TIME = FRAMES.length / FPS;   // 16 seconds
  let loop = 17.65;                         // the whole soundtrack; replaced by its exact length once it is decoded

  const INK = '#12100f';
  const STRIP_Y = 77;             // the picture between the two film edges
  const STRIP_H = 422;
  const SIZE = 0.82;              // our drawings -> the size the figure has in the video

  const POSES = window.REEL_DANCER;
  const canvas = document.getElementById('reel');
  const ctx = canvas.getContext('2d', { alpha: false });
  const note = document.getElementById('note');
  const noteText = document.getElementById('note-text');
  const subtitles = document.getElementById('subtitles');

  // ---------- the camera: the video cuts between four views; these are ours ----------
  // [backdrop, zoom, x at the start of the pan, x at its end, y] in pixels of the backdrop
  const VIEWS = [
    ['city', 0.74, 30, 108, 3],
    ['city', 1, 222, 276, 84],
    ['room', 1, 20, 150, 0],
    ['city', 1, 428, 496, 150],
  ];

  // the site's own words; the video changes its caption eight times, we go through ours twice
  const CAPTIONS = ['taking games and runtimes apart,', 'seeing how they work,', 'and building my own tools from it.', '0401'];
  const captionOf = (frame) => {
    let n = 0;
    while (n + 1 < MOTION.captions.length && MOTION.captions[n + 1] <= frame) n += 1;
    return n % CAPTIONS.length;
  };
  // how many frames ago the camera last cut (for the flash on a cut)
  const sinceCut = FRAMES.map((f, i) => {
    let k = 0;
    while (i - k > 0 && FRAMES[i - k - 1][5] === f[5] && k < 20) k += 1;
    return k;
  });

  // ---------- loading ----------
  const plates = {};
  const dancer = {};   // pose -> { cut: canvas with a paper outline, shade: cream silhouette, ... }
  let audioCtx = null;
  let music = null;

  const loadImage = (path) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(path));
    img.src = path;
  });

  // each pose becomes a paper cut-out: a cream edge all round, so she reads against the dark city
  function prepareDancer(atlas) {
    const PAD = 8;
    for (const [name, p] of Object.entries(POSES)) {
      const shade = document.createElement('canvas');
      shade.width = p.w + PAD * 2;
      shade.height = p.h + PAD * 2;
      const s = shade.getContext('2d');
      s.drawImage(atlas, p.u, p.v, p.w, p.h, PAD, PAD, p.w, p.h);
      s.globalCompositeOperation = 'source-in';
      s.fillStyle = '#f3d9cc';
      s.fillRect(0, 0, shade.width, shade.height);

      const cut = document.createElement('canvas');
      cut.width = shade.width;
      cut.height = shade.height;
      const c = cut.getContext('2d');
      for (let a = 0; a < 12; a++) {
        c.drawImage(shade, Math.cos((a * Math.PI) / 6) * 4.5, Math.sin((a * Math.PI) / 6) * 4.5);
      }
      c.drawImage(atlas, p.u, p.v, p.w, p.h, PAD, PAD, p.w, p.h);
      dancer[name] = { cut, shade, middle: p.cx + PAD, bottom: p.h + PAD };
    }
  }

  async function loadMusic() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const data = await (await fetch('assets/soundtrack.mp3')).arrayBuffer();
    audioCtx = new Ctx();
    music = await audioCtx.decodeAudioData(data);
    loop = music.duration;
  }

  async function preload() {
    let done = 0;
    const total = 4;
    const tick = () => { done += 1; noteText.textContent = `${Math.round((done / total) * 100)}%`; };
    await Promise.all([
      loadImage('assets/dancer.webp').then((img) => { prepareDancer(img); tick(); }),
      loadImage('assets/city.webp').then((img) => { plates.city = img; tick(); }),
      loadImage('assets/room.webp').then((img) => { plates.room = img; tick(); }),
      loadMusic().catch(() => { music = null; }).then(tick),   // no music is not a reason to show nothing
      document.fonts && document.fonts.load ? document.fonts.load('24px Kalam').catch(() => {}) : null,
    ]);
  }

  // ---------- drawing ----------
  // small repeatable random numbers, so a frame looks the same every time it comes round
  const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const edge = ctx.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, 'rgba(18,16,15,0.55)');
  edge.addColorStop(0.16, 'rgba(18,16,15,0)');
  edge.addColorStop(0.84, 'rgba(18,16,15,0)');
  edge.addColorStop(1, 'rgba(18,16,15,0.55)');

  function drawBackdrop(view, pan) {
    const [name, zoom, x0, x1, y] = VIEWS[view];
    const img = plates[name];
    const sw = W / zoom;
    const sh = STRIP_H / zoom;
    const sx = Math.max(0, Math.min(img.width - sw, x0 + (x1 - x0) * pan));
    const sy = Math.max(0, Math.min(img.height - sh, y));
    ctx.drawImage(img, sx, sy, sw, sh, 0, STRIP_Y, W, STRIP_H);
    ctx.fillStyle = 'rgba(18,16,15,0.2)';        // a little darker, so the dancer leads
    ctx.fillRect(0, STRIP_Y, W, STRIP_H);
    ctx.fillStyle = edge;
    ctx.fillRect(0, STRIP_Y, W, STRIP_H);
  }

  // the exposure of the video, frame by frame, plus a flash where the camera cuts
  function drawLight(light, cutAge) {
    const flash = 0.34 * Math.exp(-cutAge * 0.55);
    const up = Math.max(0, light) * 0.45 + flash;
    if (up > 0.01) {
      ctx.fillStyle = `rgba(241,217,204,${Math.min(0.6, up).toFixed(3)})`;
      ctx.fillRect(0, STRIP_Y, W, STRIP_H);
    }
    if (light < -0.02) {
      ctx.fillStyle = `rgba(18,16,15,${Math.min(0.5, -light * 0.8).toFixed(3)})`;
      ctx.fillRect(0, STRIP_Y, W, STRIP_H);
    }
  }

  function drawFilm(time) {
    const shift = (time * 96) % 180;             // the film runs
    ctx.lineWidth = 1.5;
    for (const y of [22, 524]) {
      for (let x = -shift - 20; x < W + 20; x += 180) {
        ctx.beginPath();
        ctx.roundRect(x, y, 126, 30, 14);
        ctx.fillStyle = 'rgba(233,191,169,0.13)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(233,191,169,0.5)';
        ctx.stroke();
      }
    }
  }

  // one frame of the dance: [pose, x of her middle, y of her lowest point, width %, height %, ...]
  function drawFigure(f, image, alpha) {
    const d = dancer[MOTION.poses[f[0]]];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(f[1], f[2]);
    ctx.scale((SIZE * f[3]) / 100, (SIZE * f[4]) / 100);
    ctx.drawImage(d[image], -d.middle, -d.bottom);
    ctx.restore();
  }

  function drawCaption(index) {
    ctx.font = '29px Kalam, "Segoe Print", "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.strokeText(CAPTIONS[index], W / 2, 540);
    ctx.fillStyle = '#f1d9cc';
    ctx.fillText(CAPTIONS[index], W / 2, 540);
  }

  function drawWear(frame) {
    // dust and a scratch now and then
    ctx.fillStyle = 'rgba(241,217,204,0.5)';
    for (let i = 0; i < 5; i++) {
      const r = rand(frame * 7 + i);
      if (r > 0.45) ctx.fillRect(rand(frame * 13 + i) * W, STRIP_Y + rand(frame * 17 + i) * STRIP_H, 1 + r * 2, 1 + r * 2);
    }
    if (rand(frame * 3) > 0.82) {
      ctx.fillStyle = 'rgba(241,217,204,0.12)';
      ctx.fillRect(Math.floor(rand(frame * 5) * W), STRIP_Y, 1.5, STRIP_H);
    }
  }

  let ready = false;
  let shownFrame = -1;
  let shownCaption = -1;

  function render(pos, force = false) {
    if (!ready) return;
    const frame = Math.floor(((pos % loop) + loop) % loop * FPS + 1e-6);
    if (frame === shownFrame && !force) return;
    shownFrame = frame;
    // after the dance the music dies away: she stays where she fell and the picture goes dark
    const at = Math.min(frame, FRAMES.length - 1);
    const f = FRAMES[at];
    const tail = loop - DANCE_TIME;
    const dark = Math.max(0, Math.min(1, (frame / FPS - DANCE_TIME - (tail - 0.7)) / 0.7));

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    drawBackdrop(f[5], f[6] / 100);
    drawLight(f[7] / 100, frame < FRAMES.length ? sinceCut[at] : 99);
    drawWear(frame);
    drawFilm(frame / FPS);
    // the pale after-image of an earlier frame (fainter than in the video: ours is a flat silhouette)
    if (f[8] >= 0 && frame < FRAMES.length) drawFigure(FRAMES[f[8]], 'shade', (f[9] / 100) * 0.5);
    drawFigure(f, 'cut', 1);                      // over the film edges, as in the video
    if (dark > 0) {
      ctx.fillStyle = `rgba(18,16,15,${(dark * 0.92).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    const caption = captionOf(at);
    drawCaption(caption);
    if (caption !== shownCaption) { subtitles.textContent = CAPTIONS[caption]; shownCaption = caption; }
  }

  // ---------- the clock ----------
  // With sound, the audio clock runs the picture, so they cannot drift apart.
  // Without sound, a plain timer runs the same loop.
  let running = false;
  let sounding = false;
  let silentZero = 0;
  let audioZero = 0;

  const position = () => (sounding
    ? (audioCtx.currentTime - audioZero) % loop
    : ((performance.now() - silentZero) / 1000) % loop);

  function tick() {
    if (running) render(position());
    requestAnimationFrame(tick);
  }

  // ---------- sound ----------
  const GESTURES = ['click', 'keydown', 'touchend', 'pointerup'];

  function begin() {
    if (running) return;
    running = true;
    silentZero = performance.now();
  }

  // the music joins at the point the picture has reached
  function playMusic() {
    if (sounding || !music) return;
    const at = position();
    const source = audioCtx.createBufferSource();
    source.buffer = music;
    source.loop = true;                          // the whole recording, over and over
    const volume = audioCtx.createGain();
    volume.gain.value = 0.6;                     // the recording is very loud
    source.connect(volume).connect(audioCtx.destination);
    source.start(0, at);
    audioZero = audioCtx.currentTime - at;
    sounding = true;
    for (const type of GESTURES) removeEventListener(type, unlock, true);
    note.classList.add('is-off');
  }

  function unlock() {
    begin();
    if (audioCtx) audioCtx.resume().then(playMusic, () => {});
  }

  function start() {
    ready = true;
    render(0, true);
    note.classList.add('is-hint');
    noteText.textContent = '';

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ask = matchMedia('(hover: none)').matches ? 'tap' : 'click';
    if (!still) begin();

    if (still) {
      // visitors who asked their system for less motion get a still frame and choose to start it
      noteText.textContent = `${ask} to play`;
    } else if (!music) {
      note.classList.add('is-off');
      return;
    } else if (audioCtx.state === 'running') {
      playMusic();
      return;
    } else {
      // the browser is holding the sound back until the visitor does something
      audioCtx.resume().then(playMusic, () => {});
      setTimeout(() => { if (!sounding) noteText.textContent = `${ask} for sound`; }, 350);
    }
    for (const type of GESTURES) addEventListener(type, unlock, true);
  }

  // some phones pause the sound when the page goes to the background
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sounding && audioCtx.state !== 'running') audioCtx.resume();
  });

  // for looking at single frames from the console: reel0401.renderAt(seconds)
  window.reel0401 = {
    renderAt: (seconds) => render(Number(seconds), true),
    get frame() { return shownFrame; },
    get ready() { return ready; },
    get sound() { return sounding; },
    get position() { return ready ? position() : 0; },
  };

  requestAnimationFrame(tick);
  preload().then(start, (error) => {
    noteText.textContent = 'could not load';
    console.error('0401: could not load', error.message);
  });
})();
