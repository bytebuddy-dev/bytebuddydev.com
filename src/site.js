// Small, always-loaded script: copy buttons, click-to-load YouTube, and the 3D Bugsy loader.

// Light / dark switch. Default: follow the system. A click saves the visitor's choice
// (the inline script in <head> applies it before the first paint).
{
  const root = document.documentElement;
  const btn = document.querySelector('.theme-btn');
  const sysLight = matchMedia('(prefers-color-scheme: light)');
  const current = () => root.dataset.theme || (sysLight.matches ? 'light' : 'dark');
  const sync = () => {
    const next = current() === 'light' ? 'dark' : 'light';
    btn?.setAttribute('aria-label', `Switch to ${next} mode`);
    if (btn) btn.title = `Switch to ${next} mode`;
    // with a saved choice the media-based theme-color tags would be wrong: point both at the chosen colour
    const colour = current() === 'light' ? '#faf8f4' : '#0b0814';
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) if (root.dataset.theme) m.content = colour;
  };
  btn?.addEventListener('click', () => {
    const next = current() === 'light' ? 'dark' : 'light';
    root.classList.add('theme-anim');
    root.dataset.theme = next;
    try {
      localStorage.setItem('bb-theme', next);
    } catch {
      /* storage blocked: still switches for this page */
    }
    sync();
    setTimeout(() => root.classList.remove('theme-anim'), 400);
  });
  sysLight.addEventListener('change', sync);
  sync();
}

// Copy buttons on code blocks
for (const pre of document.querySelectorAll('pre')) {
  const b = document.createElement('button');
  b.className = 'copy';
  b.type = 'button';
  b.textContent = 'Copy';
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText);
      b.textContent = 'Copied ✓';
    } catch {
      b.textContent = 'Select & copy';
    }
    setTimeout(() => (b.textContent = 'Copy'), 1600);
  });
  pre.appendChild(b);
}

// YouTube: show the thumbnail first, load the player only on click (fast pages, no tracking until then)
for (const box of document.querySelectorAll('.yt[data-id]')) {
  box.querySelector('button')?.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${box.dataset.id}?autoplay=1&rel=0`;
    f.title = box.dataset.title || 'YouTube video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.allowFullscreen = true;
    box.replaceChildren(f);
  });
}

// 3D Bugsy: loaded after the page is ready so it never slows down the content.
// Skipped when the visitor asked to save data.
const saveData = navigator.connection && navigator.connection.saveData;
if (!saveData && document.getElementById('bugsy-canvas')) {
  const go = () => import('/assets/scene.js').catch(() => {});
  if (document.readyState === 'complete') setTimeout(go, 50);
  else addEventListener('load', () => setTimeout(go, 50));
}

// Search palette (Ctrl/Cmd + K or the header button). The index is built at deploy time: /assets/search.json.
{
  const dlg = document.getElementById('palette');
  const q = document.getElementById('pal-q');
  const list = document.getElementById('pal-list');
  let index = null;
  let hits = [];
  let sel = 0;
  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s.]/g, ' ');
  const score = (item, words) => {
    const t = norm(item.t);
    const all = t + ' ' + norm(item.d || '') + ' ' + norm(item.x || '');
    let sc = 0;
    for (const w of words) {
      if (!all.includes(w)) return 0;
      sc += t.startsWith(w) ? 6 : t.includes(w) ? 4 : 1;
    }
    return sc + (item.k === 'Tool' ? 2 : item.k === 'Page' ? 1 : 0);
  };
  const render = () => {
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    hits = !index ? [] : words.length ? index.map((it) => [score(it, words), it]).filter(([s]) => s).sort((a, b) => b[0] - a[0]).map(([, it]) => it).slice(0, 12) : index.filter((it) => it.k === 'Tool' || it.k === 'Page').slice(0, 10);
    sel = 0;
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    list.innerHTML = !index ? '<li class="empty">Loading…</li>' : hits.length
      ? hits.map((it, i) => `<li role="option" id="pal-${i}" aria-selected="${i === 0}"><a href="${esc(it.u)}"${it.u.startsWith('http') ? ' rel="noopener"' : ''}><span class="k">${esc(it.k)}</span>${esc(it.t)}${it.d ? `<small>${esc(it.d)}</small>` : ''}</a></li>`).join('')
      : `<li class="empty">Nothing found for “${esc(q.value)}”. Try “mcp”, “skill” or “cursor”.</li>`;
    q.setAttribute('aria-activedescendant', hits.length ? 'pal-0' : '');
  };
  const move = (d) => {
    if (!hits.length) return;
    sel = (sel + d + hits.length) % hits.length;
    list.querySelectorAll('li[role=option]').forEach((li, i) => li.setAttribute('aria-selected', i === sel));
    list.children[sel]?.scrollIntoView({ block: 'nearest' });
    q.setAttribute('aria-activedescendant', 'pal-' + sel);
  };
  const open = async () => {
    if (!dlg || dlg.open) return;
    dlg.showModal();
    q.value = '';
    render();
    q.focus();
    if (!index) {
      try {
        index = await (await fetch('/assets/search.json')).json();
      } catch {
        index = [];
      }
      render();
    }
  };
  document.querySelector('.search-btn')?.addEventListener('click', open);
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) { e.preventDefault(); open(); }
  });
  q?.addEventListener('input', render);
  q?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = list.children[sel]?.querySelector('a'); if (a) { dlg.close(); a.click(); } }
  });
  // click on the backdrop closes
  dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  list?.addEventListener('click', (e) => { if (e.target.closest('a')) dlg.close(); });
}
