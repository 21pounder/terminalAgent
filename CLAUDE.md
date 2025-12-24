# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal Coding Agent is a CLI-based coding assistant **fully powered by the Claude Agent SDK**. It wraps the SDK's `query()` function with a custom terminal UI featuring:
- `/` command menu for invoking Skills
- `@` file browser for attaching files to context
- Session persistence across queries

The agent spawns Claude Code as a subprocess and cannot run inside Claude Code itself.

## Commands

```bash
# From repo root
npm run install:all    # Install all dependencies
npm run dev            # Development (tsx src/index.ts)
npm run build          # TypeScript compilation
npm start              # Run compiled output

# Global CLI (after npm link in deepresearch/)
agent                  # Interactive mode
agent "your question"  # Single query
agent /commit          # Invoke a skill
```

## Architecture

```
deepresearch/
├── src/
│   ├── index.ts              # Main entry - SDK query loop, session management
│   └── ui/
│       ├── index.ts          # UI module exports
│       ├── theme.ts          # ANSI colors, icons, box drawing helpers
│       ├── commands.ts       # CommandPicker - "/" command menu
│       ├── file-browser.ts   # FileBrowser - "@" file selection
│       └── smart-input.ts    # SmartInput - unified input with triggers
├── .claude/
│   └── skills/               # Official format Skills (global)
│       ├── deep-research/SKILL.md
│       ├── code-review/SKILL.md
│       ├── git-commit/SKILL.md
│       └── ...
├── bin/agent.cjs             # Global CLI entry (CommonJS wrapper)
└── dist/                     # Build output
```

## Key Patterns

**SDK Integration** (`src/index.ts`):
- Uses `@anthropic-ai/claude-agent-sdk`'s `query()` function
- Configures: `settingSources`, `additionalDirectories`, `permissionMode: "acceptEdits"`
- Uses `claude_code` preset for tools and system prompt
- Streams messages via async iterator

**Skills Loading**:
- Global skills: Loaded from `deepresearch/.claude/skills/` via `additionalDirectories`
- Project skills: Loaded from `<cwd>/.claude/skills/` via `settingSources: ["project"]`
- Project skills override global skills with same name

**File Attachment**:
- When files are attached via `@`, the prompt explicitly instructs Claude to focus only on those files
- File contents are injected with clear markers: `--- File: path ---`

**UI Components** (`src/ui/`):
- `SmartInput`: Main input loop, detects `/` and `@` triggers
- `CommandPicker`: Arrow-key navigable popup for `/` commands
- `FileBrowser`: Directory navigation + fuzzy search for `@` files
- All use raw `process.stdin` with `setRawMode(true)` for keyboard handling

## Skills Format

Skills follow Anthropic's official format in `.claude/skills/<name>/SKILL.md`:

```markdown
---
name: skill-name
description: Brief description
version: 1.0.0
allowed-tools:
  - Read
  - Write
  - Bash
---

# Skill Name

Instructions for Claude...
```

## Coding Conventions

- TypeScript ES modules for `src/`, CommonJS for `bin/`
- 2-space indentation, semicolons
- Kebab-case filenames
- Run `npm run build` before committing to verify types
