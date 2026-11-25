// Checks the loading screen and the scroll animations on the REAL clock: loads the page in headless Chrome,
// watches the loader hand over to the hero, scrolls through every section, saves frames and prints a log.
// (Headless screenshots with --virtual-time-budget cannot do this: the loader and the reveals need real time.)
// Needs the preview server on port 5173. usage: node tools/check-animations.mjs <url> <width> <height> <outdir>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [,, url, W, H, out] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 500);
const prof = fs.mkdtempSync(out + '/prof-');
const chrome = spawn('google-chrome-stable', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--window-size=${W},${H}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(r.data, 'base64')); };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
const STATE = `JSON.stringify({ t: Math.round(performance.now()), y: Math.round(scrollY), vis: document.visibilityState, loader: !!document.querySelector('.loader'), pct: document.querySelector('.loader__bar')?.getAttribute('aria-valuenow') ?? null, ready: document.documentElement.classList.contains('reveal-ready'), in: [...document.querySelectorAll('main > section, .footer')].filter(e => e.classList.contains('is-in')).map(e => e.classList[0]).join(','), running: document.getAnimations().filter(a => a.playState === 'running').length, paused: document.getAnimations().filter(a => a.playState === 'paused').length })`;
const log = async (label) => console.log(label.padEnd(16), await evaluate(STATE));

await send('Page.navigate', { url });
const t0 = Date.now(); const at = async (ms) => { const d = t0 + ms - Date.now(); if (d > 0) await sleep(d); };
for (const ms of [900, 2000, 2700, 3100, 3600, 4300, 5200]) { await at(ms); await shot(`load-${ms}`); await log(`load +${ms}`); }
// scroll down the page in steps, like a visitor
const total = await evaluate('document.documentElement.scrollHeight - innerHeight');
const steps = 7;
for (let i = 1; i <= steps; i++) {
  await evaluate(`scrollTo({ top: ${Math.round(total * i / steps)}, behavior: 'instant' })`);
  await sleep(450); await shot(`scroll-${i}-a`); await log(`scroll ${i} +0.45`);
  await sleep(900); await shot(`scroll-${i}-b`); await log(`scroll ${i} +1.35`);
}
await sleep(2500); await log('end');
console.log('leftovers', await evaluate(`(() => { const bad = []; for (const el of document.querySelectorAll('main *, .footer *')) { const cs = getComputedStyle(el); if (cs.display === 'none') continue; const cls = (el.className.baseVal ?? el.className) || el.tagName; if (parseFloat(cs.opacity) === 0) bad.push(cls + ' opacity 0'); if (cs.clipPath.includes('100%')) bad.push(cls + ' clipped'); if (cs.strokeDashoffset !== '0px' && cs.strokeDasharray !== 'none') bad.push(cls + ' undrawn'); } return JSON.stringify({ animationsLeft: document.getAnimations().length, bad: bad.slice(0, 10) }); })()`));
await evaluate('scrollTo({ top: 0, behavior: "instant" })'); await sleep(300); await shot('end-top');
ws.close(); chrome.kill(); await sleep(300); fs.rmSync(prof, { recursive: true, force: true });
