// Home page extras (bytebuddydev.com/): the "Try it right here" playground, the bookmark keys,
// and sections that slide in as you scroll. Runs fully in the browser, nothing is sent anywhere.
import { DANGER, RECIPES } from './tools/hooks-recipes.js';
import { SECRETS } from './tools/agents-rules.js';
import { escapeHtml as esc } from './tools/skill-rules.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || '');
for (const k of document.querySelectorAll('.kbd-mod')) k.textContent = isMac ? '⌘' : 'Ctrl';

// Bugsy reacts to the playground, but not more than every few seconds
let lastSay = 0;
const bugsy = (text, mood) => {
  if (performance.now() - lastSay < 2500) return;
  lastSay = performance.now();
  dispatchEvent(new CustomEvent('bugsy:say', { detail: { text, mood } }));
};

// ---------------------------------------------------------------- tabs
const tabs = [...document.querySelectorAll('.play-tabs [role=tab]')];
const select = (tab, focus) => {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
};
for (const t of tabs) {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(t);
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (j === null) return;
    e.preventDefault();
    select(tabs[(j + tabs.length) % tabs.length], true);
  });
}

// ---------------------------------------------------------------- 1. would this get blocked?
// The exact rule the "Block dangerous commands" hook uses (grep -Ei in the hook).
const danger = new RegExp(DANGER, 'i');
const cmd = $('#pl-cmd');
const cmdV = $('#pl-cmd-v');
const WHY = [
  [/rm -(rf|fr)/i, 'It deletes everything in your home or root folder, with no undo.'],
  [/git push/i, 'A force-push overwrites your team\'s work on the remote. --force-with-lease is the safe version.'],
  [/reset --hard/i, 'It throws away every change you haven\'t committed.'],
  [/drop/i, 'It deletes a whole table or database.'],
];
const SAMPLES = ['rm -rf ~', 'rm -rf node_modules', 'git push --force', 'git push --force-with-lease', 'git reset --hard', 'DROP TABLE users;', 'npm test'];
$('#pl-cmd-chips').innerHTML = SAMPLES.map((s) => `<button type="button" class="chip" data-cmd="${esc(s)}"><code>${esc(s)}</code></button>`).join('');
$('#pl-cmd-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cmd]');
  if (!b) return;
  cmd.value = b.dataset.cmd;
  checkCmd(true);
});
let wasBlocked = null;
const checkCmd = (fromUser) => {
  const c = cmd.value.trim();
  if (!c) {
    cmdV.className = 'verdict';
    cmdV.innerHTML = '<p>Type a command above.</p>';
    return;
  }
  const blocked = danger.test(c);
  cmdV.className = `verdict ${blocked ? 'bad' : 'good'}`;
  cmdV.innerHTML = blocked
    ? `<strong>✋ Blocked before it ran</strong><p>${esc(WHY.find(([r]) => r.test(c))?.[1] || 'It matches the dangerous-command rule.')} Claude is told why and picks a safer way.</p>`
    : `<strong>✅ Allowed</strong><p>Nothing dangerous here, so Claude runs it as usual.</p>`;
  if (fromUser && blocked !== wasBlocked) bugsy(blocked ? 'Whoa! Not on my watch 🛑' : 'That one\'s fine 👍', blocked ? 'angry' : 'laughing');
  wasBlocked = blocked;
};
cmd.addEventListener('input', () => checkCmd(true));
checkCmd(false);

// ---------------------------------------------------------------- 2. would this leak a key?
// The sample's fake keys are made here at runtime, so the repo never holds anything key-shaped.
const rnd = (n, abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => abc[x % abc.length]).join('');
const keys = $('#pl-keys');
const keysV = $('#pl-keys-v');
keys.value = [
  '# .env',
  'APP_NAME=my-side-project',
  `OPENAI_API_KEY=${'sk-' + 'proj-'}${rnd(40)}`,
  'DEBUG=true',
  `DATABASE_URL=${'postgres'}://admin:${rnd(14)}@db.example.com:5432/app`,
  `GITHUB_TOKEN=${'gh' + 'p_'}${rnd(36)}`,
  'PORT=3000',
].join('\n');
let hadLeaks = null;
const checkKeys = (fromUser) => {
  const found = [];
  keys.value.split(/\r?\n/).forEach((line, i) => {
    for (const [re, what] of SECRETS) {
      const m = re.exec(line);
      if (m) {
        found.push({ line: i + 1, what, peek: m[0].slice(0, 8) + '•••' });
        break;
      }
    }
  });
  if (!keys.value.trim()) {
    keysV.className = 'verdict';
    keysV.innerHTML = '<p>Paste something on the left.</p>';
    return;
  }
  keysV.className = `verdict ${found.length ? 'bad' : 'good'}`;
  keysV.innerHTML = found.length
    ? `<strong>😱 ${found.length} secret${found.length > 1 ? 's' : ''} would leak</strong><ul>${found.map((f) => `<li><span class="ln">Line ${f.line}</span> ${esc(f.what)} <code>${esc(f.peek)}</code></li>`).join('')}</ul><p>Move them to environment variables and add <code>.env</code> to <code>.gitignore</code>.</p>`
    : `<strong>✅ Nothing that looks like a key</strong><p>Safe to commit, as far as keys go.</p>`;
  const leaks = found.length > 0;
  if (fromUser && leaks !== hadLeaks) bugsy(leaks ? 'Yikes, that\'s a real-looking key! 😱' : 'Clean! Ship it 🚀', leaks ? 'shocked' : 'laughing');
  hadLeaks = leaks;
};
keys.addEventListener('input', () => checkKeys(true));
checkKeys(false);

