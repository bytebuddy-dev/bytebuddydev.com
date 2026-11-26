// Checks an AGENTS.md or CLAUDE.md against the official guidance:
//   agents.md (format, nested files), code.claude.com/docs/en/memory and /best-practices (size, imports, emphasis).
// Returns [{ level: 'error' | 'warn' | 'ok' | 'info', text }]. `info` text may contain HTML (built here, escaped).
import { escapeHtml } from './skill-rules.js';

export const SECRETS = [
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'an Anthropic API key'],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/, 'an OpenAI-style API key'],
  [/\bgsk_[A-Za-z0-9]{20,}/, 'a Groq API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, 'a GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]+@/, 'a database URL with a password'],
  [/\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["']?(?!\$|<|\{|your|xxx|\*)[A-Za-z0-9_\-+/]{12,}/i, 'a hard-coded secret'],
];

const VAGUE = [
  /\bbest practices\b/i,
  /\bclean code\b/i,
  /\bwrite (?:good|nice|quality|high[- ]quality) code\b/i,
  /\bbe careful\b/i,
  /\bas (?:needed|appropriate)\b/i,
  /\bproperly\b/i,
];

// strip fenced blocks and inline code so we only judge prose
const prose = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

export const detectKind = (text) => (/^\s*@\S/m.test(prose(text)) || /\bclaude\b/i.test(text) ? 'claude' : 'agents');

export function lintInstructions(text, kind = detectKind(text)) {
  const r = [];
  const add = (level, t) => r.push({ level, text: t });
  const name = kind === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
  const src = text.replace(/\r\n/g, '\n');
  if (!src.trim()) return [{ level: 'error', text: `Paste an ${name} to check it.` }];

  const lines = src.split('\n');
  const n = lines.length;
  const p = prose(src);

  // 1. secrets: the one hard error. These files are committed and read by every agent.
  const found = new Set();
  for (const [re, what] of SECRETS) if (re.test(src)) found.add(what);
  for (const what of found) add('error', `This looks like ${what}. Instruction files get committed to git: remove it and read it from an environment variable instead.`);

  // 2. length
  if (kind === 'claude' && n > 200) add('warn', `${n} lines. Anthropic recommends under 200 lines per CLAUDE.md: longer files use more context and Claude follows them less reliably. Move long procedures into skills and path-specific rules into .claude/rules/.`);
  else if (n > 300) add('warn', `${n} lines. Every line is read on every task. Split it: nested ${name} files per package, or link to longer docs.`);
  else add('ok', `${n} line${n === 1 ? '' : 's'} (about ${Math.max(1, Math.round(src.length / 4)).toLocaleString('en')} tokens).`);

  // 3. structure
  const heads = lines.filter((l) => /^#{1,6}\s+\S/.test(l));
  const onlyImport = kind === 'claude' && /^\s*@AGENTS\.md\b/m.test(p);
  if (!heads.length && n > 15 && !onlyImport) add('warn', 'No headings. Group instructions under Markdown headings (## Commands, ## Code style…) so they are easy to scan and update.');
  const seen = new Map();
  for (const h of heads) {
    const k = h.replace(/^#+\s*/, '').trim().toLowerCase();
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, c] of seen) if (c > 1) add('warn', `The heading "${k}" appears ${c} times. Merge the sections so rules don't contradict each other.`);

  // 4. commands
  const code = (src.match(/```[\s\S]*?```|`[^`\n]+`/g) || []).join('\n');
  const hasCmds = /\b(npm|pnpm|yarn|bun|npx|uv|pip|python|pytest|go|cargo|make|dotnet|mvn|\.\/mvnw|gradle|\.\/gradlew|flutter|dart|composer|php|bundle|rails|docker|just|turbo)\b/.test(code);
  if (onlyImport) add('info', `Imports <code>@AGENTS.md</code>: Claude Code reads your AGENTS.md through this file (it loads in full, so it still counts toward context). Check AGENTS.md here too.`);
  else if (!hasCmds) add('warn', 'No commands found. The most useful lines are the exact install, test and lint commands, in backticks.');
  else if (!/\btest\b|pytest|vitest|jest/i.test(code)) add('warn', 'Commands found, but no test command. Agents use it to check their own work before finishing.');
  else add('ok', 'Has commands, including a test command.');
  if (hasCmds && !onlyImport && !/(-k |--filter|-run |-Dtest|\.test\.|_test\.|test_\w+\.py|tests?\/\S+\.\w+|::)/.test(code)) add('info', 'Tip: also show how to run a single test file. Agents finish faster when they can re-run just the failing test.');

  // 5. emphasis (Claude best practices: plain wording works better than IMPORTANT / ALL CAPS)
  const shouts = (p.match(/\b(IMPORTANT|CRITICAL|MUST|NEVER|ALWAYS|YOU MUST)\b/g) || []).length;
  if (shouts >= 3) add('warn', `${shouts} shouted words (IMPORTANT, MUST, NEVER…). Current models follow plainly worded rules; heavy emphasis makes them over-apply rules. For things that must never happen, use a hook or a permission rule instead.`);

  // 6. vague rules
  const vague = lines.filter((l) => VAGUE.some((re) => re.test(prose(l))));
  if (vague.length) add('warn', `Vague rule${vague.length > 1 ? 's' : ''}: "${vague[0].trim().replace(/^[-*]\s*/, '').replace(/[.!]$/, '').slice(0, 80)}"${vague.length > 1 ? ` and ${vague.length - 1} more` : ''}. Say exactly what to do, for example "Use 2-space indentation" instead of "Format code properly".`);

  // 7. machine-specific paths
  const personal = src.match(/(?:[A-Z]:\\Users\\[^\\\s]+|\/Users\/[^/\s]+|\/home\/[^/\s]+)/);
  if (personal) add('warn', `"${personal[0]}" is a path on one person's machine. Use paths relative to the repo so it works for everyone.`);

  // 8. leftovers
  const todo = lines.find((l) => /\b(TODO|TBD|FIXME|lorem ipsum)\b/.test(l) || /<(your|project|package)[-_ ]?\w*>/i.test(l));
  if (todo) add('warn', `Unfinished placeholder: "${todo.trim().slice(0, 70)}". Fill it in or delete it.`);

  // 9. Claude-specific notes
  if (kind === 'claude') {
    const imports = [...p.matchAll(/(?:^|\s)@((?:~\/|\.{1,2}\/|\/)?[\w.\-/\\ ]+?\.?\w+)(?=\s|$)/gm)].map((m) => m[1]).filter((x) => !/^[\w.-]+@/.test(x) && !(onlyImport && x === 'AGENTS.md'));
    if (imports.length) add('info', `Imports ${imports.map((i) => `<code>@${escapeHtml(i)}</code>`).join(', ')}. Imported files load in full with this file (up to four levels deep), so they still use context.`);
  } else if (/^\s*@\S+\.md\b/m.test(p)) {
    add('warn', '`@file` imports are a Claude Code feature. Other agents reading AGENTS.md will see the text, not the file. Link to the file in a sentence instead.');
  }

  if (!r.some((x) => x.level === 'error' || x.level === 'warn')) add('ok', 'No problems found. Keep it updated whenever an agent gets something wrong twice.');
  return r;
}
