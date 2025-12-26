# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal Coding Agent is a CLI-based multi-agent coding assistant powered by the Claude Agent SDK. It wraps the SDK's `query()` function with a custom terminal UI featuring:
- `/` command menu for invoking Skills
- `@` file browser for attaching files to context
- Session persistence across queries
- Smart routing to specialized agents (Reader, Coder, Reviewer)

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
│   ├── index.ts              # Main entry - SDK query loop, agent routing
│   ├── ui/
│   │   ├── theme.ts          # ANSI colors, icons, box drawing helpers
│   │   ├── commands.ts       # CommandPicker - "/" command menu
│   │   ├── file-browser.ts   # FileBrowser - "@" file selection
│   │   └── smart-input.ts    # SmartInput - unified input with triggers
│   ├── prompts/              # Agent-specific system prompts
│   │   ├── coordinator.md    # Task decomposition, multi-agent dispatch
│   │   ├── reader.md         # Code reading and analysis
│   │   ├── coder.md          # Code writing and modification
│   │   └── reviewer.md       # Code review and quality checks
│   └── utils/
│       ├── tracker.ts        # Subagent execution tracking
│       ├── message-handler.ts # SDK message processing
│       └── transcript.ts     # Session logging (text + JSON)
├── .claude/skills/           # Global Skills (official format)
├── bin/agent.cjs             # Global CLI entry (CommonJS wrapper)
└── dist/                     # Build output
```

## Multi-Agent System

**Agent Types**:
- **Coordinator** (🎯): Complex tasks requiring multi-agent orchestration
- **Reader** (📖): Code reading, analysis, understanding
- **Coder** (💻): Code writing, modification, implementation
- **Reviewer** (🔍): Code review, quality checks, bug detection

**Routing Logic** (`detectTaskType()` in `src/index.ts`):
1. Skill commands have highest priority (`/code-review` → Reviewer)
2. Keyword detection with word boundaries (e.g., "write", "add" → Coder)
3. Default to Coordinator for complex/uncertain tasks

## Key Patterns

**SDK Integration** (`src/index.ts`):
- Uses `@anthropic-ai/claude-agent-sdk`'s `query()` function
- Configures: `settingSources`, `additionalDirectories`, `permissionMode`
- Uses `claude_code` preset for tools and system prompt
- Streams messages via async iterator

**Skills Loading**:
- Global skills: Loaded from `deepresearch/.claude/skills/` via `additionalDirectories`
- Project skills: Loaded from `<cwd>/.claude/skills/` via `settingSources: ["project"]`
- Internal skills (web-scrape, doc-generate, deep-research): Hidden from user menu

**File Attachment**:
- When files are attached via `@`, the prompt instructs Claude to focus only on those files
- File contents are injected with markers: `--- File: path ---`

**UI Components** (`src/ui/`):
- All use raw `process.stdin` with `setRawMode(true)` for keyboard handling
- `SmartInput`: Main input loop, detects `/` and `@` triggers
- `CommandPicker`: Arrow-key navigable popup for `/` commands
- `FileBrowser`: Directory navigation + fuzzy search for `@` files

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
- 2-space indentation, semicolons required
- Kebab-case filenames
- Use `.js` extension in imports (ESM requirement)
- Run `npm run build` before committing to verify types
