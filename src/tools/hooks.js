// Claude Code hooks generator + checker (bytebuddydev.com/tools/claude-code-hooks-generator/). Runs fully in the browser.
// Layout: tabs (Create / Check) · what you want on the left · the finished settings.json on the right.
import { DEFAULT_PICKS, RECIPES } from './hooks-recipes.js';
import { lintHooks } from './hooks-rules.js';
import { escapeHtml as esc } from './skill-rules.js';
import { copyText, download, renderChecks, setupTabs, statusCallout } from './ui.js';

const $ = (s) => document.querySelector(s);
const form = $('#hk');
form.addEventListener('submit', (e) => e.preventDefault());
const showTab = setupTabs({ 't-check': 'check' });
const osGuess = () => {
  const p = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  return p.includes('win') ? 'win' : p.includes('mac') ? 'mac' : 'linux';
};
const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const state = { picked: new Set(DEFAULT_PICKS), os: osGuess(), scope: 'user', params: {} };
const param = (r, p) => state.params[`${r.id}.${p.id}`] ?? p.value;

// ---------------------------------------------------------------- build settings.json
const handler = (r) => {
  const values = Object.fromEntries((r.params || []).map((p) => [p.id, param(r, p)]));
  const h = { type: 'command', command: state.os === 'win' ? r.win(values) : r.nix(values, state.os) };
  if (state.os === 'win') h.shell = 'powershell';
  if (r.timeout) h.timeout = r.timeout;
  return h;
};
const buildHooks = () => {
  const hooks = {};
  for (const r of RECIPES.filter((x) => state.picked.has(x.id))) {
    const list = (hooks[r.event] ||= []);
    let group = list.find((g) => (g.matcher || '') === (r.matcher || ''));
    if (!group) list.push((group = r.matcher ? { matcher: r.matcher, hooks: [] } : { hooks: [] }));
    group.hooks.push(handler(r));
  }
  return hooks;
};
/** Adds our hooks to the user's existing settings.json, skipping any command that's already there. */
const merge = (existing, hooks) => {
  const out = { ...existing, hooks: { ...(existing.hooks || {}) } };
  for (const [event, groups] of Object.entries(hooks)) {
    const have = (out.hooks[event] = [...(out.hooks[event] || [])]);
    for (const g of groups) {
      const seen = new Set(have.flatMap((x) => (x.hooks || []).map((h) => h.command)));
      const fresh = g.hooks.filter((h) => !seen.has(h.command));
      if (!fresh.length) continue;
      const same = have.find((x) => (x.matcher || '') === (g.matcher || '') && Array.isArray(x.hooks));
      if (same) same.hooks = [...same.hooks, ...fresh];
      else have.push({ ...g, hooks: fresh });
    }
  }
  return out;
};
const build = () => {
  const hooks = buildHooks();
  const raw = form.elements.existing.value.trim();
  let mergeErr = '';
  let json = { hooks };
  if (raw) {
    try {
      const ex = JSON.parse(raw);
      if (!ex || typeof ex !== 'object' || Array.isArray(ex)) throw new Error('not an object');
      json = merge(ex, hooks);
    } catch {
      mergeErr = 'Your current settings.json isn\'t valid JSON, so it wasn\'t merged. Fix it in the Check tab first.';
    }
  }
  return { text: JSON.stringify(json, null, 2) + '\n', mergeErr, merged: !!raw && !mergeErr };
};

// ---------------------------------------------------------------- result (right side of Create)
const SCOPES = {
  user: { tab: 'All my projects', file: '~/.claude/settings.json', win: '%USERPROFILE%\\.claude\\settings.json', also: 'Works in every project on this computer. Best for notifications and personal safety rules.' },
  project: { tab: 'This project', file: '.claude/settings.json', also: 'Save it in your repo and commit it, so everyone on your team gets the same hooks.' },
  local: { tab: 'Just me, this project', file: '.claude/settings.local.json', also: 'Only for you, in this repo. Claude Code keeps it out of git when it creates the file; if you create it yourself, add it to .gitignore.' },
};
const res = $('#hk-result');
res.innerHTML = `<div class="app-tabs" id="hk-scopes" role="group" aria-label="Where should the hooks apply?"></div>
<div class="res-file"><p class="save save-line" id="hk-save"></p></div>
<p class="also" id="hk-also"></p>
<pre class="out"><code id="hk-out"></code></pre>
<div class="res-actions"><button type="button" class="btn btn-primary" data-act="copy" data-label="Copy settings.json">Copy settings.json</button><button type="button" class="btn btn-ghost" data-act="dl" data-label="Download">Download</button></div>
<div id="hk-status"></div>
<div class="more"><details><summary>How each hook works</summary><div id="hk-how"></div></details></div>`;

