# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Claude Agent SDK demo application demonstrating multi-agent research architecture in TypeScript. A lead agent coordinates specialized subagents to perform comprehensive research tasks and generate reports.

## Commands

```bash
# Install dependencies
npm run install:all

# Run the research agent
npm run dev      # Run with tsx
npm run build    # Compile TypeScript (type-safety gate)
npm start        # Run compiled JS
```

## Project Structure

```
deepresearch/
├── src/
│   ├── agent.ts                 # Main entry point, query loop
│   ├── prompts/
│   │   ├── lead-agent.ts        # Coordinator prompt (only uses Task tool)
│   │   ├── researcher.ts        # Web search agent prompt
│   │   └── report-writer.ts     # Report synthesis prompt
│   └── utils/
│       ├── subagent-tracker.ts  # Tracks spawned subagents via hooks
│       └── transcript.ts        # Session logging utilities
└── files/
    ├── research_notes/          # Output from researchers
    └── reports/                 # Final reports from report-writer
```

## Architecture: Multi-Agent Research System

```
Lead Agent (coordinator) ──┬──▶ Researcher ×N (parallel)
  allowedTools: [Task]     │     tools: [WebSearch, Write]
                           │     output: files/research_notes/
                           │
                           └──▶ Report-Writer
                                 tools: [Glob, Read, Write]
                                 input: files/research_notes/
                                 output: files/reports/
```

Key SDK patterns used:
- `agents` config object defines subagent types with description, tools, prompt, model
- `allowedTools: ["Task"]` restricts lead agent to only spawn subagents
- `parent_tool_use_id` on assistant messages tracks which subagent is responding
- `resume: sessionId` maintains conversation continuity
- `permissionMode: "bypassPermissions"` for automated execution
- Pre/PostToolUse hooks for tracking tool calls

## Testing

No automated test harness configured. Run `npm run build` as a type-safety gate. Smoke-test agent flows manually via `npm run dev` and verify tool calls and transcripts.

## Environment

Requires `ANTHROPIC_API_KEY` environment variable.

## Language

Documentation and comments are in Chinese. Code identifiers are in English.
