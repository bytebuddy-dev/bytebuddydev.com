// AGENTS.md + CLAUDE.md generator and checker (bytebuddydev.com/tools/agents-md-generator/). Runs fully in the browser.
// Layout: tabs (Create / Check) · stack picks on the left · the finished files on the right.
import { BLANK, CMD_LABELS, RULES, STACKS } from './agents-stacks.js';
import { lintInstructions } from './agents-rules.js';
import { escapeHtml as esc } from './skill-rules.js';
import { copyText, download, renderChecks, setupTabs, statusCallout } from './ui.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#am');
const F = form.elements;
form.addEventListener('submit', (e) => e.preventDefault()); // Enter in a box must not reload the page
const showTab = setupTabs({ 't-check': 'check' });
const lines = (s) => s.split('\n').map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
const sentence = (s) => (/[.!?:]$/.test(s) ? s : s + '.');
const state = { stack: STACKS[0], file: 'agents' };

// ---------------------------------------------------------------- the dynamic parts of the form
$('#am-cmds').innerHTML = Object.entries(CMD_LABELS)
  .map(([k, label]) => `<label>${label}<input name="cmd-${k}" spellcheck="false" placeholder="—"></label>`)
  .join('');
$('#am-rules').innerHTML = RULES.map(
  (r) => `<label class="check"><input type="checkbox" name="rule-${r.id}"${r.on ? ' checked' : ''}><span><span>${esc(r.text).replace(/`([^`]+)`/g, '<code>$1</code>')}</span></span></label>`,
).join('');

const applyStack = (s) => {
  state.stack = s;
  if (s.pm) form.querySelector(`input[name="pm"][value="${s.pm}"]`).checked = true;
  const pm = F.pm.value;
  for (const k of Object.keys(CMD_LABELS)) {
    const v = s.cmds[k];
    F[`cmd-${k}`].value = typeof v === 'function' ? v(pm) : v ?? '';
  }
  F.about.value = s.about;
  F.codestyle.value = s.style.join('\n');
  F.structure.value = s.structure.join('\n');
  renderPicks();
  generate();
};

// ---------------------------------------------------------------- build the files
const buildBody = () => {
  const out = [`# ${F.name.value.trim() || 'Project instructions'}`, ''];
  const about = F.about.value.trim();
  if (about) out.push(sentence(about), '');
  const cmds = Object.entries(CMD_LABELS)
    .map(([k, label]) => [label, F[`cmd-${k}`].value.trim()])
    .filter(([, v]) => v);
  if (cmds.length) out.push('## Commands', '', ...cmds.map(([label, v]) => `- ${label}: \`${v}\``), '');
  const style = lines(F.codestyle.value);
  if (style.length) out.push('## Code style', '', ...style.map((s) => `- ${sentence(s)}`), '');
  const gotchas = lines(F.gotchas.value);
  if (gotchas.length) out.push('## Gotchas', '', ...gotchas.map((s) => `- ${sentence(s)}`), '');
  if (F.layout.checked) {
    const st = lines(F.structure.value);
    if (st.length) {
      out.push('## Project layout', '');
      st.forEach((s) => {
        const [path, ...rest] = s.split(/\s+[—–-]\s+/);
        out.push(rest.length ? `- \`${path.trim()}\`: ${rest.join(' - ')}` : `- ${s}`);
      });
      out.push('');
    }
  }
  const rules = RULES.filter((r) => F[`rule-${r.id}`].checked).map((r) => r.text);
  rules.push(...lines(F.extra.value).map(sentence));
  if (rules.length) out.push('## Rules', '', ...rules.map((s) => `- ${s}`), '');
  return out;
};

const build = () => {
  const mode = F.mode.value;
  const body = buildBody();
  const notes = lines(F.claude.value).map(sentence);
  const agents = body.join('\n').trimEnd() + '\n';
  const claude =
    mode === 'both'
      ? [
          '<!-- Shared rules live in AGENTS.md so every coding agent reads the same file. Claude Code-only notes go below the import. -->',
          '@AGENTS.md',
          ...(notes.length ? ['', '## Claude Code', '', ...notes.map((s) => `- ${s}`)] : []),
        ].join('\n') + '\n'
      : [...body, ...(notes.length ? ['## Claude Code', '', ...notes.map((s) => `- ${s}`), ''] : [])].join('\n').trimEnd() + '\n';
  const files = { both: ['agents', 'claude'], agents: ['agents'], claude: ['claude'] }[mode];
  return { mode, files, text: { agents, claude } };
};

// ---------------------------------------------------------------- result (right side of Create)
const FILES = { agents: 'AGENTS.md', claude: 'CLAUDE.md' };
const SAVE = {
  both: {
    agents: ['Save it in the root of your repo.', 'Codex, Cursor, Copilot, Gemini CLI, Windsurf, Zed and most other agents read it.'],
    claude: ['Save it next to AGENTS.md, in the root of your repo.', 'It\'s one line: <code>@AGENTS.md</code> pulls the shared rules into Claude Code, so you only keep one set of rules.'],
  },
  agents: { agents: ['Save it in the root of your repo.', 'In a monorepo, add another AGENTS.md inside a package: the file closest to the code wins.'] },
  claude: { claude: ['Save it in the root of your repo.', 'Or <code>~/.claude/CLAUDE.md</code> for rules that apply to all your projects.'] },
};
const res = $('#am-result');
res.innerHTML = `<div class="app-tabs" id="am-files" role="group" aria-label="File"></div>
<div class="res-file"><p class="save save-line" id="am-save"></p></div>
<p class="also" id="am-also"></p>
<pre class="out"><code id="am-out"></code></pre>
<div class="res-actions"><button type="button" class="btn btn-primary" data-act="copy" data-label="Copy">Copy</button><button type="button" class="btn btn-ghost" data-act="dl" data-label="Download">Download</button><button type="button" class="link-btn" data-act="dl-all" id="am-dl-all" data-label="Download both files">Download both files</button></div>
<div id="am-status"></div>
<div class="more"><details><summary>Every check we ran</summary><div id="am-checks"></div></details></div>`;

