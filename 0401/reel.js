// 0401 — the hidden reel.
// A little film drawn on a canvas: our Teto dances through 17 poses, one per beat, in front of the
// site's own city and room, between two strips of film. There is no player: it loads, starts and loops.
//
// Sound: browsers only let a page play audio by itself if the visitor has already interacted with
// the site (for example, arrived here through the hidden trigger on the main page). Otherwise the
// picture starts silently and the music joins in, in sync, on the first click, tap or key press.
(() => {
  'use strict';

  const W = 1024;
  const H = 576;
  const FPS = 14;                 // the picture moves in steps, like a hand-drawn film
  const BEAT = 0.5;               // seconds: 120 beats a minute, as in tools/build-reel-music.py
  const BEATS = 32;
  const LOOP = BEAT * BEATS;      // 16 seconds
  const LOOP_START = 0.3;         // the music file is a second longer than the loop; we loop a window inside it

  const INK = '#12100f';
  const CREAM = '#e9bfa9';
  const STRIP_Y = 77;             // the picture between the two film edges
  const STRIP_H = 422;
  const GROUND = 492;             // where her feet stand
  const SIZE = 0.86;              // sprite pixels -> stage pixels

  const POSES = window.REEL_DANCER;
  const canvas = document.getElementById('reel');
  const ctx = canvas.getContext('2d', { alpha: false });
  const note = document.getElementById('note');
  const noteText = document.getElementById('note-text');
  const subtitles = document.getElementById('subtitles');

  // ---------- the dance: one pose per beat ----------
  // [pose, x at the start of the beat, x at its end, extras]; x is where her feet are on the stage
  const PASS = [
    ['sneak', 70, 210],
    ['march', 250, 350],
    ['runbow', 400, 540, { trail: true }],
    ['lunge', 560],
    ['squat', 560],
    ['jump', 560, 560, { hop: 70 }],
    ['bow', 560],
    ['headache', 560, 560, { shake: true }],
    ['star', 512],
    ['spin', 512, 512, { spin: true }],
    ['wink', 512],
    ['sway', 512, 512, { sway: true }],
    ['strut', 540, 690],
    ['cheer', 740, 740, { hop: 26 }],
    ['banzai', 740, 740, { hop: 42 }],
    ['collapse', 760, 760, { drop: true }],
  ];
  const step = ([pose, x0, x1 = x0, extra = {}], flip = false) => ({ pose, x0, x1, flip, ...extra });
  // second half: she gets up and dances it back the other way, mirrored
  const DANCE = [
    ...PASS.map((s) => step(s)),
    step(['idle', 760]),
    ...PASS.slice(1).map(([pose, x0, x1 = x0, extra]) => step([pose, W - x0, W - x1, extra], true)),
  ];

  // ---------- the camera: one view per bar (four beats) ----------
  // [backdrop, zoom, x at the start of the bar, x at its end, y] in pixels of the backdrop
  const VIEWS = [
    ['city', 0.74, 30, 108, 3],
    ['city', 1, 249, 249, 96],
    ['room', 1, 0, 150, 0],
    ['city', 1, 90, 10, 150],
    ['city', 0.74, 108, 30, 3],
    ['room', 1, 170, 40, 0],
    ['city', 1, 410, 496, 150],
    ['city', 1, 249, 249, 60],
  ];

  // the site's own words, two bars each
  const CAPTIONS = ['taking games and runtimes apart,', 'seeing how they work,', 'and building my own tools from it.', '0401'];

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
      dancer[name] = { cut, shade, ax: p.ax + PAD, h: p.h + PAD };
    }
  }

  async function loadMusic() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const data = await (await fetch('assets/loop.mp3')).arrayBuffer();
    audioCtx = new Ctx();
    music = await audioCtx.decodeAudioData(data);
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

  function drawBackdrop(bar, inBar) {
    const [name, zoom, x0, x1, y] = VIEWS[bar];
    const img = plates[name];
    const sw = W / zoom;
    const sh = STRIP_H / zoom;
    const sx = Math.max(0, Math.min(img.width - sw, x0 + (x1 - x0) * inBar));
    const sy = Math.max(0, Math.min(img.height - sh, y));
    ctx.drawImage(img, sx, sy, sw, sh, 0, STRIP_Y, W, STRIP_H);
    ctx.fillStyle = 'rgba(18,16,15,0.2)';        // a little darker, so the dancer leads
    ctx.fillRect(0, STRIP_Y, W, STRIP_H);
    ctx.fillStyle = edge;
    ctx.fillRect(0, STRIP_Y, W, STRIP_H);
  }

  function drawFilm(pos) {
    const shift = (pos * 96) % 180;              // the film runs
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

  function drawDancer(s, t, frame) {
    const d = dancer[s.pose];
    const ease = 1 - (1 - t) * (1 - t);
    let x = s.x0 + (s.x1 - s.x0) * ease;
    let lift = 0;
    if (s.hop) lift = s.hop * Math.sin(Math.PI * Math.min(1, t / 0.85));
    if (s.drop) lift = 46 * Math.max(0, 1 - t * 4);
    if (s.shake) x += frame % 2 ? 4 : -4;
    if (s.sway) x += 12 * Math.sin(t * Math.PI * 2);
    const pop = Math.exp(-t * 7);                 // a little stretch as each pose lands
    const sx = (s.flip ? -1 : 1) * SIZE * (1 - 0.05 * pop);
    const sy = SIZE * (1 + 0.09 * pop);

    const place = (image, dx, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(x + dx), Math.round(GROUND - lift));
      ctx.scale(sx, sy);
      ctx.drawImage(image, -d.ax, -d.h);
      ctx.restore();
    };
    // pale after-images on the fast moves
    const dir = Math.sign(s.x1 - s.x0);
    if (s.trail && t < 0.8) { place(d.shade, -dir * 84, 0.14); place(d.shade, -dir * 44, 0.28); }
    if (s.spin && t < 0.6) { place(d.shade, -36, 0.2); place(d.shade, 36, 0.2); }
    place(d.cut, 0, 1);
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
    const frame = Math.floor(((pos % LOOP) + LOOP) % LOOP * FPS + 1e-6);
    if (frame === shownFrame && !force) return;
    shownFrame = frame;
    const time = frame / FPS;                     // everything moves on the frame grid
    const beat = Math.min(BEATS - 1, Math.floor(time / BEAT));
    const inBeat = time / BEAT - beat;
    const bar = Math.floor(beat / 4);
    const inBar = (time - bar * 4 * BEAT) / (4 * BEAT);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    drawBackdrop(bar, inBar);

    // the light jumps on every bar and breathes on every beat
    const flash = 0.42 * Math.exp(-inBar * 4 * BEAT * 7) + 0.06 * Math.exp(-inBeat * 6);
    ctx.fillStyle = `rgba(241,217,204,${flash.toFixed(3)})`;
    ctx.fillRect(0, STRIP_Y, W, STRIP_H);

    drawWear(frame);
    drawFilm(time);
    drawDancer(DANCE[beat], inBeat, frame);   // over the film edges: a jump breaks out of the frame

    const caption = Math.floor(bar / 2);
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
    ? (audioCtx.currentTime - audioZero) % LOOP
    : ((performance.now() - silentZero) / 1000) % LOOP);

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
    source.loop = true;
    source.loopStart = LOOP_START;
    source.loopEnd = LOOP_START + LOOP;
    const volume = audioCtx.createGain();
    volume.gain.value = 0.85;
    source.connect(volume).connect(audioCtx.destination);
    source.start(0, at < LOOP_START ? at + LOOP : at);
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
