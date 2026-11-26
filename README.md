# Byte Buddy

Source of **[bytebuddydev.com](https://bytebuddydev.com)**: free tools and guides for developers who code with AI agents, hosted by Bugsy, our 3D mascot.

## Free tools

All of them run in your browser. Nothing you type or paste is uploaded.

- **[SKILL.md generator & validator](https://bytebuddydev.com/tools/skill-md-generator/)**: create an Agent Skill for Claude Code (or any agent that supports the open standard) from a template, or check yours against the official rules.
- **[AGENTS.md & CLAUDE.md generator](https://bytebuddydev.com/tools/agents-md-generator/)**: pick your stack and get one set of rules for Claude Code, Codex, Cursor, Copilot and other agents. It also checks an existing file for leaked keys and vague rules.
- **[MCP config generator & converter](https://bytebuddydev.com/tools/mcp-config-generator/)**: pick MCP servers and get the exact config for Claude Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf, Gemini CLI or Zed, or convert one app's config to another.

## Guides

- [10 Claude Skills repos that feel illegal to know](https://bytebuddydev.com/skills/)
- [30 GitHub repos every developer should know](https://bytebuddydev.com/repos/)
- [GTA 6-style portfolio built with Claude Code (code + prompts)](https://bytebuddydev.com/gta/)

## Run it locally

```bash
npm install
npm run build   # writes the site to docs/
npm run serve   # http://localhost:4321
```

It's plain HTML and CSS, with small JavaScript bundles for the tools and a three.js scene for Bugsy. There are no frameworks, trackers or cookies.

## Found a mistake?

AI tools change their config formats often. If a tool gives you an outdated path or format, please [open an issue](https://github.com/bytebuddy-dev/bytebuddydev.com/issues) with the app and version.

Find us as **@bytebuddydev** on YouTube, Instagram and TikTok.

© Byte Buddy. All rights reserved.