let current = build();
const generate = () => {
  current = build();
  const { mode, files, text } = current;
  if (!files.includes(state.file)) state.file = files[0];
  const file = state.file;
  $('#am-files').innerHTML = files
    .map((f) => `<button type="button" class="app-tab${f === file ? ' on' : ''}" data-file="${f}" aria-pressed="${f === file}"><span aria-hidden="true">📄</span>${FILES[f]}</button>`)
    .join('');
  const [save, also] = SAVE[mode][file];
  $('#am-save').innerHTML = save;
  $('#am-also').innerHTML = also;
  $('#am-out').textContent = text[file];
  res.querySelector('[data-act="copy"]').textContent = res.querySelector('[data-act="copy"]').dataset.label = `Copy ${FILES[file]}`;
  $('#am-dl-all').hidden = files.length < 2;
  // check the file that holds the rules (in "both" mode CLAUDE.md is only the import line)
  const kind = mode === 'claude' ? 'claude' : 'agents';
  const results = lintInstructions(text[kind], kind);
  $('#am-status').innerHTML = statusCallout(results, 'Looks good');
  renderChecks($('#am-checks'), results, 'Looks good');
  $('#am-pm').hidden = !state.stack.js;
  $('#am-structure').hidden = !F.layout.checked;
  $('#am-claude-notes').hidden = mode === 'agents';
};
form.addEventListener('input', (e) => (e.target.name === 'pm' ? applyStack(state.stack) : generate()));
form.addEventListener('change', (e) => (e.target.name === 'pm' ? applyStack(state.stack) : generate()));
res.addEventListener('click', (e) => {
  const t = e.target.closest('[data-file], [data-act]');
  if (!t) return;
  if (t.dataset.file) {
    state.file = t.dataset.file;
    return generate();
  }
  const act = t.dataset.act;
  if (act === 'copy') copyText(t, current.text[state.file]);
  if (act === 'dl') download(FILES[state.file], current.text[state.file]);
  if (act === 'dl-all') current.files.forEach((f, i) => setTimeout(() => download(FILES[f], current.text[f]), i * 400));
});

// ---------------------------------------------------------------- stack picks (left side)
const picks = $('#am-stacks');
const renderPicks = () => {
  picks.innerHTML = [...STACKS, BLANK]
    .map((s) => {
      const on = s === state.stack;
      return `<button type="button" class="pick${on ? ' on' : ''}" data-stack="${s.id}" aria-pressed="${on}" title="${esc(s.sub)}"><span class="ic" aria-hidden="true">${s.icon}</span>${esc(s.title)}</button>`;
    })
    .join('');
};
picks.addEventListener('click', (e) => {
  const b = e.target.closest('[data-stack]');
  if (!b) return;
  const s = [...STACKS, BLANK].find((x) => x.id === b.dataset.stack);
  applyStack(s);
  if (s === BLANK) {
    $('#am-edit').open = true;
    F.name.focus();
  } else if (matchMedia('(max-width: 980px)').matches) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------------------------------------------------------- Check tab
const ckIn = $('#ck-in');
const ckRes = $('#ck-result');
const check = () => {
  if (!ckIn.value.trim()) {
    ckRes.innerHTML = `<div class="res-empty"><span aria-hidden="true">🧪</span><p>Paste an AGENTS.md or CLAUDE.md on the left. We look for leaked keys, missing test commands, vague rules and more.</p></div>`;
    return;
  }
  const k = $('#ck-kind').value;
  const results = lintInstructions(ckIn.value, k === 'auto' ? undefined : k);
  ckRes.innerHTML = `<h2 class="res-h">Result</h2>${statusCallout(results, 'Looks good')}<div class="more"><details><summary>Every check we ran</summary><div id="ck-checks"></div></details></div>`;
  renderChecks($('#ck-checks'), results, 'Looks good');
};
ckIn.addEventListener('input', check);
$('#ck-kind').addEventListener('change', check);
$('#ck-bad').addEventListener('click', () => {
  ckIn.value = [
    '# My App',
    '',
    'IMPORTANT: ALWAYS follow best practices and write clean code.',
    'You MUST NEVER break the build. This is CRITICAL.',
    '',
    '## Setup',
    'Clone it from C:\\Users\\ali\\projects\\my-app and run the server.',
    'OPENAI_API_KEY=' + 'sk-proj-' + 'AbCdEf1234567890AbCdEf1234567890',
    '',
    '## Setup',
    'TODO: add the deploy steps',
  ].join('\n');
  $('#ck-kind').value = 'auto';
  check();
});

// ---------------------------------------------------------------- start
// ?stack=fastapi picks a stack (Bugsy's chat uses it); #check (or the old #checker) opens the Check tab.
{
  const want = new URLSearchParams(location.search).get('stack');
  applyStack(STACKS.find((x) => x.id === want) || state.stack);
  check();
  if (/^#check/.test(location.hash)) showTab('t-check');
}
