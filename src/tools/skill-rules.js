// SKILL.md rules, from:
//  - the open Agent Skills spec: https://agentskills.io/specification
//  - Claude docs: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview and /best-practices
//  - Claude Code docs: https://code.claude.com/docs/en/skills
// Spec rules are errors; Claude-specific rules and best practices are warnings.

export const STANDARD_KEYS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
export const CLAUDE_CODE_KEYS = [
  'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable', 'disallowed-tools',
  'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
];

/** Minimal YAML for frontmatter: `key: value`, quoted strings, block scalars (| and >), nested maps and `- item` lists. */
export function parseFrontmatter(src) {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { error: 'no-start' };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { error: 'no-end' };
  const yaml = text.slice(4, end);
  const after = text.slice(end + 4);
  const body = after.startsWith('\n') ? after.slice(1) : after.replace(/^[^\n]*\n?/, '');
  const lines = yaml.split('\n');
  const data = {};
  const problems = [];
  const unquote = (v) => {
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1)) {
      const inner = v.slice(1, -1);
      return v[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n') : inner.replace(/''/g, "'");
    }
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v.replace(/\s+#.*$/, '');
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      problems.push(`Line ${i + 2}: unexpected indentation (is a key missing above it?)`);
      continue;
    }
    const m = line.match(/^([^:]+):(.*)$/);
    if (!m) {
      problems.push(`Line ${i + 2}: expected "key: value"`);
      continue;
    }
    const key = m[1].trim();
    let rest = m[2].trim();
    if (key in data) problems.push(`"${key}" appears twice`);
    if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
      const block = [];
      while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i].replace(/^\s{1,}/, ''));
      data[key] = rest.startsWith('|') ? block.join('\n').trim() : block.join(' ').replace(/\s+/g, ' ').trim();
    } else if (rest === '') {
      const map = {};
      const list = [];
      while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || !lines[i + 1].trim())) {
        const sub = lines[++i].trim();
        if (!sub) continue;
        if (sub.startsWith('- ')) list.push(unquote(sub.slice(2)));
        else {
          const sm = sub.match(/^([^:]+):(.*)$/);
          if (sm) map[sm[1].trim()] = unquote(sm[2]);
        }
      }
      data[key] = list.length ? list : Object.keys(map).length ? map : '';
    } else {
      if (rest.startsWith('[') && rest.endsWith(']')) data[key] = rest.slice(1, -1).split(',').map((s) => unquote(s)).filter(Boolean);
      else data[key] = unquote(rest);
    }
  }
  return { data, body, problems };
}

const hasXml = (s) => /<\/?[a-zA-Z][^>]*>/.test(s);

