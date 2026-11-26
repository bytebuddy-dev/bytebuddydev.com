// Claude Code hook recipes for the hooks generator (bytebuddydev.com/tools/claude-code-hooks-generator/).
// Every command is one line inside settings.json, so there is only one file to copy.
//   nix: run by sh/bash (macOS, Linux). Reads the hook's JSON input with jq, like the official examples.
//   win: run by PowerShell ("shell": "powershell"), which parses JSON itself, so nothing to install.
// Facts checked against https://code.claude.com/docs/en/hooks and /hooks-guide (November 2026):
//   exit 2 = block (stderr goes to Claude), other non-zero = non-blocking error;
//   Stop input has stop_hook_active; SessionStart stdout is added to Claude's context.
export const CHECKED = 'November 2026';

const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // POSIX single-quote
const pq = (s) => `'${String(s).replace(/'/g, "''")}'`; // PowerShell single-quote
const listOf = (s) => String(s).split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
const PS_IN = '([Console]::In.ReadToEnd() | ConvertFrom-Json)';
// Windows balloon notification, started in the background so the hook returns at once
const winBalloon = (msg, sound) =>
  `Start-Process powershell.exe -WindowStyle Hidden -ArgumentList ${pq(`-NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; ${sound ? '[System.Media.SystemSounds]::Asterisk.Play(); ' : ''}$n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(5000, 'Claude Code', '${msg}', 'Info'); Start-Sleep -Seconds 6; $n.Dispose()"`)}`;
const psErr = (msg) => `[Console]::Error.WriteLine(${msg}); exit 2`;

// Things a dangerous Bash command looks like. Case-insensitive. --force-with-lease is allowed.
const DANGER = 'rm -(rf|fr) (/|~|\\*|\\$HOME)( |$)|git push .*(--force|-f)( |$)|git reset --hard|drop (table|database)';
// Things an API key or private key looks like.
const KEYS = 'sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY';

const fmt = (tool, exts) => ({
  nix: () => `f=$(jq -r '.tool_input.file_path // empty'); case "$f" in ${exts.map((e) => `*${e}`).join('|')}) ${tool} "$f" ;; esac`,
  win: () => `$f = ${PS_IN}.tool_input.file_path; if ($f -match '(${exts.map((e) => e.replace('.', '\\.')).join('|')})$') { ${tool} "$f" }`,
});

/**
 * Each recipe: where it hooks in, and one command per OS.
 * params: inputs shown under Customize ({ id, label, hint, value }).
 * needs: what has to be installed for it to work.
 */
