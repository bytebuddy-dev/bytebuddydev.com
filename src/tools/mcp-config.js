// MCP config generator + converter (bytebuddydev.com/tools/mcp-config-generator/). Runs fully in the browser.
// Layout: two tabs (Create / Convert). Left = what you pick or paste, right = the result with the app as tabs.
import { SERVERS } from './mcp-servers.js';
import { CLIENTS, entryFor, fixEntry, lintConfig, varsOf } from './mcp-format.js';
import { escapeHtml as esc } from './skill-rules.js';
import { copyText, download, renderChecks } from './ui.js';

const $ = (s) => document.querySelector(s);
const byId = Object.fromEntries(SERVERS.map((s) => [s.id, s]));
const POPULAR = ['github', 'playwright', 'context7', 'filesystem', 'chrome-devtools', 'supabase', 'linear', 'notion', 'figma', 'sentry'];
const osGuess = () => {
  const p = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  return p.includes('win') ? 'win' : p.includes('mac') ? 'mac' : 'linux';
};
const state = { app: 'claude-code', cvApp: 'claude-code', os: osGuess(), scope: 'project', q: '', showAll: false, picked: new Map(), custom: [], cv: { entries: [], fixes: [] } };
const defaults = (sv) => ({ mode: sv.remote ? 'remote' : 'local', auth: sv.defaultAuth || (sv.remote?.oauth ? 'oauth' : 'none'), params: {} });
const cleanName = (s) => String(s).trim().replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const client = (id) => CLIENTS.find((c) => c.id === id);
const OS_NAMES = { mac: 'macOS', win: 'Windows', linux: 'Linux' };

// ---------------------------------------------------------------- tabs
const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
const showTab = (id, focus) => {
  for (const t of tabs) {
    const on = t.id === id;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  }
};
for (const t of tabs) {
  t.addEventListener('click', () => {
    showTab(t.id);
    history.replaceState(null, '', t.id === 't-convert' ? '#convert' : location.pathname + location.search);
  });
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') showTab(tabs[(tabs.indexOf(t) + 1) % tabs.length].id, true);
  });
}

// ---------------------------------------------------------------- servers (left side of Create)
const srvBox = $('#mc-servers');
const allBtn = $('#mc-all');
const renderServers = () => {
  const q = state.q;
  let list = q ? SERVERS.filter((s) => `${s.name} ${s.desc} ${s.cat}`.toLowerCase().includes(q)) : state.showAll ? SERVERS : SERVERS.filter((s) => POPULAR.includes(s.id) || state.picked.has(s.id));
  if (!q && !state.showAll) list = [...list].sort((a, b) => POPULAR.indexOf(a.id) - POPULAR.indexOf(b.id));
  const chips = list.map((s) => {
    const on = state.picked.has(s.id);
    return `<button type="button" class="pick${on ? ' on' : ''}" data-id="${s.id}" aria-pressed="${on}" title="${esc(s.desc)}"><span class="ic" aria-hidden="true">${s.icon}</span>${esc(s.name)}<span class="tick" aria-hidden="true">${on ? '✓' : '+'}</span></button>`;
  });
  const custom = state.custom.map((e, i) => `<button type="button" class="pick on" data-custom="${i}" aria-pressed="true" title="Click to remove"><span class="ic" aria-hidden="true">🔧</span>${esc(e.name)}<span class="tick" aria-hidden="true">✕</span></button>`);
  srvBox.innerHTML = chips.length + custom.length ? chips.join('') + custom.join('') : `<p class="meta">No server matches “${esc(q)}”. Add it under <strong>More options</strong>.</p>`;
  allBtn.hidden = !!q;
  allBtn.textContent = state.showAll ? 'Show fewer' : `Show all ${SERVERS.length} servers`;
};
srvBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id], [data-custom]');
  if (!b) return;
  if (b.dataset.custom) state.custom.splice(+b.dataset.custom, 1);
  else state.picked.has(b.dataset.id) ? state.picked.delete(b.dataset.id) : state.picked.set(b.dataset.id, defaults(byId[b.dataset.id]));
  refreshCreate();
});
allBtn.addEventListener('click', () => {
  state.showAll = !state.showAll;
  renderServers();
});
$('#mc-q').addEventListener('input', (e) => {
  state.q = e.target.value.toLowerCase().trim();
  renderServers();
});