/** Returns [{ level: 'error' | 'warn' | 'ok' | 'info', text }] */
export function validateSkill(src, { dirName } = {}) {
  const out = [];
  const err = (text) => out.push({ level: 'error', text });
  const warn = (text) => out.push({ level: 'warn', text });
  const ok = (text) => out.push({ level: 'ok', text });
  const info = (text) => out.push({ level: 'info', text });
  if (!src.trim()) return [{ level: 'info', text: 'Paste a SKILL.md to check it.' }];

  const fm = parseFrontmatter(src);
  if (fm.error === 'no-start') return [{ level: 'error', text: 'The file must start with "---" on the very first line (YAML frontmatter). Claude Code ignores frontmatter that doesn\'t start on line 1.' }];
  if (fm.error === 'no-end') return [{ level: 'error', text: 'The frontmatter is never closed: add a line with just "---" after the fields.' }];
  fm.problems.forEach((p) => err(`YAML: ${p}`));
  const d = fm.data;

  // name
  if (!('name' in d) || d.name === '') err('Missing "name" (required by the Agent Skills spec; Claude Code falls back to the folder name).');
  else {
    const n = String(d.name);
    const bad = [];
    if (n.length > 64) bad.push(`it is ${n.length} characters (max 64)`);
    if (/[^a-z0-9-]/.test(n)) bad.push('only lowercase letters, numbers and hyphens are allowed');
    if (/^-|-$/.test(n)) bad.push('it must not start or end with a hyphen');
    if (n.includes('--')) bad.push('it must not contain "--"');
    if (bad.length) err(`name "${n}": ${bad.join('; ')}.`);
    else ok(`name "${n}" follows the spec.`);
    if (/anthropic|claude/i.test(n)) warn('name contains "anthropic" or "claude": Claude\'s API and claude.ai reject these reserved words.');
    if (hasXml(n)) warn('name contains an XML tag, which Claude rejects.');
    if (dirName && dirName !== n) err(`name must match the folder name ("${dirName}").`);
    else info(`Save it as <code>${escapeHtml(n || 'skill-name')}/SKILL.md</code>: the folder name must match the name.`);
  }

  // description
  if (!('description' in d) || !String(d.description).trim()) err('Missing "description": it tells the agent what the skill does and when to use it.');
  else {
    const s = String(d.description);
    if (s.length > 1024) err(`description is ${s.length} characters (max 1,024).`);
    else ok(`description length ${s.length}/1,024.`);
    if (hasXml(s)) warn('description contains an XML tag, which Claude rejects.');
    if (!/\b(when|whenever|before|after|if the user|use (it |this )?for|triggers?)\b/i.test(s))
      warn('description should say when to use the skill, e.g. "Use when the user asks for…". Agents pick skills from this text.');
    if (/^\s*(i|i'm|i am|you|you can|we)\b/i.test(s) || /\b(i can|you can use)\b/i.test(s))
      warn('Write the description in third person ("Generates commit messages…"), not "I can…" or "You can…". Claude\'s best practices recommend third person because the description goes into the system prompt.');
    if (s.length < 40) warn('description is very short. Add specific keywords so the agent can match tasks to it.');
  }

  // optional standard fields
  if ('compatibility' in d) {
    const c = String(d.compatibility);
    if (!c.trim() || c.length > 500) err(`compatibility must be 1–500 characters (it is ${c.length}).`);
  }
  if ('allowed-tools' in d && Array.isArray(d['allowed-tools'])) warn('allowed-tools is a list: the open spec expects a space-separated string, e.g. "Read Grep Bash(git:*)". Claude Code accepts both.');
  if ('metadata' in d) {
    if (typeof d.metadata !== 'object' || Array.isArray(d.metadata)) err('metadata must be a map of string keys to string values.');
    else if (Object.values(d.metadata).some((v) => typeof v !== 'string')) warn('metadata values should be strings: quote numbers and booleans, e.g. version: "1.0".');
  }

  // unknown keys
  for (const k of Object.keys(d)) {
    if (STANDARD_KEYS.includes(k)) continue;
    if (CLAUDE_CODE_KEYS.includes(k)) info(`"${k}" is a Claude Code field. Other agents may not support it (some reject unknown fields).`);
    else warn(`"${k}" is not a known field in the Agent Skills spec or Claude Code. Typo?`);
  }

  // body
  const body = fm.body;
  const lines = body.split('\n').length;
  if (!body.trim()) warn('The body is empty. Add step-by-step instructions, examples and edge cases.');
  else if (lines > 500) warn(`The body is ${lines} lines. Keep SKILL.md under 500 lines and move details into separate files (e.g. references/).`);
  else ok(`Body: ${lines} lines (under the recommended 500).`);
  if (/\b[\w.-]+\\[\w.-]+\.(md|py|js|sh|txt)\b/.test(body)) warn('Use forward slashes in file paths (scripts/helper.py), not Windows backslashes.');
  if (/\]\((?!https?:)[^)]*\/[^)]*\/[^)]*\)/.test(body)) info('Keep file references one level deep from SKILL.md (e.g. references/guide.md).');

  return out;
}

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** YAML-safe scalar: plain when possible, double-quoted otherwise. */
export const yamlValue = (v) => {
  const s = String(v);
  if (s === '' || /^[\s#&*!|>'"%@`{[\]-]|[:#]\s|:$|^(true|false|null|yes|no|on|off|~|\d[\d.]*)$/i.test(s) || /\n/.test(s))
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  return s;
};