// ---------------------------------------------------------------- 3. build a hooks file
const os = /win/i.test(navigator.userAgentData?.platform || navigator.platform || '') ? 'win' : isMac ? 'mac' : 'linux';
const PICKABLE = ['notify', 'done', 'danger', 'prettier', 'tests'];
const picked = new Set(['notify', 'danger']);
const recipes = RECIPES.filter((r) => PICKABLE.includes(r.id));
const hookChips = $('#pl-hooks-chips');
const out = $('#pl-hooks-out');
const renderHooks = () => {
  hookChips.innerHTML = recipes.map((r) => `<button type="button" class="chip${picked.has(r.id) ? ' on' : ''}" data-id="${r.id}" aria-pressed="${picked.has(r.id)}">${r.icon} ${esc(r.title)}</button>`).join('');
  const hooks = {};
  for (const r of recipes.filter((x) => picked.has(x.id))) {
    const values = Object.fromEntries((r.params || []).map((p) => [p.id, p.value]));
    const h = { type: 'command', command: os === 'win' ? r.win(values) : r.nix(values, os) };
    if (os === 'win') h.shell = 'powershell';
    if (r.timeout) h.timeout = r.timeout;
    const list = (hooks[r.event] ||= []);
    let g = list.find((x) => (x.matcher || '') === (r.matcher || ''));
    if (!g) list.push((g = r.matcher ? { matcher: r.matcher, hooks: [] } : { hooks: [] }));
    g.hooks.push(h);
  }
  out.textContent = picked.size ? JSON.stringify({ hooks }, null, 2) : '// Click a hook above';
  $('#pl-hooks-go').href = `/tools/claude-code-hooks-generator/?hooks=${[...picked].join(',')}&os=${os}`;
  out.parentElement.classList.remove('flash');
  void out.parentElement.offsetWidth;
  out.parentElement.classList.add('flash');
};
hookChips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  picked.has(b.dataset.id) ? picked.delete(b.dataset.id) : picked.add(b.dataset.id);
  renderHooks();
});
renderHooks();

// ---------------------------------------------------------------- "Ask Bugsy" in the shipped log opens the chat
document.querySelector('[data-open-chat]')?.addEventListener('click', () => $('#chat-launch')?.click());

// ---------------------------------------------------------------- bookmark keys light up as you press them
{
  const card = $('.bookmark-card');
  const mod = $('.key[data-key="mod"]');
  const d = $('.key[data-key="d"]');
  const up = () => {
    mod?.classList.remove('down');
    d?.classList.remove('down');
  };
  addEventListener('keydown', (e) => {
    if (!card) return;
    if (e.key === 'Control' || e.key === 'Meta') mod?.classList.add('down');
    if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) {
      mod?.classList.add('down');
      d?.classList.add('down');
      card.classList.add('done');
      $('#bm-done').hidden = false;
      lastSay = 0;
      bugsy('You bookmarked me? 🥹 Welcome to the hive!', 'laughing');
    }
  });
  addEventListener('keyup', up);
  // phones have no Ctrl + D: say how to bookmark there instead
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
    $('.bm-press')?.remove();
    $('.keys')?.replaceWith(Object.assign(document.createElement('p'), { className: 'bm-phone', textContent: 'On your phone: open the browser menu (⋮ or the share button) and tap ☆ Bookmark or Add to Home Screen.' }));
  }
  addEventListener('blur', up);
}

// ---------------------------------------------------------------- sections slide in as you scroll
if (!reduceMotion && 'IntersectionObserver' in window) {
  const secs = [...document.querySelectorAll('main > section:not(.hero)')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries)
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const s of secs) {
    // only hide what's below the fold, so nothing on screen blinks
    if (s.getBoundingClientRect().top > innerHeight) {
      s.classList.add('reveal');
      io.observe(s);
    }
  }
}