// required inputs only (folders for Filesystem, the repo for Git); everything optional lives in More options
const needsBox = $('#mc-needs');
const paramsOf = (s, o) => ((o.mode === 'remote' ? s.remote?.params : s.local?.params) || []);
const paramInput = (id, p, v) =>
  p.check
    ? `<label class="check mini"><input type="checkbox" data-param="${p.id}" data-for="${id}"${v ? ' checked' : ''}><span><span>${esc(p.label)}</span></span></label>`
    : p.list
      ? `<label>${esc(p.label)} <small>${esc(p.hint)}</small><textarea rows="2" spellcheck="false" data-param="${p.id}" data-for="${id}">${esc(v)}</textarea></label>`
      : `<label>${esc(p.label)} <small>${esc(p.hint)}</small><input spellcheck="false" data-param="${p.id}" data-for="${id}" value="${esc(v)}"></label>`;
const pval = (o, p) => o.params[p.id] ?? (p.check ? p.on : p[state.os] ?? '');
const renderNeeds = () => {
  const rows = [...state.picked].flatMap(([id, o]) => {
    const s = byId[id];
    return paramsOf(s, o)
      .filter((p) => !p.query)
      .map((p) => `<div class="need"><span class="need-for">${s.icon} ${esc(s.name)}</span>${paramInput(id, p, pval(o, p))}</div>`);
  });
  needsBox.innerHTML = rows.join('');
};

