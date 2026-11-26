// Checks the "hooks" part of a Claude Code settings.json. Rules from https://code.claude.com/docs/en/hooks.
import { EVENTS, HOOK_TYPES, TOOLS, TOOL_EVENTS } from './hooks-recipes.js';
import { SECRETS } from './agents-rules.js';

const lower = Object.fromEntries(Object.keys(EVENTS).map((e) => [e.toLowerCase(), e]));
const toolLower = Object.fromEntries(TOOLS.map((t) => [t.toLowerCase(), t]));

/** Where a JSON.parse error happened, as "line N". */
const errLine = (text, e) => {
  const m = /position (\d+)/.exec(e.message) || /line (\d+)/.exec(e.message);
  if (!m) return '';
  if (/line/.test(m[0])) return ` (line ${m[1]})`;
  return ` (line ${text.slice(0, +m[1]).split('\n').length})`;
};

export function lintHooks(text) {
  const out = [];
  const add = (level, t) => out.push({ level, text: t });
  const src = text.trim();
  if (!src) return out;
  let data;
  try {
    data = JSON.parse(src);
  } catch (e) {
    const trailing = /,\s*[}\]]/.test(src);
    add('error', `This isn't valid JSON${errLine(src, e)}.${trailing ? ' Look for a comma before a } or ]: JSON doesn\'t allow trailing commas.' : /\/\/|\/\*/.test(src) ? ' JSON doesn\'t allow comments.' : ''}`);
    return out;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return add('error', 'The file should be one JSON object: { "hooks": { … } }.'), out;
  // pasted only the inside of "hooks"?
  let hooks = data.hooks;
  if (!hooks) {
    if (Object.keys(data).some((k) => lower[k.toLowerCase()])) {
      add('error', 'The events need to be inside a "hooks" object: { "hooks": { "PreToolUse": [ … ] } }.');
      hooks = data;
    } else return add('error', 'No "hooks" found. Hooks go under a top-level "hooks" key in .claude/settings.json or ~/.claude/settings.json.'), out;
  }
  if (typeof hooks !== 'object' || Array.isArray(hooks)) return add('error', '"hooks" should be an object with event names as keys, such as "PreToolUse".'), out;
  if (data.disableAllHooks === true) add('warn', '"disableAllHooks": true is set, so none of these hooks will run.');

  let count = 0;
  for (const [event, groups] of Object.entries(hooks)) {
    const real = EVENTS[event] !== undefined ? event : lower[event.toLowerCase()];
    if (!real) {
      add('error', `"${event}" isn't a hook event. Check the spelling: event names are case-sensitive, like PreToolUse or SessionStart.`);
      continue;
    }
    if (real !== event) {
      add('error', `"${event}" should be "${real}": event names are case-sensitive.`);
      continue;
    }
    if (!Array.isArray(groups)) {
      add('error', `${event}: should be a list: "${event}": [ { "matcher": "…", "hooks": [ … ] } ].`);
      continue;
    }
    groups.forEach((g, gi) => {
      const where = groups.length > 1 ? `${event} (#${gi + 1})` : event;
      if (!g || typeof g !== 'object') return add('error', `${where}: each entry should be an object with a "hooks" list.`);
      if (g.type || g.command) return add('error', `${where}: the command needs to be inside a "hooks" list: { "matcher": "…", "hooks": [ { "type": "command", "command": "…" } ] }.`);
      if (!Array.isArray(g.hooks) || !g.hooks.length) return add('error', `${where}: missing its "hooks" list.`);
      const m = g.matcher;
      if (m !== undefined && typeof m !== 'string') add('error', `${where}: "matcher" should be text, like "Edit|Write".`);
      else if (m && EVENTS[event] === null) add('warn', `${where}: ${event} doesn't use a matcher, so "${m}" is ignored and the hook runs every time.`);
      else if (m && TOOL_EVENTS.includes(event) && /^[\w\s,|-]+$/.test(m)) {
        for (const name of m.split(/[|,]/).map((x) => x.trim()).filter(Boolean)) {
          if (TOOLS.includes(name) || /^mcp__/.test(name)) continue;
          if (toolLower[name.toLowerCase()]) add('error', `${where}: matcher "${name}" should be "${toolLower[name.toLowerCase()]}": tool names are case-sensitive.`);
          else if (name === 'MultiEdit') add('warn', `${where}: there's no MultiEdit tool any more. "Edit|Write" covers every file change.`);
          else if (name === 'Task') add('warn', `${where}: the subagent tool is called "Agent" now, not "Task".`);
          else add('warn', `${where}: "${name}" isn't a built-in tool name. MCP tools look like mcp__server__tool.`);
        }
      }
      g.hooks.forEach((h, hi) => {
        count++;
        const w = g.hooks.length > 1 ? `${where}, hook ${hi + 1}` : where;
        if (!h || typeof h !== 'object') return add('error', `${w}: each hook should be an object like { "type": "command", "command": "…" }.`);
        if (!h.type) return add('error', `${w}: missing "type" (usually "command").`);
        if (!HOOK_TYPES[h.type]) return add('error', `${w}: "type": "${h.type}" isn't valid. Use command, http, prompt, agent or mcp_tool.`);
        const need = HOOK_TYPES[h.type];
        if (!h[need]) return add('error', `${w}: a "${h.type}" hook needs "${need}".`);
        if (h.timeout !== undefined && !(typeof h.timeout === 'number' && h.timeout > 0)) add('error', `${w}: "timeout" should be a number of seconds, like 60.`);
        if (h.type === 'agent') add('info', `${w}: "agent" hooks are experimental in Claude Code and may change.`);
        if (h.type !== 'command') return;
        const c = String(h.command);
        for (const [re, what] of SECRETS) if (re.test(c)) add('error', `${w}: the command contains ${what}. settings.json is often committed: read it from an environment variable instead.`);
        if (/(^|[\s"'])(\.\/|\.claude[\\/])\S*\.(sh|py|js|ps1)/.test(c) && !/CLAUDE_PROJECT_DIR/.test(c))
          add('warn', `${w}: the script path is relative, so it breaks when Claude runs from a subfolder. Start it with "$CLAUDE_PROJECT_DIR"/.claude/hooks/…`);
        if (/\$CLAUDE_PROJECT_DIR(?!["}])/.test(c) && !/"\$CLAUDE_PROJECT_DIR"|\$\{CLAUDE_PROJECT_DIR\}|\$env:CLAUDE_PROJECT_DIR/.test(c))
          add('warn', `${w}: wrap $CLAUDE_PROJECT_DIR in double quotes ("$CLAUDE_PROJECT_DIR"/…) so paths with spaces work.`);
        if (/\bcurl\b[^|]*\|\s*(ba)?sh\b/.test(c)) add('warn', `${w}: downloads a script and runs it. Hooks run with your full permissions, so only do this with code you trust.`);
        if (/\brm\s+-\w*r\w*f|\brm\s+-\w*f\w*r/.test(c)) add('warn', `${w}: runs rm -rf. Hooks run without asking, so double-check that path.`);
        if (event === 'Stop' || event === 'SubagentStop') {
          if (/exit\s+2|"decision"\s*:\s*"block"/.test(c) && !/stop_hook_active/.test(c))
            add('warn', `${w}: this can block Claude from stopping, but doesn't check stop_hook_active. If it keeps failing, Claude loops until it hits the limit. Exit 0 when stop_hook_active is true.`);
        }
        if (event === 'SessionEnd' && !(h.timeout > 1.5)) add('info', `${w}: SessionEnd hooks get 1.5 seconds in total unless you raise "timeout". Keep them quick.`);
        if (/\bjq\b/.test(c) && h.shell !== 'powershell') add('info', `${w}: needs jq installed (macOS: brew install jq · Linux: sudo apt install jq). On Windows, use a PowerShell command instead.`);
        if (/ConvertFrom-Json|\$env:|Write-Output/.test(c) && h.shell !== 'powershell') add('warn', `${w}: looks like PowerShell, but there's no "shell": "powershell", so it runs in Git Bash where it fails.`);
      });
    });
  }
  if (!out.some((r) => r.level === 'error')) {
    add('ok', `${count} hook${count === 1 ? '' : 's'} with a valid structure`);
    add('info', 'In Claude Code, type /hooks to see every hook it loaded, and where from.');
  }
  return out;
}
