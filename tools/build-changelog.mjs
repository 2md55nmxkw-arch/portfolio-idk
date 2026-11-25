// Renders data/changelog.json into
//   - the list of releases in changelog.html (between the "releases:start" / "releases:end" comments)
//   - the three latest entries in the Notes section of index.html ("notes:start" / "notes:end")
// usage: node tools/build-changelog.mjs
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(root + 'data/changelog.json', 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const KIND = { added: ['plus', 'Added'], fixed: ['wrench', 'Fixed'], changed: ['dash', 'Changed'], removed: ['dash', 'Removed'] };

const used = new Set();
const ids = [];
const cards = data.releases.map((r) => {
  const p = data.projects[r.project];
  if (!p) throw new Error(`unknown project "${r.project}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error(`bad date "${r.date}"`);
  // the newest entry of a project gets the plain id (index.html links to it), older ones add the date
  let id = used.has(r.project) ? `${r.project}-${r.date}` : r.project;
  for (let n = 2; used.has(id); n++) id = `${r.project}-${r.date}-${n}`;
  used.add(id);
  ids.push(id);
  const title = r.title
    ? `\n              <p class="cl-release__title">${esc(r.title)}${r.label ? ` <span>${esc(r.label)}</span>` : ''}</p>`
    : '';
  const items = r.items.map(([kind, text]) => {
    if (!KIND[kind]) throw new Error(`unknown kind "${kind}"`);
    return `                <li class="cl-change cl-change--${kind}"><svg class="cl-change__ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#ci-${KIND[kind][0]}"/></svg><span><b>${KIND[kind][1]}:</b> ${esc(text)}</span></li>`;
  }).join('\n');
  return `          <li class="cl-release" id="${id}">
            <span class="cl-release__frame" aria-hidden="true"></span>
            <header class="cl-release__head">
              <span class="cl-version">${esc(r.version)}</span>
              <span class="cl-release__icon"><span class="icon icon--${p.icon}" aria-hidden="true"></span></span>
              <h2 class="cl-release__name">${esc(p.name)}</h2>
              <time class="cl-release__date" datetime="${r.date}">${r.date}</time>
            </header>
            <div class="cl-release__body">${title}
              <ul class="cl-changes">
${items}
              </ul>
            </div>
          </li>`;
}).join('\n');

const file = root + 'changelog.html';
const html = fs.readFileSync(file, 'utf8');
const re = /(<!-- releases:start[^>]*-->)[\s\S]*?(\n\s*<!-- releases:end -->)/;
if (!re.test(html)) throw new Error('markers not found in changelog.html');
fs.writeFileSync(file, html.replace(re, (m, a, b) => a + '\n' + cards + b));
console.log(`changelog.html: ${data.releases.length} releases`);

// ---------- index.html: the Notes section shows the latest three ----------
// One line each: "Project — title". A long line is cut with "..." by the page; give an entry
// a "short" title in the data to choose the wording yourself.
const NOTES = 3;
const rows = data.releases.slice(0, NOTES).map((r, i) => {
  const text = `${data.projects[r.project].name} — ${r.short ?? r.title ?? r.items[0][1].replace(/\.$/, '')}`;
  const tip = text.length > 38 ? ` title="${esc(text)}"` : '';
  return `            <li><a class="note" href="changelog.html#${ids[i]}"${tip}><svg class="note__icon" viewBox="0 0 14 17" aria-hidden="true"><use href="#i-doc"/></svg><span class="note__title">${esc(text)}</span><time class="note__date" datetime="${r.date}">${r.date}</time><svg class="note__arrow" viewBox="0 0 12 12" aria-hidden="true"><use href="#i-arrow"/></svg></a></li>`;
}).join('\n');
const indexFile = root + 'index.html';
const index = fs.readFileSync(indexFile, 'utf8');
const reNotes = /(<!-- notes:start[^>]*-->)[\s\S]*?(\n\s*<!-- notes:end -->)/;
if (!reNotes.test(index)) throw new Error('markers not found in index.html');
fs.writeFileSync(indexFile, index.replace(reNotes, (m, a, b) => a + '\n' + rows + b));
console.log(`index.html: ${NOTES} notes`);
