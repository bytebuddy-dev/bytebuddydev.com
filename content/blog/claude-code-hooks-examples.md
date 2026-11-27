---
title: "Claude Code Hooks: 10 Copy-Paste Examples That Actually Work"
description: "Ten tested Claude Code hooks: notifications, auto-format, blocking rm -rf and force-push, protecting .env, running tests before Claude stops. Windows too."
date: 2026-11-27
tool: /tools/claude-code-hooks-generator/
emoji: 🪝
featured: true
tldr: "Hooks are commands Claude Code runs by itself at set moments, every time. CLAUDE.md can only ask. | Put them in `~/.claude/settings.json` (all projects) or `.claude/settings.json` (one repo). | A hook that exits with code 2 blocks the action and tells Claude why. That’s how the safety hooks below work. | Type `/hooks` in Claude Code to see which hooks loaded."
---

Hooks are commands Claude Code runs on its own at set moments: before it uses a tool, after it edits a file, when it needs you, when it finishes. CLAUDE.md can only *ask* Claude to do something; a hook makes it happen every time.

Each example below is a complete `settings.json`. Save it as `~/.claude/settings.json` (all your projects) or `.claude/settings.json` in a repo (that project, shared with your team). Every command was run with test input before it went on this page.

> **Using more than one?** Each example has its own `"hooks"` block, and pasting two into one file breaks it. Our [hooks generator](/tools/claude-code-hooks-generator/) combines any of these into one file, and can merge them into the settings.json you already have.

**macOS and Linux:** most of these read Claude's input with `jq`. Install it with `brew install jq` or `sudo apt install jq`.

**Windows:** these commands are for `sh`. Pick Windows in the generator and you get PowerShell versions of all ten, with `"shell": "powershell"` and nothing to install.

## 1. Notify me when Claude needs me

You start a long task, switch to another window, and Claude sits there waiting for a "yes" for ten minutes. This fixes that.

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=notify)

On Linux, use `notify-send 'Claude Code' 'Claude Code needs your attention'` as the command (needs `libnotify-bin`).

## 2. Notify me when Claude is done

Same idea, for when Claude finishes. On macOS it also plays a sound.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude is done\" with title \"Claude Code\" sound name \"Glass\"'"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=done)

On Linux, use `notify-send 'Claude Code' 'Claude is done'` as the command (needs `libnotify-bin`).

## 3. Block dangerous commands

Claude asks before running commands, but after the fiftieth "yes" you stop reading. This blocks the few commands that can wipe out work: `rm -rf` on your home or root folder, force-pushes, `git reset --hard` and `DROP TABLE`. `rm -rf node_modules` and `git push --force-with-lease` still work.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "c=$(jq -r '.tool_input.command // empty'); if printf '%s' \"$c\" | grep -Eqi 'rm -(rf|fr) (/|~|\\*|\\$HOME)( |$)|git push .*(--force|-f)( |$)|git reset --hard|drop (table|database)'; then echo \"Blocked by a hook: this command can destroy work. Ask the user to run it themselves.\" >&2; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=danger)

## 4. Protect files from edits

Keeps Claude's edits away from files it should never touch. Edit the list to suit your project.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "f=$(jq -r '.tool_input.file_path // empty'); for p in '.env' 'package-lock.json' '.git/'; do case \"$f\" in *\"$p\"*) echo \"Blocked by a hook: $f is protected ($p). Ask the user to change it.\" >&2; exit 2 ;; esac; done"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=protect)

This guards Claude's Edit and Write tools. Claude could still change a file with a shell command, so for secrets also add a deny rule (for example "Read(./.env)") under permissions.

## 5. Stop me pasting API keys

It's easy to paste an error log or a config with a key in it. This blocks the prompt before it reaches Claude, for OpenAI, GitHub, AWS and Slack keys and private keys.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if jq -r '.prompt // empty' | grep -Eq 'sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY'; then echo 'Blocked: your prompt looks like it contains an API key or private key. Remove it and send it again.' >&2; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=secrets)

## 6. Format with Prettier after edits

Claude's code comes out formatted the way your project wants, every time, without asking.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "f=$(jq -r '.tool_input.file_path // empty') && [ -n \"$f\" ] && npx prettier --write --ignore-unknown \"$f\""
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=prettier)

Needs: Prettier in your project (npm i -D prettier).

## 7. Format Python with Ruff

The Python version. For Go, swap `ruff format` for `gofmt -w` and `*.py` for `*.go`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "f=$(jq -r '.tool_input.file_path // empty'); case \"$f\" in *.py) ruff format \"$f\" ;; esac"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=ruff)

Needs: Ruff (pip install ruff).

## 8. Run tests before Claude finishes

When Claude says "done" and files have changed, your tests run. If they fail, Claude sees the last 30 lines of output and keeps working. It checks `stop_hook_active`, so Claude gets one retry instead of looping forever.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "i=$(cat); [ \"$(printf '%s' \"$i\" | jq -r '.stop_hook_active')\" = true ] && exit 0; cd \"$CLAUDE_PROJECT_DIR\" || exit 0; [ -z \"$(git status --porcelain 2>/dev/null)\" ] && exit 0; out=$(npm test 2>&1) || { echo \"Tests failed. Fix them before you finish:\" >&2; printf '%s\\n' \"$out\" | tail -n 30 >&2; exit 2; }",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=tests)

It skips when nothing changed, and only asks Claude to retry once in a row (stop_hook_active), so it can't loop forever. Slow test suite? Use a faster command here, such as only the unit tests.

## 9. Remind Claude after it compacts

In long sessions Claude summarizes the conversation ("compacts") and details get lost. Whatever this prints is added back to Claude's context right after.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: run the tests before committing. Never commit .env files.'"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=compact)

## 10. Log every command Claude runs

A running list of every shell command Claude ran, in `~/.claude/command-log.txt`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' >> ~/.claude/command-log.txt"
          }
        ]
      }
    ]
  }
}
```

[Get this one for Windows, or combined with others, in the generator →](/tools/claude-code-hooks-generator/?hooks=log)

## How to check they're working

1. Type `/hooks` in Claude Code. You'll see every hook it loaded and which file it came from.
2. Try one: ask Claude to run `git push --force` with hook 3 installed. It should be blocked, and Claude should tell you why.
3. Nothing happening? Event names and matchers are case-sensitive (`Bash`, not `bash`), and the JSON must be valid. Paste your file into the [hooks checker](/tools/claude-code-hooks-generator/#check) and it points at the problem.

## One warning

Hooks run with your full permissions, without asking. Only add hooks you understand. And before you trust a repo you cloned, look at its `.claude/settings.json`: a hook in there runs on your machine.

*Sources: [Claude Code: Hooks reference](https://code.claude.com/docs/en/hooks), [Claude Code: Get started with hooks](https://code.claude.com/docs/en/hooks-guide). Checked November 2026.*
