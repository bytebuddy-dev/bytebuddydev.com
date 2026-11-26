// SKILL.md generator + validator (bytebuddydev.com/tools/skill-md-generator/). Runs fully in the browser.
// Layout: tabs (Create / Check) · picks on the left · the finished file on the right.
import { escapeHtml as esc, validateSkill, yamlValue } from './skill-rules.js';
import { TEMPLATES } from './skill-templates.js';
import { copyText, download, renderChecks, setupTabs, statusCallout } from './ui.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#gen');
const F = form.elements;
const showTab = setupTabs({ 't-check': 'check' });

const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/, '');
const sentence = (s) => {
  s = s.trim();
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1);
  return /[.!?]$/.test(s) ? s : s + '.';
};
const lines = (s) => s.split('\n').map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);

const TARGETS = [
  { id: 'claude-code', icon: '✳️', name: 'Claude Code' },
  { id: 'standard', icon: '🌐', name: 'Any agent (open standard)' },
];
const state = { target: 'claude-code', tpl: 'commit-messages' };

let nameTouched = false;
F.name.addEventListener('input', () => (nameTouched = F.name.value !== ''));
F.title.addEventListener('input', () => {
  if (!nameTouched) F.name.value = slug(F.title.value);
});

// ---------------------------------------------------------------- build the file
const build = () => {
  const claude = state.target === 'claude-code';
  const name = F.name.value.trim() || 'my-skill';
  const what = sentence(F.what.value);
  let when = F.when.value.trim();
  if (when && !/^use\b/i.test(when)) when = 'Use when ' + when.replace(/^when\s+/i, '');
  const description = [what, sentence(when)].filter(Boolean).join(' ');
  const fm = [`name: ${yamlValue(name)}`, `description: ${yamlValue(description)}`];
  if (F.license.value) fm.push(`license: ${yamlValue(F.license.value)}`);
  if (F.compat.value.trim()) fm.push(`compatibility: ${yamlValue(F.compat.value.trim())}`);
  if (F.tools.value.trim()) fm.push(`allowed-tools: ${yamlValue(F.tools.value.trim())}`);
  if (claude) {
    if (F.hint.value.trim()) fm.push(`argument-hint: ${yamlValue(F.hint.value.trim())}`);
    if (F.manual.checked) fm.push('disable-model-invocation: true');
  }
  if (F.author.value.trim()) fm.push('metadata:', `  author: ${yamlValue(F.author.value.trim())}`, '  version: "1.0"');

  const title = F.title.value.trim() || name.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const steps = lines(F.steps.value);
  const edge = lines(F.edge.value);
  const body = [`# ${title}`, ''];
  if (what) body.push(what, '');
  body.push('## Instructions', '');
  (steps.length ? steps : ['Describe the first step here.']).forEach((s, i) => body.push(`${i + 1}. ${sentence(s)}`));
  if (F.exIn.value.trim() || F.exOut.value.trim()) {
    body.push('', '## Example', '', '**Input:**', '', '```', F.exIn.value.trim() || '…', '```', '', '**Output:**', '', '```', F.exOut.value.trim() || '…', '```');
  }
  if (edge.length) {
    body.push('', '## Edge cases', '');
    edge.forEach((e) => body.push(`- ${sentence(e)}`));
  }
  return { name, claude, md: `---\n${fm.join('\n')}\n---\n\n${body.join('\n')}\n` };
};

// ---------------------------------------------------------------- result (right side of Create)
// The frame is drawn once; only its parts change while typing, so open details stay open.
const res = $('#sk-result');
res.innerHTML = `<div class="app-tabs" role="group" aria-label="Made for">${TARGETS.map((t) => `<button type="button" class="app-tab" data-target="${t.id}"><span aria-hidden="true">${t.icon}</span>${esc(t.name)}</button>`).join('')}</div>
<div class="res-file"><span class="fname">📄 SKILL.md</span><p class="save save-line" id="sk-save"></p></div>
<p class="also" id="sk-also"></p>
<pre class="out"><code id="sk-out"></code></pre>
<div class="res-actions"><button type="button" class="btn btn-primary" data-act="copy" data-label="Copy SKILL.md">Copy SKILL.md</button><button type="button" class="btn btn-ghost" data-act="dl" data-label="Download">Download</button></div>
<div id="sk-status"></div>
<div class="more"><details><summary>How Claude uses it</summary><p class="meta" id="sk-how" style="margin:0"></p></details><details><summary>Every check we ran</summary><div id="sk-checks"></div></details></div>`;

