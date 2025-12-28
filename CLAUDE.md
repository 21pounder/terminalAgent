# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal Coding Agent (v5.0) is a CLI-based multi-agent coding assistant powered by the Claude Agent SDK. It wraps the SDK's `query()` function with a custom terminal UI featuring:
- `/` command menu for invoking Skills
- `@` file browser for attaching files to context
- Smart routing to specialized agents (Reader, Coder, Reviewer, Coordinator)
- Inter-agent communication via message bus and shared context
- Multiple execution modes: single, parallel, react, coordinator

**Important**: The agent spawns Claude Code as a subprocess and cannot run inside Claude Code itself.

## Commands

```bash
# From repo root
npm run install:all    # Install all dependencies (into deepresearch/)
npm run dev            # Development (tsx src/index.ts)
npm run build          # TypeScript compilation
npm start              # Run compiled output

# From deepresearch/ directory
npm run test:ui        # Test UI components

# Global CLI (after npm link in deepresearch/)
agent                  # Interactive mode
agent "your question"  # Single query
agent /commit          # Invoke a skill directly
```

## Architecture

```
deepresearch/
├── src/
│   ├── index.ts                  # Main entry, input loop, runQuery/runCoordinator
│   ├── agents/                   # Agent classes
│   │   ├── base.ts               # BaseAgent abstract class (SDK integration)
│   │   ├── types.ts              # SubagentType, AgentConfig, AgentResult
│   │   ├── coordinator.ts        # Multi-agent dispatch, [DISPATCH:agent] parsing
│   │   ├── reader.ts             # Code reading and analysis
│   │   ├── coder.ts              # Code writing and modification
│   │   └── reviewer.ts           # Code review and quality checks
│   ├── core/
│   │   ├── router.ts             # Router class - keyword matching, skill→agent mapping
│   │   ├── session.ts            # Session management
│   │   └── permissions.ts        # Permission mode handling
│   ├── runtime/
│   │   ├── bus.ts                # MessageBus - inter-agent pub/sub communication
│   │   ├── shared.ts             # SharedContext - cross-agent state
│   │   ├── pool.ts               # AgentPool - task queue and parallel execution
│   │   ├── orchestrator.ts       # Orchestrator - execution mode coordination
│   │   └── react.ts              # ReAct executor for multi-step reasoning
│   ├── config/
│   │   ├── agents.ts             # AGENT_CONFIGS, AGENT_KEYWORDS, SKILL_AGENT_MAP
│   │   ├── constants.ts          # VERSION, MAX_SUBAGENT_DEPTH, DEFAULT_MODEL
│   │   └── tools.ts              # MCP_SERVERS configuration
│   ├── ui/
│   │   ├── smart-input.ts        # SmartInput - main input with "/" and "@" triggers
│   │   ├── commands.ts           # CommandPicker - arrow-key navigable "/" menu
│   │   ├── file-browser.ts       # FileBrowser - "@" file selection
│   │   └── theme.ts              # ANSI colors, icons, box drawing
│   ├── tools/
│   │   ├── message.ts            # MessageTool - agent messaging wrapper
│   │   ├── context.ts            # ContextTool - shared context wrapper
│   │   └── dispatch.ts           # Dispatch utilities
│   └── utils/
│       ├── prompt-loader.ts      # Loads agent prompts from .md files
│       ├── transcript.ts         # Session logging (text + JSON)
│       └── message-handler.ts    # SDK message processing
├── prompts/                      # Agent-specific system prompts (.md)
├── .claude/skills/               # Global Skills
├── bin/agent.cjs                 # Global CLI entry (CommonJS wrapper)
└── dist/                         # Build output
```

## Multi-Agent System

**Agent Types** (defined in `config/agents.ts`):
- **Coordinator** (🎯): Task decomposition, multi-agent dispatch via `[DISPATCH:agent]`
- **Reader** (📖): Code reading, analysis, understanding
- **Coder** (💻): Code writing, modification, implementation
- **Reviewer** (🔍): Code review, quality checks, bug detection

**Routing Logic** (`core/router.ts`):
1. Skill commands have highest priority (`/code-review` → Reviewer via `SKILL_AGENT_MAP`)
2. Keyword detection with word boundaries (see `AGENT_KEYWORDS` in `config/agents.ts`)
3. Default to Reader for understanding context first

**Execution Modes** (via `runtime/orchestrator.ts`):
- `single`: Direct agent execution
- `parallel`: Multiple agents via `AgentPool`
- `react`: Multi-step reasoning loop
- `coordinator`: Reader → Coder → Reviewer pipeline

**Inter-Agent Communication**:
- `MessageBus` (`runtime/bus.ts`): EventEmitter-based pub/sub
- `SharedContext` (`runtime/shared.ts`): Key-value store for cross-agent state

## Key Patterns

**SDK Integration** (`agents/base.ts`):
- Uses `@anthropic-ai/claude-agent-sdk`'s `query()` function
- Configures: `settingSources: ["project"]`, `additionalDirectories`, `mcpServers`
- Uses `permissionMode`: "acceptEdits" (safe) or "bypassPermissions" (unsafe)
- Streams messages via async iterator, handles `system`, `assistant`, `result`, `tool_progress`

**Skills Loading** (`index.ts: loadSkillsFromDir`):
- Global skills: `deepresearch/.claude/skills/`
- Project skills: `<cwd>/.claude/skills/`
- Internal skills (hidden from menu): `web-scrape`, `doc-generate`, `deep-research`

**Dispatch Pattern** (`index.ts: detectDispatch`):
- Coordinator outputs `[DISPATCH:reader] task description`
- Main loop parses these and spawns subagents
- Results are fed back to Coordinator for synthesis

**UI Components** (`src/ui/`):
- All use raw `process.stdin` with `setRawMode(true)` for keyboard handling
- `SmartInput`: Main input, detects `/` and `@` triggers
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
- Global singletons: `getRouter()`, `getMessageBus()`, `getSharedContext()`, `getOrchestrator()`
