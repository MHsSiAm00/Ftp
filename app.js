'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const app = $('#app'), sheet = $('#sheet');
let items = [], myList = store.get('cinehub:list', []), heroTimer, toastTimer;

/* ---------- templates ---------- */
const card = m => `<button class="card" data-id="${esc(m.id)}" aria-label="${esc(m.title)}">
  <div class="poster" style="--h:${+m.hue || 0}">${m.poster ? `<img loading="lazy" src="${esc(m.poster)}" alt="" onerror="this.remove()">` : ''}<span>${esc(m.title)}</span></div>
  <div class="meta"><b>${esc(m.title)}</b><small>${esc(m.year)}, ${esc(m.type)}</small></div></button>`;
const facts = m => `<div class="facts"><b>${esc(m.year)}</b><span>${esc((m.genres || []).join(', '))}</span><span>${esc(m.runtime || '')}</span>${m.quality ? `<span>${esc(m.quality)}</span>` : ''}</div>`;
const grid = l => l.length ? `<div class="grid">${l.map(card).join('')}</div>` : `<p class="empty">Nothing here yet.</p>`;
const skeleton = () => `<div class="sk" style="height:72vh;border-radius:0"></div>` + [1, 2, 3].map(() =>
  `<div class="row"><div class="sk" style="height:20px;width:140px;margin:0 16px 10px"></div><div class="scroller">${'<div class="sk" style="flex:0 0 128px;aspect-ratio:2/3"></div>'.repeat(6)}</div></div>`).join('');

/* ---------- views ---------- */
const rows = [
  ['Trending now', m => m.trending],
  ['Animated', m => m.genres.includes('Animation')],
  ['Science fiction', m => m.genres.includes('Sci-Fi')],
  ['Horror and thriller', m => m.genres.some(g => ['Horror', 'Thriller'].includes(g))],
  ['Silent-era classics', m => m.year < 1950]
];

function home() {
  const feat = items.filter(m => m.trending);
  const set = i => {
    const m = feat[i % feat.length];
    $('#hero').style.setProperty('--h', m.hue);
    $('#hero').innerHTML = `<div class="hero-in"><h1>${esc(m.title)}</h1>${facts(m)}<p>${esc(m.desc)}</p>
      <div class="acts"><button class="btn pri" data-play="${esc(m.id)}">Play</button><button class="btn" data-id="${esc(m.id)}">Details</button></div>
      <div class="dots">${feat.map((_, j) => `<button data-hero="${j}" aria-label="Show featured title ${j + 1}" class="${j === i % feat.length ? 'on' : ''}"></button>`).join('')}</div></div>`;
    set.i = i;
  };
  app.innerHTML = `<section class="hero" id="hero"></section>` + rows.map(([t, f]) => {
    const l = items.filter(f); return l.length ? `<section class="row"><h2>${t}</h2><div class="scroller">${l.map(card).join('')}</div></section>` : '';
  }).join('');
  if (feat.length) {
    set(0);
    app.onclick = e => { const d = e.target.closest('[data-hero]'); if (d) { clearInterval(heroTimer); set(+d.dataset.hero); } };
    heroTimer = setInterval(() => !document.hidden && set((set.i || 0) + 1), 7000);
  }
}
const explore = () => {
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
  app.innerHTML = `<section class="page"><h2>Explore</h2>${grid(sorted)}</section>`;
};
const list = () => {
  app.innerHTML = `<section class="page"><h2>My List</h2>${myList.length ? grid(items.filter(m => myList.includes(m.id))) : '<p class="empty">Titles you save with + My List appear here.</p>'}</section>`;
};
function search() {
  app.innerHTML = `<section class="page"><label class="search"><span aria-hidden="true">⌕</span><input id="q" type="search" placeholder="Search titles, genres or years" autocomplete="off"></label><div id="res"></div></section>`;
  const run = () => {
    const q = $('#q').value.trim().toLowerCase();
    const l = !q ? items : items.filter(m => [m.title, m.year, m.type, ...m.genres].join(' ').toLowerCase().includes(q));
    $('#res').innerHTML = l.length ? grid(l) : `<p class="empty">No results for “${esc($('#q').value)}”. Try a shorter title or a genre.</p>`;
  };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(run, 200); };
  run(); $('#q').focus({ preventScroll: true });
}

/* ---------- details sheet ---------- */
function open(id) {
  const m = items.find(x => x.id === id); if (!m) return;
  const saved = myList.includes(id);
  sheet.innerHTML = `<div class="hd" style="--h:${+m.hue}"><button class="x" data-close aria-label="Close">✕</button></div>
    <div class="bd"><h2>${esc(m.title)}</h2>${facts(m)}<p>${esc(m.desc)}</p>
    <div class="acts"><button class="btn pri" data-play="${esc(id)}">Play</button><button class="btn" data-list="${esc(id)}">${saved ? '✓ In My List' : '+ My List'}</button></div></div>`;
  if (!sheet.open) sheet.showModal();
}
sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.close(); });
function toggleList(id) {
  myList = myList.includes(id) ? myList.filter(x => x !== id) : [...myList, id];
  store.set('cinehub:list', myList); open(id);
  if (location.hash === '#/list') list();
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600); }
document.addEventListener('click', e => {
  const c = e.target.closest('[data-id]'), p = e.target.closest('[data-play]'), l = e.target.closest('[data-list]');
  if (l) return toggleList(l.dataset.list);
  if (p) return toast('The player arrives in Phase 6.');
  if (c) open(c.dataset.id);
});

/* ---------- router ---------- */
const views = { home, explore, search, list };
function route() {
  const v = (location.hash.match(/^#\/(\w+)/) || [, 'home'])[1];
  clearInterval(heroTimer); app.onclick = null; scrollTo(0, 0);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  (views[v] || home)();
}
addEventListener('hashchange', route);

/* ---------- boot ---------- */
app.innerHTML = skeleton();
fetch('data/fallback.json').then(r => r.json()).then(d => { items = d; route(); })
  .catch(() => { app.innerHTML = `<p class="empty" style="padding-top:120px">The catalogue could not load. Open the site through GitHub Pages or a local web server, not as a file.</p>`; });
