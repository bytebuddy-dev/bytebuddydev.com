// Blog reading experience (bytebuddydev.com/blog/). Everything here is per visitor and stays in their browser:
// - a progress bar under the header with Bugsy crawling along it, and "N min left"
// - a table of contents that follows you and ticks off the sections you've read (a sheet on phones)
// - "pick up where you left off" when you come back to a half-read guide
// - text size + focus mode, j / k to jump between sections, f for focus
// - a finish line: Bugsy cheers, the guide is marked read, the blog index shows ✓ Read / Continue · 40%

const KEY = 'bb-read-v1';
const PREFS = 'bb-read-prefs';
const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked (private window): the page still works, it just won't remember */
  }
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || '');
const bugsy = (text, mood = 'wave') => dispatchEvent(new CustomEvent('bugsy:say', { detail: { text, mood } }));

let toastTimer = 0;
const toast = (html, ms = 3000) => {
  let t = document.getElementById('read-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'read-toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  return t;
};
const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------- cards: ✓ Read / Continue · 40%
const marks = () => {
  const read = load(KEY, {});
  for (const card of document.querySelectorAll('.post-card[data-slug]')) {
    const r = read[card.dataset.slug];
    if (!r) continue;
    const tag = card.querySelector('.tag');
    const go = card.querySelector('.go');
    if (r.done) {
      card.classList.add('is-read');
      if (tag) tag.textContent = '✓ Read';
      if (go) go.textContent = 'Read it again →';
    } else if (r.p > 0.05) {
      card.classList.add('in-progress');
      card.style.setProperty('--p', r.p.toFixed(3));
      if (tag) tag.textContent = `Continue · ${Math.round(r.p * 100)}%`;
      if (go) go.textContent = 'Pick up where you left off →';
    }
  }
  const stat = document.getElementById('blog-progress');
  const cards = document.querySelectorAll('.blog-list .post-card[data-slug]');
  if (stat && cards.length) {
    const done = [...cards].filter((c) => read[c.dataset.slug]?.done).length;
    if (done) {
      stat.innerHTML = `<span class="dots-row" aria-hidden="true">${[...cards].map((c) => `<i class="${read[c.dataset.slug]?.done ? 'on' : ''}"></i>`).join('')}</span> You've read ${done} of ${cards.length} guides${done === cards.length ? ' 🏆' : ''}`;
    }
  }
};
marks();

// ---------------------------------------------------------------- a single post
const post = document.getElementById('post');
if (post) {
  const slug = post.dataset.slug;
  const minutes = Number(post.dataset.minutes) || 1;
  const root = document.documentElement;
  const finish = document.getElementById('finish');
  const side = document.querySelector('.post-side');
  const left = document.getElementById('toc-left');
  const links = [...document.querySelectorAll('#toc a[data-id]')];
  const sections = links.map((a) => document.getElementById(a.dataset.id)).filter(Boolean);
  const all = load(KEY, {});
  const me = (all[slug] ||= { p: 0, done: 0 });
  const startedDone = !!me.done;

  // progress bar under the header, with Bugsy crawling along it
  const bar = document.createElement('div');
  bar.className = 'read-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<i></i><img src="/img/icon-192.png" alt="" width="22" height="22">';
  (document.querySelector('.site-header') || document.body).append(bar);

  // phones: a pill at the bottom opens the table of contents as a sheet
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'toc-pill';
  pill.setAttribute('aria-controls', 'toc');
  pill.setAttribute('aria-expanded', 'false');
  pill.innerHTML = '<span class="ring" aria-hidden="true"></span><span class="pill-t">Contents</span><span class="pill-left"></span>';
  document.body.append(pill);
  const sheet = (open) => {
    side.classList.toggle('open', open);
    pill.setAttribute('aria-expanded', String(open));
  };
  pill.addEventListener('click', () => sheet(!side.classList.contains('open')));
  side.addEventListener('click', (e) => {
    if (e.target === side || e.target.closest('#toc a')) sheet(false);
  });

  // code blocks: put the copy button in the little window bar
  for (const fig of post.querySelectorAll('figure.code')) {
    const b = fig.querySelector('.copy');
    if (b) fig.querySelector('figcaption').append(b);
  }

  // "#" next to a heading copies a link to that section
  post.addEventListener('click', async (e) => {
    const a = e.target.closest('a.anchor');
    if (!a) return;
    if (await copy(location.origin + location.pathname + a.getAttribute('href'))) toast('🔗 Link to this section copied');
  });

  // share: copy link, and the phone's own share sheet when there is one
  const shareRow = finish?.querySelector('.share-row');
  shareRow?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy-link], [data-native-share]');
    if (!b) return;
    if (b.hasAttribute('data-native-share')) return navigator.share({ title: document.title, url: location.origin + location.pathname }).catch(() => {});
    b.textContent = (await copy(location.origin + location.pathname)) ? 'Link copied ✓' : 'Copy the address bar';
    setTimeout(() => (b.textContent = 'Copy link'), 1800);
  });
  if (navigator.share && matchMedia('(pointer: coarse)').matches && shareRow) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'share-btn';
    b.dataset.nativeShare = '';
    b.textContent = 'Share…';
    shareRow.prepend(b);
  }
  for (const k of document.querySelectorAll('.kbd-mod')) k.textContent = isMac ? '⌘' : 'Ctrl';

  // text size + focus mode (remembered)
  const SIZES = [16, 17.5, 19, 20.5, 22];
  const prefs = { size: 2, focus: false, ...load(PREFS, {}) };
  const focusBtn = document.querySelector('[data-focus]');
  const applyPrefs = () => {
    prefs.size = Math.max(0, Math.min(SIZES.length - 1, prefs.size));
    root.style.setProperty('--read-size', SIZES[prefs.size] + 'px');
    root.classList.toggle('reading-focus', !!prefs.focus);
    focusBtn?.setAttribute('aria-pressed', String(!!prefs.focus));
    for (const b of document.querySelectorAll('[data-size]')) b.disabled = prefs.size + Number(b.dataset.size) < 0 || prefs.size + Number(b.dataset.size) >= SIZES.length;
  };
  const setFocus = (on) => {
    prefs.focus = on;
    applyPrefs();
    save(PREFS, prefs);
    toast(on ? '🧘 Focus mode on. Press <kbd>F</kbd> or <kbd>Esc</kbd> to leave it.' : 'Focus mode off');
  };
  document.querySelector('.read-tools')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.size) {
      // keep the reader's place while the text reflows
      const anchor = sections.find((s) => s.getBoundingClientRect().top > 0) || finish;
      const before = anchor?.getBoundingClientRect().top;
      prefs.size += Number(b.dataset.size);
      applyPrefs();
      save(PREFS, prefs);
      if (anchor) scrollBy(0, anchor.getBoundingClientRect().top - before);
    } else if (b.hasAttribute('data-focus')) setFocus(!prefs.focus);
  });
  applyPrefs();

  // keyboard: j / k = next / previous section, f = focus mode, Esc = leave it
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable], dialog')) return;
    const k = e.key.toLowerCase();
    if (k === 'f') setFocus(!prefs.focus);
    else if (k === 'escape' && prefs.focus) setFocus(false);
    else if (k === 'j' || k === 'k') {
      const y = 90;
      const target = k === 'j' ? sections.find((s) => s.getBoundingClientRect().top > y + 4) : [...sections].reverse().find((s) => s.getBoundingClientRect().top < y - 4);
      if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      else if (k === 'k') scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  // reading time actually spent on the page (only while the tab is visible)
  let spent = 0;
  setInterval(() => {
    if (!document.hidden) spent++;
  }, 1000);

  // the finish line
  let celebrated = false;
  const celebrate = () => {
    if (celebrated) return;
    celebrated = true;
    const read = load(KEY, {});
    read[slug] = { ...me, p: 1, done: 1, t: Date.now() };
    save(KEY, read);
    const total = Number(post.dataset.total) || 0;
    const doneCount = Object.keys(read).filter((s) => read[s].done).length;
    const mins = Math.max(1, Math.round(spent / 60));
    const fast = spent < minutes * 60 * 0.3;
    const stat = document.getElementById('finish-stat');
    const kick = document.getElementById('finish-k');
    if (kick) kick.textContent = startedDone ? 'Read again ✓' : fast ? 'Speed-read! ⚡' : `Finished in ${mins} min 🎉`;
    if (stat && total > 1) {
      stat.hidden = false;
      stat.textContent = doneCount >= total ? `🏆 You've read every guide on the blog (${total} of ${total}). New ones land every week.` : `✓ That's ${Math.min(doneCount, total)} of ${total} guides. The next one is just below.`;
    }
    finish.classList.add('done');
    bar.classList.add('done');
    if (!reduceMotion && !startedDone) {
      const burst = document.createElement('div');
      burst.className = 'confetti';
      burst.setAttribute('aria-hidden', 'true');
      const colors = ['#ffd400', '#ff3d8b', '#22d3ee', '#a855f7', '#22c55e'];
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('i');
        const a = (Math.PI * 2 * i) / 26 + Math.random() * 0.3;
        const d = 90 + Math.random() * 110;
        s.style.setProperty('--x', `${Math.cos(a) * d}px`);
        s.style.setProperty('--y', `${Math.sin(a) * d - 60}px`);
        s.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
        s.style.background = colors[i % colors.length];
        burst.append(s);
      }
      finish.querySelector('.finish-top img')?.after(burst);
      setTimeout(() => burst.remove(), 1600);
    }
    if (!startedDone) bugsy(fast ? 'Speed-reader! 😄 Bookmark it for later: ' + (isMac ? '⌘' : 'Ctrl') + '+D' : 'You made it! 🎉 Bookmark this one: ' + (isMac ? '⌘' : 'Ctrl') + '+D', 'laughing');
  };

  // scroll: progress, minutes left, current section, resume point
  let halfway = me.p >= 0.5;
  let last = -1;
  let saveTimer = 0;
  const onScroll = () => {
    const top = post.getBoundingClientRect().top + scrollY;
    const end = finish.getBoundingClientRect().top + scrollY + 120;
    const p = Math.max(0, Math.min(1, (scrollY + innerHeight * 0.6 - top) / (end - top)));
    bar.style.setProperty('--p', p.toFixed(4));
    bar.classList.toggle('started', p > 0.01);
    pill.style.setProperty('--p', p.toFixed(4));
    const mins = Math.ceil(minutes * (1 - p) - 0.05);
    const leftText = p >= 0.995 ? 'Done ✓' : mins <= 0 ? '< 1 min left' : `${mins} min left`;
    if (left) left.textContent = leftText;
    pill.querySelector('.pill-left').textContent = leftText;

    // current section = last heading above the top fifth of the screen
    let cur = -1;
    sections.forEach((s, i) => {
      if (s.getBoundingClientRect().top < innerHeight * 0.22) cur = i;
    });
    if (cur !== last) {
      last = cur;
      links.forEach((a, i) => {
        a.classList.toggle('passed', i < cur);
        if (i === cur) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      pill.querySelector('.pill-t').textContent = cur >= 0 ? links[cur].textContent : 'Contents';
      // keep the current section visible inside a long contents list
      const box = document.getElementById('toc');
      const a = links[cur];
      if (a && box.scrollHeight > box.clientHeight) {
        const top = a.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        if (top < box.scrollTop + 40 || top > box.scrollTop + box.clientHeight - 60) box.scrollTop = top - box.clientHeight / 3;
      }
    }
    if (p > (me.p || 0)) me.p = p;
    if (cur >= 0) me.at = sections[cur].id;
    if (!halfway && p >= 0.5 && minutes >= 3) {
      halfway = true;
      bugsy('Halfway there 💪', 'wave');
    }
    if (p >= 0.995 || finish.getBoundingClientRect().top < innerHeight * 0.75) celebrate();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const read = load(KEY, {});
      read[slug] = { ...read[slug], p: Math.max(me.p, read[slug]?.p || 0), at: me.at, done: read[slug]?.done || 0, t: Date.now() };
      save(KEY, read);
    }, 400);
  };
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      onScroll();
    });
  }, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  // welcome back: offer to jump to where they stopped
  const resumeAt = !location.hash && !me.done && me.p > 0.08 && me.at && document.getElementById(me.at);
  onScroll();
  if (resumeAt) {
    const label = links.find((a) => a.dataset.id === me.at)?.textContent || 'where you were';
    const t = toast('', 0);
    t.innerHTML = `<span>👋 Welcome back! You were at <strong></strong></span><button type="button" class="btn btn-primary" data-go>Continue</button><button type="button" class="x" aria-label="Dismiss">✕</button>`;
    t.querySelector('strong').textContent = label;
    t.classList.add('resume');
    const close = () => t.classList.remove('show', 'resume');
    t.querySelector('[data-go]').addEventListener('click', () => {
      close();
      resumeAt.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    t.querySelector('.x').addEventListener('click', close);
    toastTimer = setTimeout(close, 14000);
  }
}
