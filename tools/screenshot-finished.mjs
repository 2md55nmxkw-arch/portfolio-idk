// Real clock: loads the page (loading screen included) in headless Chrome, waits until the animations are over
// and saves a screenshot of the finished page - compare it with an earlier one to see that nothing moved.
// Use a window as tall as the page so every section is on screen.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const [,, url, W, H, out, wait = '9000'] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 500);
const prof = fs.mkdtempSync(path.join(path.dirname(out), 'prof-'));
const chrome = spawn('google-chrome-stable', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--window-size=${W},${H}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(+wait);
const state = (await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({ loader: !!document.querySelector('.loader'), in: [...document.querySelectorAll('main > section, .footer, [data-reveal]')].filter(e => e.classList.contains('is-in')).length, animations: document.getAnimations().length, pageH: document.documentElement.scrollHeight })` })).result.value;
console.log(state);
const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
ws.close(); chrome.kill(); await sleep(300); fs.rmSync(prof, { recursive: true, force: true });
