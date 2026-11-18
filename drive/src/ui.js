import { RESUME, STRINGS } from './content.js';
import { ZONES, ISLAND_RADIUS, coastRadius, roadPaths, LOOP_RADIUS } from './layout.js';

export const asset = (p) => (p ? './' + String(p).replace(/^\/+/, '') : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (id) => document.getElementById(id);

const ICONS = {
  medal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5 4.5L7 22l5-2 5 2-1.5-2.5M8.5 13.5 7 22m8.5-8.5L17 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="16" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export const ACHIEVEMENTS = ['ignition', 'explorer', 'reader', 'toppled', 'crates', 'airtime', 'flip', 'snowman', 'drifter', 'hire', 'polyglot'];

export function createUI({ getLang, interactions, onTeleport, onReset, onLang, audio }) {
  const S = () => STRINGS[getLang()];
  const R = () => RESUME[getLang()];

  // ---------- static text ----------
  function applyText() {
    const s = S(), r = R();
    document.documentElement.lang = getLang();
    document.documentElement.dir = s.dir;
    document.title = s.docTitle;
    const map = { name: r.meta.name, title: r.meta.title, ...s };
    document.querySelectorAll('[data-t]').forEach((el) => {
      const v = map[el.dataset.t];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-label]').forEach((el) => el.setAttribute('aria-label', s[el.dataset.label]));
    const keysHtml = s.keys.map(([k, v]) => `<li><span>${esc(v)}</span><kbd>${esc(k)}</kbd></li>`).join('');
    $('intro-keys').innerHTML = document.body.classList.contains('touch') ? `<li>${esc(s.touchHint)}</li>` : keysHtml;
    $('keys-list').innerHTML = keysHtml;
    $('keys-hint').innerHTML = s.keys.slice(0, 5).map(([k, v]) => `<span><kbd>${esc(k.split(' / ')[0])}</kbd>${esc(v)}</span>`).join('');
    $('intro-lang').textContent = s.language;
    $('intro-lang').setAttribute('aria-label', s.languageLabel);
    $('m-lang').textContent = s.language;
    $('m-lang').setAttribute('aria-label', s.languageLabel);
    $('m-sound').textContent = `${s.sound}: ${audio.enabled ? s.on : s.off}`;
    for (const id of ['m-cv', 'intro-cv']) {
      $(id).textContent = s.signs.cv;
      $(id).href = asset(r.meta.pdf);
    }
    for (const id of ['m-classic', 'intro-classic']) {
      $(id).textContent = s.classic;
      $(id).href = `https://alihanii.github.io/portfolio/${getLang()}/`;
    }
    $('m-reset').textContent = s.reset;
    if (!$('start').disabled) $('start-label').textContent = s.start;
    markers.forEach((m) => (m.tag.textContent = m.it.label()));
    renderAchievements();
    if (current) openPanel(current, true);
    if (!$('map').hidden) drawMap();
  }

  // ---------- markers ----------
  const markerRoot = $('markers');
  const markers = interactions.map((it) => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.innerHTML = '<span class="tag"></span><span class="diamond"></span>';
    markerRoot.appendChild(el);
    return { it, el, tag: el.querySelector('.tag') };
  });
  function updateMarkers(project, carPos, active) {
    for (const m of markers) {
      const d = Math.hypot(m.it.x - carPos.x, m.it.z - carPos.z);
      const p = project(m.it.x, m.it.y, m.it.z);
      const visible = p.visible && d < 42;
      m.el.style.opacity = visible ? (d < 26 ? 1 : 0.55) : 0;
      if (visible) m.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      m.el.classList.toggle('near', d < 16);
      m.el.classList.toggle('active', active === m.it);
    }
  }

  // ---------- prompt ----------
  const prompt = $('prompt');
  let promptFor = null;
  function setPrompt(it) {
    if (it === promptFor) return;
    promptFor = it;
    if (!it || current?.id === it.id) {
      prompt.hidden = true;
      return;
    }
    prompt.hidden = false;
    prompt.querySelector('small').textContent = S().zones[it.zone];
    prompt.querySelector('strong').textContent = it.label();
    prompt.querySelector('.prompt-key').textContent = document.body.classList.contains('touch') ? S().open : S().openKey;
  }
  prompt.addEventListener('click', () => promptFor && openPanel(promptFor));

  // ---------- panel ----------
  let current = null;
  const opened = new Set();
  const listeners = { open: [] };
  function openPanel(it, rerender = false) {
    current = it;
    const body = $('panel-body');
    body.innerHTML = panelHtml(it.panel);
    $('panel').hidden = false;
    prompt.hidden = true;
    if (!rerender) {
      body.scrollTop = 0;
      opened.add(it.panel.type);
      listeners.open.forEach((f) => f(it, opened));
      if (it.panel.type === 'experience') {
        body.querySelector(`[data-job="${it.panel.index}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    }
    body.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => {
        const target = interactions.find((x) => x.id === b.dataset.goto);
        if (target) openPanel(target);
      }),
    );
    body.querySelectorAll('[data-contact]').forEach((a) => a.addEventListener('click', () => listeners.open.forEach((f) => f({ panel: { type: 'contact-used' } }, opened))));
  }
  function closePanel() {
    current = null;
    $('panel').hidden = true;
    promptFor = null;
  }
  $('panel-close').addEventListener('click', closePanel);

  function panelHtml(p) {
    const s = S(), r = R();
    const head = (eyebrow, title, sub = '') =>
      `<p class="p-eyebrow">${esc(eyebrow)}</p><h2 class="p-title" id="panel-title">${esc(title)}</h2>${sub ? `<p class="p-sub">${esc(sub)}</p>` : ''}`;
    const chips = (arr) => `<ul class="chips">${arr.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    const cvBtn = `<a class="btn primary" href="${asset(r.meta.pdf)}" download data-contact>${ICONS.download}${esc(s.signs.cv)}</a>`;
    if (p.type === 'about') {
      const a = r.about;
      return `${head(`${a.index} · ${s.zones.about}`, a.title, `${r.meta.fullName} · ${r.meta.location}`)}
        <p class="p-body">${esc(a.body)}</p>
        <div class="p-cards">${a.highlights.map((h) => `<div class="p-card"><h4>${esc(h.title)}</h4><p>${esc(h.text)}</p></div>`).join('')}</div>
        <div class="p-cards">${r.hero.stats.map((h) => `<div class="p-card"><h4>${esc(h.value)}</h4><p>${esc(h.label)}</p></div>`).join('')}</div>
        <div class="p-card" style="margin-bottom:18px"><h4>${esc(r.education.title)}</h4><p>${esc(r.education.degree)} · ${esc(r.education.school)}<br>${esc(r.education.masters)}</p></div>
        <div class="p-actions">${cvBtn}</div>`;
    }
    if (p.type === 'experience') {
      const e = r.experience;
      return `${head(`${e.index} · ${s.zones.experience}`, e.title)}
        ${e.items.map((it, i) => `<article class="p-job ${i === p.index ? '' : 'dim'}" data-job="${i}" style="border-color:${i ? 'var(--lavender)' : 'var(--teal)'}">
          <h3>${esc(it.company)}${it.current ? `<span class="badge">${esc(r.ui.current)}</span>` : ''}</h3>
          <p class="meta">${esc(it.role)} · ${esc(it.period)}</p>
          <ul class="p-list">${it.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          ${chips(it.tags)}
        </article>`).join('')}`;
    }
    if (p.type === 'stack') {
      const st = r.stack;
      return `${head(`${st.index} · ${s.zones.stack}`, st.title)}
        ${st.groups.map((g) => `<div class="p-group"><h4>${esc(g.name)}</h4>${chips(g.items)}</div>`).join('')}
        <div class="p-group"><h4>${esc(st.softTitle)}</h4><ul class="p-list">${st.soft.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    }
    if (p.type === 'project') {
      const items = r.projects.items;
      const it = items[p.index];
      const prev = (p.index - 1 + items.length) % items.length, next = (p.index + 1) % items.length;
      return `${head(`${r.projects.index} · ${s.zones.projects} · ${p.index + 1}/${items.length}`, it.name)}
        ${it.image ? `<img class="p-img" src="${asset(it.image)}" alt="" loading="lazy">` : ''}
        <p class="p-body">${esc(it.description)}</p>
        <h4 class="p-sub" style="margin-bottom:8px">${esc(r.ui.features)}</h4>
        <ul class="p-list">${it.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${chips(it.tags)}
        ${it.url ? `<div class="p-actions"><a class="btn primary" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.live || s.visit)} ${ICONS.arrow}</a></div>` : ''}
        <div class="p-nav"><button class="btn" data-goto="proj-${prev}">${esc(items[prev].name)}</button><button class="btn" data-goto="proj-${next}">${esc(items[next].name)}</button></div>`;
    }
    if (p.type === 'contact') {
      const m = r.meta, c = r.contact;
      const links = {
        email: `<a class="btn ${p.kind === 'email' ? 'primary' : ''}" href="mailto:${esc(m.email)}" data-contact>${esc(s.sendEmail)}</a>`,
        github: `<a class="btn ${p.kind === 'github' ? 'primary' : ''}" href="${esc(m.github)}" target="_blank" rel="noopener" data-contact>${esc(s.signs.github)} ${ICONS.arrow}</a>`,
        linkedin: `<a class="btn ${p.kind === 'linkedin' ? 'primary' : ''}" href="${esc(m.linkedin)}" target="_blank" rel="noopener" data-contact>${esc(s.signs.linkedin)} ${ICONS.arrow}</a>`,
        cv: `<a class="btn ${p.kind === 'cv' ? 'primary' : ''}" href="${asset(m.pdf)}" download data-contact>${ICONS.download}${esc(s.signs.cv)}</a>`,
      };
      const detail = {
        email: m.email, github: m.github.replace('https://', ''), linkedin: m.linkedin.replace('https://', ''), cv: s.cvText,
      }[p.kind];
      const order = [p.kind, ...Object.keys(links).filter((k) => k !== p.kind)];
      return `${head(`${c.index} · ${s.zones.contact}`, s.signs[p.kind], detail)}
        <p class="p-body">${esc(c.body)}</p>
        <div class="p-actions">${order.map((k) => links[k]).join('')}</div>`;
    }
    return '';
  }

  // ---------- toasts & achievements ----------
  let done = {};
  try {
    done = JSON.parse(localStorage.getItem('drive-ach') || '{}');
  } catch {}
  function unlock(id) {
    if (done[id]) return false;
    done[id] = true;
    try {
      localStorage.setItem('drive-ach', JSON.stringify(done));
    } catch {}
    const [title, desc] = S().achievementsList[id];
    toast(S().unlocked, title, desc);
    audio.chime();
    renderAchievements();
    return true;
  }
  function toast(small, title, desc) {
    const el = document.createElement('div');
    el.className = 'toast glass';
    el.innerHTML = `<span class="medal">${ICONS.medal}</span><div><small>${esc(small)}</small><strong>${esc(title)}</strong><p>${esc(desc)}</p></div>`;
    $('toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 3800);
  }
  function renderAchievements() {
    const list = S().achievementsList;
    const n = ACHIEVEMENTS.filter((a) => done[a]).length;
    $('ach-list').innerHTML = ACHIEVEMENTS.map((a) => `<li class="${done[a] ? 'done' : ''}"><strong>${esc(list[a][0])}</strong>${esc(list[a][1])}</li>`).join('');
    document.querySelector('#menu h3[data-t="achievements"]').textContent = `${S().achievements} · ${n}/${ACHIEVEMENTS.length}`;
  }

  // ---------- overlays ----------
  const anyOverlay = () => !$('map').hidden || !$('menu').hidden;
  function toggle(id, force) {
    const el = $(id);
    const show = force ?? el.hidden;
    ['map', 'menu'].forEach((o) => ($(o).hidden = true));
    el.hidden = !show;
    if (show) {
      if (id === 'map') drawMap();
      el.querySelector('.icon-btn')?.focus();
    }
  }
  $('btn-map').addEventListener('click', () => toggle('map'));
  $('btn-menu').addEventListener('click', () => toggle('menu'));
  $('map-close').addEventListener('click', () => toggle('map', false));
  $('menu-close').addEventListener('click', () => toggle('menu', false));
  for (const id of ['map', 'menu']) $(id).addEventListener('click', (e) => e.target.id === id && toggle(id, false));
  $('m-lang').addEventListener('click', () => onLang());
  $('intro-lang').addEventListener('click', () => onLang());
  $('m-sound').addEventListener('click', () => {
    audio.setEnabled(!audio.enabled);
    applyText();
  });
  $('m-reset').addEventListener('click', () => {
    toggle('menu', false);
    onReset();
  });
  $('m-cv').addEventListener('click', () => unlock('hire'));
  $('intro-cv').addEventListener('click', () => unlock('hire'));

  // ---------- map ----------
  const mapCanvas = $('map-canvas');
  let carState = { x: 0, z: 0, yaw: 0 };
  const M = (x, z) => [((x + 100) / 200) * 900, ((z + 100) / 200) * 900];
  function drawMap() {
    const ctx = mapCanvas.getContext('2d');
    const s = S();
    ctx.clearRect(0, 0, 900, 900);
    ctx.fillStyle = '#2f5f8f';
    ctx.fillRect(0, 0, 900, 900);
    ctx.fillStyle = '#eef3fb';
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const r = coastRadius(a);
      const [x, y] = M(Math.cos(a) * r, Math.sin(a) * r);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.fill();
    ctx.strokeStyle = '#b7c3dc';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const p of roadPaths()) {
      const [a, b, c] = p.map((q) => M(q[0], q[1]));
      ctx.moveTo(...a);
      ctx.quadraticCurveTo(...b, ...c);
    }
    const [cx, cy] = M(0, 0);
    ctx.moveTo(cx + LOOP_RADIUS * 4.5, cy);
    ctx.arc(cx, cy, LOOP_RADIUS * 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#24584f';
    for (const t of mapTrees) {
      const [x, y] = M(t.x, t.z);
      ctx.beginPath();
      ctx.arc(x, y, 7 * t.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.direction = s.dir;
    for (const k in ZONES) {
      const z = ZONES[k];
      const [x, y] = M(z.x, z.z);
      ctx.fillStyle = z.color + '33';
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, z.r * 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `800 30px ${getLang() === 'fa' ? 'Vazirmatn' : '"Bricolage Grotesque"'}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#eef3fb';
      ctx.strokeText(s.zones[k], x, y + 10);
      ctx.fillStyle = '#16213b';
      ctx.fillText(s.zones[k], x, y + 10);
    }
    // car
    const [x, y] = M(carState.x, carState.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-carState.yaw);
    ctx.fillStyle = '#ffb547';
    ctx.strokeStyle = '#16213b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(16, 18);
    ctx.lineTo(0, 9);
    ctx.lineTo(-16, 18);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
  let mapTrees = [];
  mapCanvas.addEventListener('click', (e) => {
    const b = mapCanvas.getBoundingClientRect();
    const wx = ((e.clientX - b.left) / b.width) * 200 - 100;
    const wz = ((e.clientY - b.top) / b.height) * 200 - 100;
    let best = null, bd = Infinity;
    for (const k in ZONES) {
      const d = Math.hypot(ZONES[k].x - wx, ZONES[k].z - wz);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best && bd < ZONES[best].r + 10) {
      toggle('map', false);
      onTeleport(best);
    }
  });

  return {
    applyText, updateMarkers, setPrompt, openPanel, closePanel, unlock, toggle, anyOverlay, renderAchievements,
    get panelOpen() { return current; },
    get prompted() { return promptFor; },
    onOpen: (f) => listeners.open.push(f),
    setCar: (c) => (carState = c),
    setTrees: (t) => (mapTrees = t),
    isDone: (id) => !!done[id],
  };
}