// More options: per-server choices + Claude Code scope + your own server
const selBox = $('#mc-selected');
const seg = (name, value, opts) => `<div class="seg mini" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}"${v === value ? ' checked' : ''}> ${l}</label>`).join('')}</div>`;
const renderOptions = () => {
  const rows = [...state.picked].flatMap(([id, o]) => {
    const s = byId[id];
    const parts = [];
    if (s.remote && s.local) parts.push(seg(`mode-${id}`, o.mode, [['remote', 'Remote (hosted)'], ['local', 'Local (on your computer)']]));
    if (o.mode === 'remote' && s.remote?.key)
      parts.push(s.remote.oauth ? seg(`auth-${id}`, o.auth, [['oauth', 'Sign in'], ['key', 'API key']]) : seg(`auth-${id}`, o.auth, [['none', 'No key (free tier)'], ['key', 'API key']]));
    for (const p of paramsOf(s, o).filter((x) => x.query)) parts.push(paramInput(id, p, pval(o, p)));
    if (!parts.length) return [];
    return [`<div class="srv-opt"><div class="srv-opt-head"><span>${s.icon}</span><strong>${esc(s.name)}</strong><a href="${s.docs}" rel="noopener" target="_blank">docs ↗</a></div>${parts.join('')}${s.note ? `<p class="srv-note">${esc(s.note)}</p>` : ''}</div>`];
  });
  const scope = state.app === 'claude-code'
    ? `<label class="scope-row">Claude Code commands save to <select id="mc-scope" class="mini"><option value="project"${state.scope === 'project' ? ' selected' : ''}>this project (.mcp.json, shared)</option><option value="user"${state.scope === 'user' ? ' selected' : ''}>all your projects</option><option value="local"${state.scope === 'local' ? ' selected' : ''}>just you, this project</option></select></label>`
    : '';
  selBox.innerHTML = scope + (rows.length ? rows.join('') : '<p class="meta" style="margin:0">The servers you picked have no extra options.</p>');
};
const onParam = (t) => {
  if (t.id === 'mc-scope') return (state.scope = t.value), true;
  const m = /^(mode|auth)-(.+)$/.exec(t.name || '');
  if (m) {
    state.picked.get(m[2])[m[1]] = t.value;
    renderNeeds();
    renderOptions();
    return true;
  }
  if (t.dataset.param) return (state.picked.get(t.dataset.for).params[t.dataset.param] = t.type === 'checkbox' ? t.checked : t.value), true;
  return false;
};
for (const box of [needsBox, selBox]) {
  box.addEventListener('change', (e) => onParam(e.target) && renderCreate());
  box.addEventListener('input', (e) => e.target.dataset.param && e.target.type !== 'checkbox' && onParam(e.target) && renderCreate());
}

// your own server
const splitCmd = (s) => [...s.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2] ?? m[3]));
const kv = (text, sep) =>
  Object.fromEntries(
    text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(sep);
        return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
const cf = $('#mc-custom');
const syncCustomKind = () => {
  const local = cf.querySelector('input[name="ckind"]:checked').value === 'stdio';
  $('#mc-c-cmd').hidden = $('#mc-c-env').hidden = !local;
  $('#mc-c-url').hidden = $('#mc-c-headers').hidden = local;
};
cf.addEventListener('change', syncCustomKind);
syncCustomKind();
$('#mc-c-add').addEventListener('click', () => {
  const msg = $('#mc-c-msg');
  const local = cf.querySelector('input[name="ckind"]:checked').value === 'stdio';
  const name = cleanName($('#mc-c-name input').value);
  if (!name) return (msg.textContent = 'Give it a name (letters, numbers, - and _).');
  if (state.picked.has(name) || state.custom.some((e) => e.name === name)) return (msg.textContent = `There's already a server called "${name}".`);
  let e;
  if (local) {
    const [command, ...args] = splitCmd($('#mc-c-cmd input').value.trim());
    if (!command) return (msg.textContent = 'Type the command that starts the server, e.g. npx -y my-mcp-server');
    const env = Object.fromEntries(Object.entries(kv($('#mc-c-env textarea').value, '=')).map(([k, v]) => [k, v || `\${${k}}`]));
    e = { name, transport: 'stdio', command, args, env, url: '', headers: {} };
  } else {
    const url = $('#mc-c-url input').value.trim();
    if (!/^https?:\/\/\S+$/.test(url)) return (msg.textContent = 'Paste the server URL, starting with https://');
    e = { name, transport: /\/sse\/?(\?|$)/.test(url) ? 'sse' : 'http', command: '', args: [], env: {}, url, headers: kv($('#mc-c-headers textarea').value, ':') };
  }
  state.custom.push(e);
  msg.textContent = `Added ${name}.`;
  cf.querySelectorAll('input:not([type=radio]), textarea').forEach((x) => (x.value = ''));
  refreshCreate();
});

