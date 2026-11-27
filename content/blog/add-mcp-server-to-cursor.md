---
title: "How to Add an MCP Server to Cursor (and Fix It When It Won't Start)"
description: "Where Cursor's mcp.json lives, the exact format for local and remote servers, how to keep API keys out of it, and the 5 mistakes that stop servers."
date: 2026-11-27
tool: /tools/mcp-config-generator/
emoji: 🔌
tldr: "Servers go in `.cursor/mcp.json` (this project) or `~/.cursor/mcp.json` (all projects). | A local server is a `command` plus `args`; a remote one is just a `url`. | Keep keys out of the file: write `${env:GITHUB_PAT}` and set the variable on your computer. | Most broken setups are `npx` without `-y`, `docker run` without `-i`, or `servers` instead of `mcpServers`."
---

Cursor finds its MCP servers in a small JSON file called `mcp.json`. Add a server to it, restart Cursor, and the agent can use the server's tools: GitHub, a browser, your database, your issue tracker.

## Where the file goes

| Scope | macOS / Linux | Windows |
|---|---|---|
| This project only | `.cursor/mcp.json` in the repo | `.cursor\mcp.json` in the repo |
| All your projects | `~/.cursor/mcp.json` | `%USERPROFILE%\.cursor\mcp.json` |

Use the project file for servers your team should share. Commit it, but without any keys (see below). Use the global file for personal servers.

## A local server (runs on your computer)

Local servers start from a command, usually `npx`, `uvx` or `docker`. Here is Playwright, which lets the agent drive a real browser:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Playwright's server needs Node.js 20 or newer.

## A remote server (hosted by the service)

Remote servers are just a URL. Here is GitHub's official server, with a personal access token read from your environment:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${env:GITHUB_PAT}" }
    }
  }
}
```

If a service has an official remote server (GitHub, Linear, Notion, Sentry, Stripe, Figma and many more do), use it. There's nothing to install and it updates itself. For servers that use sign-in (OAuth), Cursor asks you to sign in the first time it connects.

## Keep API keys out of the file

Never paste a key straight into `mcp.json`. The file gets committed, shown in screenshots and pasted into chats. Cursor reads environment variables with `${env:NAME}`, so write `${env:GITHUB_PAT}` in the file and set the variable on your computer:

```bash
# macOS / Linux (add it to ~/.zshrc or ~/.bashrc to keep it)
export GITHUB_PAT="your-token"
```

```powershell
# Windows (PowerShell), saved for your user
setx GITHUB_PAT "your-token"
```

Restart Cursor afterwards so it sees the new variable.

> Watch out: Cursor writes `${env:NAME}`, but Claude Code writes `${NAME}` and VS Code uses a different file format altogether. A config copied from another app's docs often fails for exactly this reason. Our converter turns one app's config into another's.

## When the server won't start

These five mistakes cause most broken MCP setups:

1. **`npx` without `-y`.** npx stops to ask "Ok to proceed?", nobody answers, and the server never starts. Always write `"args": ["-y", "package-name"]`.
2. **`docker run` without `-i`.** The server can't read requests from Cursor. Use `docker run -i --rm …`.
3. **The wrong top-level key.** Cursor wants `"mcpServers"`. VS Code's files use `"servers"`, and Cursor silently finds nothing in them.
4. **A variable that isn't set where Cursor runs.** If you set it in one terminal and start Cursor from your dock or Start menu, Cursor may not see it. Set it for your user (as above) and restart Cursor.
5. **An old, archived package.** `@modelcontextprotocol/server-github`, `-postgres`, `-brave-search` and `-puppeteer` are archived and get no more fixes. Most have an official replacement; GitHub's is the remote server above.

Also check that the JSON is valid: one missing comma breaks the whole file. Restart Cursor after every change.

## Do it in 30 seconds instead

Our free MCP config generator writes the exact file for Cursor (and Claude Code, VS Code, Codex, Windsurf and more). Pick your servers, and it adds the `-y`, the `-i` and the `${env:…}` references for you. Its checker finds all five mistakes above in a config you paste. It runs in your browser, so your config never leaves your computer.

*Sources: [Cursor: Model Context Protocol](https://cursor.com/docs/context/mcp), [GitHub MCP server](https://github.com/github/github-mcp-server), [Playwright MCP](https://github.com/microsoft/playwright-mcp). Checked November 2026.*