export const RECIPES = [
  {
    id: 'notify',
    icon: '🔔',
    title: 'Notify me when Claude needs me',
    sub: 'A desktop notification when Claude is waiting for your permission or your answer.',
    event: 'Notification',
    matcher: '',
    nix: (p, os) => (os === 'linux' ? `notify-send 'Claude Code' 'Claude Code needs your attention'` : `osascript -e 'display notification "Claude Code needs your attention" with title "Claude Code"'`),
    win: () => winBalloon('Claude Code needs your attention'),
    needs: { linux: 'notify-send (sudo apt install libnotify-bin)' },
  },
  {
    id: 'done',
    icon: '✅',
    title: 'Notify me when Claude is done',
    sub: 'A notification (with a sound on macOS) every time Claude finishes a reply.',
    event: 'Stop',
    nix: (p, os) => (os === 'linux' ? `notify-send 'Claude Code' 'Claude is done'` : `osascript -e 'display notification "Claude is done" with title "Claude Code" sound name "Glass"'`),
    win: () => winBalloon('Claude is done', true),
    needs: { linux: 'notify-send (sudo apt install libnotify-bin)' },
  },
  {
    id: 'danger',
    icon: '🛑',
    title: 'Block dangerous commands',
    sub: 'Stops rm -rf on your home folder, force-pushes, git reset --hard and DROP TABLE before they run.',
    event: 'PreToolUse',
    matcher: 'Bash',
    nix: () => `c=$(jq -r '.tool_input.command // empty'); if printf '%s' "$c" | grep -Eqi ${sq(DANGER)}; then echo "Blocked by a hook: this command can destroy work. Ask the user to run it themselves." >&2; exit 2; fi`,
    win: () => `$c = ${PS_IN}.tool_input.command; if ($c -match ${pq(DANGER)}) { ${psErr("'Blocked by a hook: this command can destroy work. Ask the user to run it themselves.'")} }`,
  },
  {
    id: 'protect',
    icon: '🔒',
    title: 'Protect files from edits',
    sub: 'Claude can\'t edit .env, lock files or anything in .git/. You choose the list.',
    event: 'PreToolUse',
    matcher: 'Edit|Write',
    params: [{ id: 'files', label: 'Protected files', hint: 'one per line · any path containing this text is blocked', value: '.env\npackage-lock.json\n.git/' }],
    nix: (p) => `f=$(jq -r '.tool_input.file_path // empty'); for p in ${listOf(p.files).map(sq).join(' ')}; do case "$f" in *"$p"*) echo "Blocked by a hook: $f is protected ($p). Ask the user to change it." >&2; exit 2 ;; esac; done`,
    win: (p) => `$f = ${PS_IN}.tool_input.file_path -replace '\\\\', '/'; foreach ($p in ${listOf(p.files).map(pq).join(', ')}) { if ($f -and $f.Contains($p)) { ${psErr('"Blocked by a hook: $f is protected ($p). Ask the user to change it."')} } }`,
    note: 'This guards Claude\'s Edit and Write tools. Claude could still change a file with a shell command, so for secrets also add a deny rule (for example "Read(./.env)") under permissions.',
  },
  {
    id: 'secrets',
    icon: '🔑',
    title: 'Stop me pasting API keys',
    sub: 'If a prompt you send contains an API key or private key, it\'s blocked before Claude sees it.',
    event: 'UserPromptSubmit',
    nix: () => `if jq -r '.prompt // empty' | grep -Eq ${sq(KEYS)}; then echo 'Blocked: your prompt looks like it contains an API key or private key. Remove it and send it again.' >&2; exit 2; fi`,
    win: () => `if (${PS_IN}.prompt -cmatch ${pq(KEYS)}) { ${psErr("'Blocked: your prompt looks like it contains an API key or private key. Remove it and send it again.'")} }`,
  },
  {
    id: 'prettier',
    icon: '✨',
    title: 'Format with Prettier after edits',
    sub: 'Runs Prettier on every file Claude writes or edits (JS, TS, CSS, JSON, Markdown…).',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    nix: () => `f=$(jq -r '.tool_input.file_path // empty') && [ -n "$f" ] && npx prettier --write --ignore-unknown "$f"`,
    win: () => `$f = ${PS_IN}.tool_input.file_path; if ($f) { npx prettier --write --ignore-unknown "$f" }`,
    needs: { all: 'Prettier in your project (npm i -D prettier)' },
  },
  {
    id: 'ruff',
    icon: '🐍',
    title: 'Format Python with Ruff',
    sub: 'Runs ruff format on every .py file Claude writes or edits.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    ...fmt('ruff format', ['.py']),
    needs: { all: 'Ruff (pip install ruff)' },
  },
  {
    id: 'gofmt',
    icon: '🐹',
    title: 'Format Go with gofmt',
    sub: 'Runs gofmt -w on every .go file Claude writes or edits.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    ...fmt('gofmt -w', ['.go']),
    needs: { all: 'Go (gofmt comes with it)' },
  },
  {
    id: 'tests',
    icon: '🧪',
    title: 'Run tests before Claude finishes',
    sub: 'When Claude says it\'s done and files changed, your tests run. If they fail, Claude keeps working.',
    event: 'Stop',
    timeout: 300,
    params: [{ id: 'cmd', label: 'Test command', hint: 'runs in your project folder', value: 'npm test' }],
    nix: (p) => `i=$(cat); [ "$(printf '%s' "$i" | jq -r '.stop_hook_active')" = true ] && exit 0; cd "$CLAUDE_PROJECT_DIR" || exit 0; [ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0; out=$(${p.cmd.trim() || 'npm test'} 2>&1) || { echo "Tests failed. Fix them before you finish:" >&2; printf '%s\\n' "$out" | tail -n 30 >&2; exit 2; }`,
    win: (p) =>
      `$i = ${PS_IN}; if ($i.stop_hook_active) { exit 0 }; Set-Location $env:CLAUDE_PROJECT_DIR; if (-not (git status --porcelain)) { exit 0 }; $out = ${p.cmd.trim() || 'npm test'} 2>&1 | Out-String; if ($LASTEXITCODE -ne 0) { ${psErr('"Tests failed. Fix them before you finish:`n" + (($out -split "`n") | Select-Object -Last 30 | Out-String)')} }`,
    note: 'It skips when nothing changed, and only asks Claude to retry once in a row (stop_hook_active), so it can\'t loop forever. Slow test suite? Use a faster command here, such as only the unit tests.',
  },
  {
    id: 'compact',
    icon: '📌',
    title: 'Remind Claude after it compacts',
    sub: 'Long sessions get summarized and details get lost. This puts your key rules back each time.',
    event: 'SessionStart',
    matcher: 'compact',
    params: [{ id: 'text', label: 'Reminder', hint: 'what Claude should never forget', value: 'Reminder: run the tests before committing. Never commit .env files.' }],
    nix: (p) => `echo ${sq(p.text.trim() || 'Reminder')}`,
    win: (p) => `Write-Output ${pq(p.text.trim() || 'Reminder')}`,
  },
  {
    id: 'log',
    icon: '📜',
    title: 'Log every command Claude runs',
    sub: 'Appends each shell command to ~/.claude/command-log.txt so you can see what happened.',
    event: 'PostToolUse',
    matcher: 'Bash',
    nix: () => `jq -r '.tool_input.command' >> ~/.claude/command-log.txt`,
    win: () => `${PS_IN}.tool_input.command | Add-Content -Path "$env:USERPROFILE\\.claude\\command-log.txt"`,
  },
];

