# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working on this repository.

## Project Overview
Terminal coding assistant powered by Anthropic Messages API. The agent can explore codebases, read/write files, and execute shell commands via tool calls.

## Commands
```bash
# Install dependencies
npm run install:all

# Run the coding agent
npm run dev      # tsx entry
npm run build    # compile TypeScript
npm start        # run compiled JS
```

## Project Structure
```
deepresearch/
├── src/
│  ├── agent.ts    # Main agent loop
│  ├── run.ts      # Runner utilities
│  └── tools.ts    # Tool definitions and execution logic
├── bin/agent.cjs  # CLI entry
├── .env           # API configuration (not committed)
└── package.json
```

## Architecture
Single agent calling the Anthropic Messages API with tools:
- Glob, Grep, Read, Write, Edit, Bash (with safety guards)
- CLI prompts the user for approvals on risky commands

## Configuration
Create `deepresearch/.env` or export variables:
```
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com  # or custom endpoint
```

## Notes
- Identifiers are in English; user-facing docs can be Chinese.
- Tool outputs are truncated for safety; dangerous shell patterns are blocked.