let current = build();
const NEEDS_JQ = (r) => /\bjq\b/.test(r.nix(Object.fromEntries((r.params || []).map((p) => [p.id, p.value])), 'mac'));
const generate = () => {
  current = build();
  const sc = SCOPES[state.scope];
  $('#hk-scopes').innerHTML = Object.entries(SCOPES)
    .map(([k, s]) => `<button type="button" class="app-tab${k === state.scope ? ' on' : ''}" data-scope="${k}" aria-pressed="${k === state.scope}">${s.tab}</button>`)
    .join('');
  const file = state.os === 'win' && sc.win ? sc.win : sc.file;
  $('#hk-save').innerHTML = `${current.merged ? 'Replace' : 'Save as'} <code>${esc(file)}</code>`;
  $('#hk-also').textContent = sc.also;
  $('#hk-out').textContent = current.text;
  const picked = RECIPES.filter((r) => state.picked.has(r.id));
  const needs = new Set();
  if (state.os !== 'win' && picked.some(NEEDS_JQ)) needs.add(state.os === 'mac' ? 'jq (brew install jq)' : 'jq (sudo apt install jq)');
  for (const r of picked) for (const k of ['all', state.os]) if (r.needs?.[k]) needs.add(r.needs[k]);
  const status = [];
  if (current.mergeErr) status.push(`<div class="callout bad"><strong>❌ ${esc(current.mergeErr)}</strong></div>`);
  if (!picked.length) status.push(`<div class="callout meh"><strong>Pick at least one hook on the left.</strong></div>`);
  else
    status.push(
      `<div class="callout ${needs.size ? 'meh' : 'good'}"><strong>${needs.size ? '⚠️ Install first' : '✅ Nothing to install'}</strong>${needs.size ? `<ul>${[...needs].map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}<p class="callout-p">${
        current.merged ? 'Your existing settings are kept; the new hooks are added to them.' : 'Already have this file? Paste it under <strong>Customize</strong> and we\'ll merge the hooks into it.'
      } Then type <code>/hooks</code> in Claude Code to check they loaded.</p></div>`,
    );
  $('#hk-status').innerHTML = status.join('');
  $('#hk-how').innerHTML = picked.length
    ? `<ul class="how-list">${picked
        .map((r) => `<li><strong>${r.icon} ${esc(r.title)}</strong> <code>${r.event}${r.matcher ? ` · ${esc(r.matcher)}` : ''}</code><br>${esc(r.sub)}${r.note ? ` <em>${esc(r.note)}</em>` : ''}</li>`)
        .join('')}</ul>`
    : '';
};
res.addEventListener('click', (e) => {
  const t = e.target.closest('[data-scope], [data-act]');
  if (!t) return;
  if (t.dataset.scope) {
    state.scope = t.dataset.scope;
    return generate();
  }
  if (t.dataset.act === 'copy') copyText(t, current.text);
  if (t.dataset.act === 'dl') download('settings.json', current.text);
});

// ---------------------------------------------------------------- picks + options (left side)
const picks = $('#hk-picks');
const renderPicks = () => {
  picks.innerHTML = RECIPES.map((r) => {
    const on = state.picked.has(r.id);
    return `<button type="button" class="pick${on ? ' on' : ''}" data-id="${r.id}" aria-pressed="${on}" title="${esc(r.sub)}"><span class="ic" aria-hidden="true">${r.icon}</span>${esc(r.title)}<span class="tick" aria-hidden="true">${on ? '✓' : '+'}</span></button>`;
  }).join('');
  const rows = RECIPES.filter((r) => state.picked.has(r.id) && r.params).flatMap((r) =>
    r.params.map((p) => {
      const v = param(r, p);
      const field = v.includes('\n') || p.id === 'files' ? `<textarea rows="3" spellcheck="false" data-param="${r.id}.${p.id}">${esc(v)}</textarea>` : `<input spellcheck="false" data-param="${r.id}.${p.id}" value="${esc(v)}">`;
      return `<label>${r.icon} ${esc(p.label)} <small>${esc(p.hint)}</small>${field}</label>`;
    }),
  );
  $('#hk-params').innerHTML = rows.join('') || '<p class="meta" style="margin:0">The hooks you picked have nothing to set.</p>';
};
picks.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  state.picked.has(b.dataset.id) ? state.picked.delete(b.dataset.id) : state.picked.add(b.dataset.id);
  renderPicks();
  generate();
});
form.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.param) state.params[t.dataset.param] = t.value;
  if (t.name === 'os') state.os = t.value;
  generate();
});

// ---------------------------------------------------------------- Check tab
const ckIn = $('#ck-in');
const ckRes = $('#ck-result');
const check = () => {
  if (!ckIn.value.trim()) {
    ckRes.innerHTML = `<div class="res-empty"><span aria-hidden="true">🧪</span><p>Paste your settings.json on the left. We check the hook structure, event and tool names, script paths, Stop-hook loops and leaked keys.</p></div>`;
    return;
  }
  const results = lintHooks(ckIn.value);
  ckRes.innerHTML = `<h2 class="res-h">Result</h2>${statusCallout(results, 'Your hooks look right')}<div class="more"><details><summary>Every check we ran</summary><div id="ck-checks"></div></details></div>`;
  renderChecks($('#ck-checks'), results, 'Your hooks look right');
};
ckIn.addEventListener('input', check);
$('#ck-bad').addEventListener('click', () => {
  ckIn.value = JSON.stringify(
    {
      hooks: {
        postToolUse: [{ matcher: 'edit|write', hooks: [{ type: 'command', command: 'npx prettier --write .' }] }],
        PreToolUse: [{ matcher: 'MultiEdit', hooks: [{ type: 'command', command: './.claude/hooks/guard.sh' }] }],
        Stop: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'npm test || exit 2', timeout: '60' }] }],
        UserPromptSubmit: [{ type: 'command', command: 'echo hi' }],
      },
    },
    null,
    2,
  );
  check();
});

// ---------------------------------------------------------------- start
// ?hooks=notify,prettier&os=win picks hooks (Bugsy's chat uses it); #check opens the Check tab.
{
  const q = new URLSearchParams(location.search);
  const want = (q.get('hooks') || '').split(',').filter((id) => byId[id]);
  if (want.length) state.picked = new Set(want);
  if (['mac', 'linux', 'win'].includes(q.get('os'))) state.os = q.get('os');
  form.querySelector(`input[name="os"][value="${state.os}"]`).checked = true;
  renderPicks();
  generate();
  check();
  if (/^#check/.test(location.hash)) showTab('t-check');
}
