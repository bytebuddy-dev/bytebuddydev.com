---
title: "AGENTS.md vs CLAUDE.md: Which One Do You Need?"
description: "AGENTS.md is read by most coding agents, CLAUDE.md by Claude Code. How they differ, and the one-line setup that keeps both in sync."
date: 2026-11-27
tool: /tools/agents-md-generator/
emoji: 🤖
tldr: "Write your rules once, in `AGENTS.md`: Codex, Cursor, Copilot, Gemini CLI and most other agents read it. | Make `CLAUDE.md` one line, `@AGENTS.md`, so Claude Code reads the same rules. | Skip the symlink: Claude can’t edit through it, and Windows handles it badly. | For things that must never happen, use a hook or a deny rule, not a line of text."
---

**Short answer:** use both, but write your rules only once. Put them in `AGENTS.md`, and make `CLAUDE.md` a single line that imports it:

```markdown
@AGENTS.md
```

Claude Code reads `CLAUDE.md`, follows the import and gets your rules. Codex, Cursor, Copilot, Gemini CLI and the rest read `AGENTS.md` directly. One set of rules, every agent.

The rest of this post explains why, and what goes in each file.

## What each file is

Both files do the same job: they tell an AI coding agent how to work on your project. That means which command runs the tests, which style to follow, and what it must never touch. Think of them as a README written for the agent instead of for people.

- **AGENTS.md** is an open format. It started as a shared effort between OpenAI Codex, Amp, Google's Jules, Cursor and Factory, and is now looked after by the Agentic AI Foundation under the Linux Foundation. Codex, Cursor, GitHub Copilot, Jules, Gemini CLI, Aider, Zed, Windsurf, Devin, Junie and many more read it.
- **CLAUDE.md** is Claude Code's own file. Claude Code loads it at the start of every session.

## The differences that matter

| | AGENTS.md | CLAUDE.md |
|---|---|---|
| Read by | Most coding agents | Claude Code |
| Format | Plain Markdown, any headings | Plain Markdown, plus `@path` imports |
| Where | Repo root, plus one per package in a monorepo (closest file wins) | Repo root or `.claude/CLAUDE.md`; personal rules in `~/.claude/CLAUDE.md`; private notes in `CLAUDE.local.md` |
| Size | No limit set; shorter is better | Anthropic recommends under 200 lines |

The `@path` import is the key difference. A line like `@AGENTS.md` in a CLAUDE.md pulls that file in, which is what lets one file serve both.

## Why not only AGENTS.md?

Recent versions of Claude Code can read `AGENTS.md`, but by default only when there is **no** `CLAUDE.md`. The moment someone on your team adds a CLAUDE.md (or Claude creates one with `/init`), your AGENTS.md stops being read. The import line removes that trap.

## Why not a symlink?

`ln -s AGENTS.md CLAUDE.md` works if you never need Claude-only notes, but it has two problems:

- Claude can't edit a file through a symlink, so it can't update its own memory file.
- On Windows, symlinks need admin rights or Developer Mode, and Git may check them out as a plain text file holding the path.

The import works on every system.

## What goes where

**AGENTS.md** holds everything every agent should know:

- The exact commands: install, test, lint, type-check, and how to run a single test.
- Code style rules, written plainly: "Use 2-space indentation" beats "format code properly".
- Gotchas the code doesn't make obvious: "Dates in the API are UTC", "the e2e tests need the dev server running".
- No secrets. This file is committed to git.

**CLAUDE.md** holds the import, plus anything only Claude Code understands:

```markdown
@AGENTS.md

## Claude Code
- Use the /release skill to publish a new version.
```

## What to leave out of both

- **Folder tours.** Agents can read your folders. Every line in these files is read on every task, so a long tour wastes space.
- **Shouting.** Piling on IMPORTANT and ALL CAPS makes current models over-apply a rule. Plain wording works better.
- **Hard limits.** For things that must *never* happen, like force-pushing or deleting a database, a line of text isn't enough. In Claude Code, use a hook or a permission deny rule: those are enforced every time.

## Monorepos

Put an `AGENTS.md` in each package that needs its own rules. Agents read the file closest to the code they are editing, so `packages/api/AGENTS.md` wins over the root file for API code. An instruction you type in the chat overrides them all.

## Make both files in a minute

Our free generator writes both files for your stack, with the import already set up, and checks them for leaked keys, vague rules and missing test commands. It runs in your browser, so nothing you type leaves your computer.

*Sources: [agents.md](https://agents.md/), [Claude Code: How Claude remembers your project](https://code.claude.com/docs/en/memory), [Claude Code: Best practices](https://code.claude.com/docs/en/best-practices). Checked November 2026.*
