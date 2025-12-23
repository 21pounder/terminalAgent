# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal Coding Agent is a CLI coding assistant with two modes:
- **Agent Mode** (default): Custom LLM client with tool use (Glob, Grep, Read, Write, Edit, Bash)
- **SDK Mode** (`sdk-agent`): Uses Claude Agent SDK, spawns Claude Code subprocess

## Commands

```bash
# Install dependencies (from repo root)
npm run install:all

# Development
npm run dev          # Runs agent mode via tsx
cd deepresearch && npm run dev:sdk   # SDK mode (must run in regular terminal, not Claude Code)

# Build
npm run build        # TypeScript compilation

# Test
cd deepresearch && npm run test:ui   # Test UI components
```

**Note**: SDK mode (`sdk-agent`) spawns Claude Code as subprocess - cannot run inside Claude Code itself.

## Architecture

```
deepresearch/
├── src/
│   ├── index.ts           # Main entry - SmartInput + mode routing
│   ├── sdk-agent.ts       # SDK entry - Claude Agent SDK wrapper
│   ├── agent/
│   │   ├── loop.ts        # Agent iteration loop (max 15)
│   │   └── prompts.ts     # System prompt + tool definitions
│   ├── skills/            # Slash command workflows
│   │   ├── types.ts       # Skill interface (name, args, execute)
│   │   ├── index.ts       # Registry + parseArgs
│   │   ├── code.ts        # /explain, /review, /refactor
│   │   ├── git.ts         # /commit, /diff, /pr
│   │   ├── search.ts      # /find, /grep, /symbol
│   │   └── run.ts         # /test, /build, /lint
│   ├── tools/             # Tool implementations
│   │   ├── file.ts        # readFile, writeFile, editFile
│   │   ├── search.ts      # glob, grep, findSymbol
│   │   └── shell.ts       # shell, run
│   ├── llm/
│   │   └── client.ts      # Raw HTTPS to config.baseUrl (not Anthropic SDK)
│   ├── ui/                # Enhanced CLI components
│   │   ├── theme.ts       # Colors (tiffany blue #81D8D0, yellow #F1C40F)
│   │   ├── commands.ts    # "/" command picker
│   │   ├── file-browser.ts # "@" file browser
│   │   └── smart-input.ts # Main input handler
│   └── utils/
│       └── config.ts      # Loads .env, exports config object
└── bin/
    ├── agent.cjs          # Global CLI wrapper
    └── sdk-agent.cjs      # SDK CLI wrapper
```

## Key Patterns

**Input Routing** (`src/index.ts`):
- `/` triggers command picker → skill execution
- `@` triggers file browser → attaches file content to message
- Other input → agent loop with tools

**LLM Client** (`src/llm/client.ts`):
Uses raw `https.request` to `config.baseUrl` - supports API proxies without Anthropic SDK.

**Skill System**:
Each skill has `name`, `description`, `usage`, `args[]`, `execute(ctx)`. Context provides `cwd`, `llm`, parsed `args`.

**UI Components**:
Use raw mode for keypresses, ASCII icons for alignment (no emojis). Each readline instance is ephemeral to avoid conflicts with raw mode components.

## Configuration

Create `deepresearch/.env`:
```
ANTHROPIC_API_KEY=your_key
ANTHROPIC_BASE_URL=https://api.anthropic.com  # optional proxy
MODEL=claude-sonnet-4-20250514                 # optional
```

## Conventions

- TypeScript ES modules for `src/`, CommonJS for `bin/`
- 2-space indentation, semicolons
- Kebab-case filenames
- Run `npm run build` to verify types before commit
