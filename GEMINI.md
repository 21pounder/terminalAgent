# Terminal Coding Agent (Gemini Context)

This document provides context for the Gemini AI agent to understand and interact with the Terminal Coding Agent project.

## Project Overview

**Name:** Terminal Coding Agent
**Version:** 2.2
**Purpose:** A CLI-based coding assistant that brings the power of Claude 3.5 Sonnet directly into the terminal. It can explore codebases, read/write files, and execute shell commands to assist with software engineering tasks.
**Core Technology:**
*   **Runtime:** Node.js (TypeScript source, CommonJS distribution).
*   **AI Model:** Claude 3.5 Sonnet (via `api.vectorengine.ai` proxy).
*   **Tooling:** Custom XML-based tool calling protocol (bypassing standard SDK tool definitions).

## Architecture & Design

The project deviates from standard Anthropic SDK usage to accommodate specific proxy requirements and control mechanisms.

*   **Communication:** Uses raw HTTPS requests to `api.vectorengine.ai/v1/messages`.
*   **Tool Protocol:** The agent outputs XML-like tags (e.g., `<read_file><path>...</path></read_file>`) which are parsed by the client using Regular Expressions.
    *   *Note:* `src/tools.ts` defines standard SDK tools, but the active CLI (`bin/agent.cjs` and `src/agent.ts`) uses the XML parsing approach instead.
*   **Safety:** Critical commands (especially shell execution and file writes) require user confirmation via a CLI prompt, unless the `-y` / `--yes` flag is used or "auto-approve" is enabled.

## Key Files & Directories

*   **`deepresearch/`**: The main package directory.
    *   **`bin/agent.cjs`**: The production CLI entry point. Contains the full agent implementation in CommonJS.
    *   **`src/agent.ts`**: The development entry point (`npm run dev`). Written in TypeScript, mirrors the logic of `bin/agent.cjs`.
    *   **`src/tools.ts`**: Definitions for SDK-style tools (Note: seemingly unused in the main CLI flow, likely for reference or future SDK integration).
    *   **`src/test-query.cjs`**: Script for testing single-shot queries.
    *   **`.env`**: Configuration file (must contain `ANTHROPIC_API_KEY`).

## Building and Running

All commands should be run from the `deepresearch/` directory or via the root scripts.

### Prerequisite
Create `deepresearch/.env` with your API key:
```env
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com # Optional
```

### Commands

| Action | Command (Root) | Command (deepresearch/) | Description |
| :--- | :--- | :--- | :--- |
| **Install** | `npm run install:all` | `npm install` | Install dependencies. |
| **Dev Run** | `npm run dev` | `npm run dev` | Run `src/agent.ts` using `tsx`. |
| **Build** | `npm run build` | `npm run build` | Compile TypeScript to `dist/`. |
| **Start** | `npm start` | `npm start` | Run the built agent. |
| **CLI Usage** | N/A | `node bin/agent.cjs [query]` | Run the production CLI. |

## Development Conventions

*   **Language:** TypeScript for source code (`src/`), CommonJS for scripts/binaries (`bin/`, `*.cjs`).
*   **Style:**
    *   2-space indentation.
    *   Kebab-case filenames (e.g., `simple-agent.cjs`).
    *   English identifiers and logs; user-facing docs/prompts may be in Chinese.
*   **Tool Implementation:** When modifying agent capabilities, ensure changes are reflected in both the XML parsing logic (in `agent.ts`/`agent.cjs`) and the system prompt definition.
*   **Testing:** Primarily manual testing via `src/test-query.cjs` or running the agent interactively.

## Available Tools (XML Protocol)

The agent uses the following XML tags to invoke tools:

1.  **`<read_file>`**: Reads file content.
    *   `<path>`: Relative or absolute path.
2.  **`<write_file>`**: Writes/overwrites file content.
    *   `<path>`: Destination path.
    *   `<content>`: File content.
3.  **`<list_files>`**: Finds files matching a pattern.
    *   `<pattern>`: Glob or filename pattern.
4.  **`<run_command>`**: Executes shell commands.
    *   `<command>`: Shell command (blocked: dangerous commands like `rm -rf`).