// ---------------------------------------------------------------- the result card (shared by both tabs)
const envCmd = (v) => (state.os === 'win' ? `setx ${v} "paste-your-key-here"` : `echo 'export ${v}="paste-your-key-here"' >> ~/${state.os === 'mac' ? '.zshrc' : '.bashrc'}`);
const hintFor = (v) => {
  for (const s of SERVERS) {
    if (s.local?.env?.[v]) return s.local.env[v].hint;
    if (s.remote?.key?.var === v) return `your ${s.name} API key`;
  }
  return 'the value from your old config';
};
const texts = new WeakMap(); // result box → current file text + name
function renderResult(box, { appId, entries, fixes = [], empty, share }) {
  const c = client(appId);
  const appTabs = `<div class="app-tabs" role="group" aria-label="Your app">${CLIENTS.map((x) => `<button type="button" class="app-tab${x.id === appId ? ' on' : ''}" data-app="${x.id}" aria-pressed="${x.id === appId}"><span aria-hidden="true">${x.icon}</span>${esc(x.name)}</button>`).join('')}</div>`;
  if (!entries.length) {
    texts.set(box, null);
    box.innerHTML = `${appTabs}<div class="res-empty"><span aria-hidden="true">🔌</span><p>${empty}</p></div>`;
    return;
  }
  const res = c.emit(entries, { scope: state.scope });
  texts.set(box, { text: res.text, file: c.file });
  const [mainLabel, mainPath] = c.paths[0];
  const others = c.paths.slice(1).map(([l, p]) => `${esc(l)}: <code>${esc(p[state.os])}</code>`);
  const vars = varsOf(entries);
  const callouts = [];
  if (fixes.length) callouts.push(`<div class="callout good"><strong>✅ Fixed while converting</strong><ul>${fixes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`);
  if (vars.length) {
    if (c.id === 'vscode') callouts.push(`<div class="callout"><strong>🔑 VS Code asks for your API key</strong> the first time the server starts, and stores it safely.</div>`);
    else if (c.interp)
      callouts.push(`<div class="callout"><strong>🔑 Add your API key once</strong> <small>(${vars.map((v) => esc(hintFor(v))).join(', ')})</small><pre><code>${esc(vars.map(envCmd).join('\n'))}</code></pre><small>Paste your key in place of <code>paste-your-key-here</code>, run it in a terminal, then restart ${esc(c.name)}. The key never goes in the file.</small></div>`);
    else callouts.push(`<div class="callout"><strong>🔑 Put your key in the file</strong>: replace ${vars.map((v) => `<code>&lt;${esc(v)}&gt;</code>`).join(', ')}. ${esc(c.name)} can't read keys from your computer, so keep this file private.</div>`);
  }
  if (entries.some((e) => e.oauth)) callouts.push(`<div class="callout"><strong>🔐 Sign-in:</strong> ${c.oauth}</div>`);
  const cli = res.cli || [];
  const links = res.links || [];
  const more = [];
  if (cli.length) more.push(`<details><summary>Or add ${cli.length > 1 ? 'them' : 'it'} with a terminal command</summary><pre class="cli"><code>${esc(cli.join('\n'))}</code></pre><button type="button" class="chip" data-act="copy-cli" data-label="Copy commands">Copy commands</button></details>`);
  if (links.length) more.push(`<details><summary>Or install with one click in ${esc(c.name)}</summary><div class="btns">${links.map((l) => `<a class="chip" href="${esc(l.href)}">+ ${esc(l.label)}</a>`).join('')}</div></details>`);
  if (res.notes?.length) more.push(`<details><summary>Notes for ${esc(c.name)}</summary><ul>${res.notes.map((n) => `<li>${n}</li>`).join('')}</ul></details>`);
  box.innerHTML = `${appTabs}
<div class="res-file"><span class="fname">📄 ${esc(c.file)}</span>
<label class="os">Your computer <select data-os class="mini" aria-label="Your computer">${Object.entries(OS_NAMES).map(([k, v]) => `<option value="${k}"${k === state.os ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
<p class="save save-line">Save it in ${esc(mainLabel.toLowerCase())}: <code>${esc(mainPath[state.os])}</code></p></div>
${others.length ? `<p class="also">Or: ${others.join(' · ')}</p>` : ''}
<pre class="out"><code>${esc(res.text)}</code></pre>
<div class="res-actions"><button type="button" class="btn btn-primary" data-act="copy" data-label="Copy config">Copy config</button><button type="button" class="btn btn-ghost" data-act="dl" data-label="Download">Download</button>${share ? '<button type="button" class="link-btn" data-act="share" data-label="Copy a link to this setup">Copy a link to this setup</button>' : ''}</div>
${callouts.join('')}
${more.length ? `<div class="more">${more.join('')}</div>` : ''}`;
}
const wireResult = (box, onApp, cur) => {
  box.addEventListener('click', (e) => {
    const t = e.target.closest('[data-app], [data-act]');
    if (!t) return;
    if (t.dataset.app) return onApp(t.dataset.app);
    const now = texts.get(box);
    const act = t.dataset.act;
    if (act === 'copy' && now) copyText(t, now.text);
    if (act === 'dl' && now) download(now.file, now.text);
    if (act === 'copy-cli') copyText(t, box.querySelector('pre.cli').textContent);
    if (act === 'share') copyText(t, shareUrl());
  });
  box.addEventListener('change', (e) => {
    if (e.target.matches('[data-os]')) {
      state.os = e.target.value;
      renderNeeds();
      renderCreate();
      renderConvert();
    }
  });
  return cur;
};

// ---------------------------------------------------------------- Create
const createBox = $('#mc-result');
const createEntries = () => [...[...state.picked].map(([id, o]) => entryFor(byId[id], o, state.os)), ...state.custom];
const renderCreate = () => renderResult(createBox, { appId: state.app, entries: createEntries(), empty: 'Pick a server on the left. Your config appears here, ready to copy.', share: true });
const refreshCreate = () => {
  renderServers();
  renderNeeds();
  renderOptions();
  renderCreate();
};
wireResult(createBox, (id) => {
  state.app = id;
  renderOptions();
  renderCreate();
});
const shareUrl = () => {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('app', state.app);
  if (state.picked.size)
    u.searchParams.set('servers', [...state.picked].map(([id, o]) => [id, o.mode === 'local' && byId[id].remote ? 'local' : '', o.auth === 'key' && byId[id].defaultAuth !== 'key' ? 'key' : ''].join(':').replace(/:+$/, '')).join(','));
  return u.toString();
};

// ---------------------------------------------------------------- Convert
const cvIn = $('#cv-in');
const cvBox = $('#cv-result');
const renderConvert = () => renderResult(cvBox, { appId: state.cvApp, entries: state.cv.entries, fixes: state.cv.fixes, empty: 'Paste a config on the left (or load an example), then pick the app you want it for.' });
wireResult(cvBox, (id) => {
  state.cvApp = id;
  renderConvert();
});
const convert = () => {
  const text = cvIn.value;
  if (!text.trim()) {
    $('#cv-checks').innerHTML = '';
    state.cv = { entries: [], fixes: [] };
    return renderConvert();
  }
  const { results, parsed } = lintConfig(text, 'auto');
  renderChecks($('#cv-checks'), results.map((r) => (r.level === 'info' ? { ...r, text: esc(r.text) } : r)), 'Looks good');
  const fixes = [];
  const used = new Set();
  const entries = (parsed.entries || []).map((e0) => {
    let name = cleanName(e0.name) || 'server';
    while (used.has(name)) name += '-2';
    used.add(name);
    const { entry, fixes: f } = fixEntry({ ...e0, name });
    fixes.push(...f);
    return entry;
  });
  // converting TOML → default to Claude Code; Claude-style JSON → default to Codex, so the output is visibly different
  if (!convert.touched && entries.length) state.cvApp = parsed.key === 'mcp_servers' ? 'claude-code' : parsed.key === 'servers' ? 'cursor' : 'codex';
  state.cv = { entries, fixes };
  renderConvert();
};
cvBox.addEventListener('click', (e) => e.target.closest('[data-app]') && (convert.touched = true));
cvIn.addEventListener('input', convert);
$('#cv-sample').addEventListener('click', () => {
  const fakeToken = 'gh' + 'p_' + 'Ab12Cd34Ef56Gh78Ij90Kl12Mn34Op56Qr78'; // built at runtime so the repo never contains a token-shaped string
  cvIn.value = JSON.stringify(
    {
      mcpServers: {
        github: { command: 'npx', args: ['@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: fakeToken } },
        linear: { url: 'https://mcp.linear.app/mcp' },
        playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
      },
    },
    null,
    2,
  );
  convert();
});

// ---------------------------------------------------------------- start: ?app=cursor&servers=github,playwright:local  ·  #convert
{
  const sp = new URLSearchParams(location.search);
  if (client(sp.get('app'))) state.app = sp.get('app');
  for (const tok of (sp.get('servers') || '').split(',').filter(Boolean)) {
    const [id, ...flags] = tok.split(':');
    if (!byId[id]) continue;
    const o = defaults(byId[id]);
    if (flags.includes('local') && byId[id].local) o.mode = 'local';
    if (flags.includes('key') && byId[id].remote?.key) o.auth = 'key';
    state.picked.set(id, o);
  }
  if (!state.picked.size && !sp.has('app')) for (const id of ['playwright', 'context7']) state.picked.set(id, defaults(byId[id]));
  refreshCreate();
  renderConvert();
  if (/^#conver/.test(location.hash)) showTab('t-convert');
}