export const DEFAULT_PICKS = ['notify', 'danger'];

// ---------------------------------------------------------------- every event, for the checker
// [name, matcher matches…] (null = no matcher: it's ignored)
export const EVENTS = {
  SessionStart: 'startup, resume, clear, compact',
  Setup: 'init, maintenance',
  UserPromptSubmit: null,
  UserPromptExpansion: 'a command name',
  PreSkillShellCommand: 'Bash, PowerShell',
  PreToolUse: 'a tool name',
  PermissionRequest: 'a tool name',
  PermissionDenied: 'a tool name',
  PostToolUse: 'a tool name',
  PostToolUseFailure: 'a tool name',
  PostToolBatch: null,
  Notification: 'a notification type',
  MessageDisplay: null,
  SubagentStart: 'an agent type',
  SubagentStop: 'an agent type',
  TaskCreated: null,
  TaskCompleted: null,
  Stop: null,
  StopFailure: 'an error type',
  TeammateIdle: null,
  InstructionsLoaded: 'a load reason',
  ConfigChange: 'a settings source',
  CwdChanged: null,
  DirectoryAdded: 'slash_command, register_repo_root',
  FileChanged: 'file names',
  WorktreeCreate: null,
  WorktreeRemove: null,
  PreCompact: 'manual, auto',
  PostCompact: 'manual, auto',
  PreModelSwitch: 'a model name',
  PostModelSwitch: 'a model name',
  Elicitation: 'an MCP server name',
  ElicitationResult: 'an MCP server name',
  SessionEnd: 'clear, resume, logout, prompt_input_exit, other',
};
export const TOOL_EVENTS = ['PreToolUse', 'PermissionRequest', 'PermissionDenied', 'PostToolUse', 'PostToolUseFailure'];
// https://code.claude.com/docs/en/tools-reference ("the exact strings you use in … hook matchers")
export const TOOLS = ['Agent', 'Bash', 'Edit', 'EnterPlanMode', 'ExitPlanMode', 'Glob', 'Grep', 'Monitor', 'NotebookEdit', 'PowerShell', 'Read', 'SendMessage', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'WebFetch', 'WebSearch', 'Write'];
export const HOOK_TYPES = { command: 'command', http: 'url', prompt: 'prompt', agent: 'prompt', mcp_tool: 'tool' };