let current = '';
const generate = () => {
  const { name, claude, md } = build();
  current = md;
  const n = esc(name);
  $('#sk-out').textContent = md;
  res.querySelectorAll('[data-target]').forEach((b) => {
    b.classList.toggle('on', b.dataset.target === state.target);
    b.setAttribute('aria-pressed', b.dataset.target === state.target);
  });
  $('#sk-save').innerHTML = claude ? `Save it in: <code>~/.claude/skills/${n}/SKILL.md</code>` : `Save it in a folder with the same name: <code>${n}/SKILL.md</code>`;
  $('#sk-also').innerHTML = claude ? `Or, for this project only (shared through git): <code>.claude/skills/${n}/SKILL.md</code>` : 'Put the folder wherever your agent loads skills from. The folder name must match <code>name</code>.';
  $('#sk-how').innerHTML = claude
    ? F.manual.checked
      ? `It only runs when you type <code>/${n}</code> in Claude Code.`
      : `Claude reads the description and loads the skill by itself when your request matches. You can also run it by typing <code>/${n}</code>.`
    : 'Agents that support the open Agent Skills standard read the name and description at startup and load the rest only when a task matches.';
  const results = validateSkill(md);
  $('#sk-status').innerHTML = statusCallout(results, 'Valid SKILL.md');
  renderChecks($('#sk-checks'), results, 'Valid SKILL.md');
  document.querySelectorAll('.cc-only').forEach((el) => (el.hidden = !claude));
};
form.addEventListener('input', generate);
form.addEventListener('change', generate);
res.addEventListener('click', (e) => {
  const t = e.target.closest('[data-target], [data-act]');
  if (!t) return;
  if (t.dataset.target) {
    state.target = t.dataset.target;
    return generate();
  }
  if (t.dataset.act === 'copy') copyText(t, current);
  if (t.dataset.act === 'dl') download('SKILL.md', current);
});

// ---------------------------------------------------------------- template picks (left side)
const BLANK = { name: 'blank', icon: '✨', title: 'Blank skill', blank: true };
const picks = $('#sk-picks');
const renderPicks = () => {
  picks.innerHTML = [...TEMPLATES, BLANK]
    .map((t) => {
      const on = t.name === state.tpl;
      return `<button type="button" class="pick${on ? ' on' : ''}" data-tpl="${esc(t.name)}" aria-pressed="${on}"${t.cat ? ` title="${esc(t.cat)}"` : ''}><span class="ic" aria-hidden="true">${t.icon}</span>${esc(t.title)}</button>`;
    })
    .join('');
};
const fill = (t) => {
  F.title.value = t.title;
  F.name.value = t.name;
  nameTouched = true;
  F.what.value = t.what;
  F.when.value = t.when;
  F.steps.value = t.steps.join('\n');
  F.exIn.value = t.exIn ?? '';
  F.exOut.value = t.exOut ?? '';
  F.edge.value = (t.edge ?? []).join('\n');
  F.tools.value = t.tools ?? '';
};
const pickTemplate = (id) => {
  state.tpl = id;
  renderPicks();
  const t = TEMPLATES.find((x) => x.name === id);
  if (t) fill(t);
  else {
    // blank: clear the skill fields but keep the person's own options (license, author…)
    for (const k of ['title', 'name', 'what', 'when', 'steps', 'exIn', 'exOut', 'edge', 'tools']) F[k].value = '';
    nameTouched = false;
    $('#sk-edit').open = true;
    F.title.focus();
  }
  generate();
};
picks.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tpl]');
  if (!b) return;
  pickTemplate(b.dataset.tpl);
  // on narrow screens jump straight to the finished file
  if (b.dataset.tpl !== 'blank' && matchMedia('(max-width: 980px)').matches) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------------------------------------------------------- Check tab
const valIn = $('#val-in');
const valRes = $('#val-result');
const validate = () => {
  if (!valIn.value.trim()) {
    valRes.innerHTML = `<div class="res-empty"><span aria-hidden="true">🧪</span><p>Paste a SKILL.md on the left to check it against the official rules, or load a broken example to see what it catches.</p></div>`;
    return;
  }
  const results = validateSkill(valIn.value);
  valRes.innerHTML = `<h2 class="res-h">Result</h2>${statusCallout(results, 'Valid SKILL.md')}<div class="more"><details><summary>Every check we ran</summary><div id="val-checks"></div></details></div>`;
  renderChecks($('#val-checks'), results, 'Valid SKILL.md');
};
valIn.addEventListener('input', validate);
$('#val-bad').addEventListener('click', () => {
  valIn.value = '---\nname: Claude--PDF-Helper\ndescription: I can help you with PDFs\nversion: 2\n---\n';
  validate();
});

// ---------------------------------------------------------------- start
// Deep links (used by Bugsy's chat): ?t=<template name> opens a template, ?idea=<text> starts a custom draft,
// ?from=chat#validator checks the skill the chat wrote. #check (or the old #validator) opens the Check tab.
{
  const q = new URLSearchParams(location.search);
  const t = TEMPLATES.find((x) => x.name === q.get('t'));
  const idea = (q.get('idea') || '').trim().slice(0, 200);
  if (t) pickTemplate(t.name);
  else if (idea) {
    state.tpl = 'blank';
    renderPicks();
    F.title.value = idea.replace(/^\w/, (c) => c.toUpperCase());
    F.name.value = slug(idea);
    nameTouched = true;
    F.what.value = idea.replace(/^\w/, (c) => c.toUpperCase());
    $('#sk-edit').open = true;
    generate();
  } else pickTemplate(state.tpl);
  if (q.get('from') === 'chat') {
    try {
      const md = sessionStorage.getItem('bb-chat-skill');
      if (md) valIn.value = md;
    } catch {
      /* storage blocked */
    }
  }
  validate();
  if (/^#(check|validat)/.test(location.hash)) showTab('t-check');
}
