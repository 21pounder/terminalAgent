# Terminal Coding Agent (Gemini Context)

This document provides context for the Gemini AI agent to understand and interact with the Terminal Coding Agent project.

## Project Overview

**Name:** Terminal Coding Agent
**Version:** 4.1.0
**Purpose:** A comprehensive CLI-based coding assistant that leverages Claude 3.5 Sonnet to perform software engineering tasks. It features a dual-mode interface: specific "Skills" (Slash Commands) for targeted tasks and an autonomous "Agent" for complex problem-solving.
**Core Technology:**
*   **Runtime:** Node.js (TypeScript source, CommonJS/ESM hybrid distribution).
*   **AI Model:** Claude 3.5 Sonnet (via `api.vectorengine.ai` proxy or direct Anthropic API).
*   **Architecture:** Modular design separating High-level Skills, Autonomous Agent Loop, Low-level Tools, and LLM Client.

## Architecture & Design

The project is structured to support both deterministic command execution and probabilistic agentic reasoning.

### Key Components

*   **`src/index.ts`**: The main CLI entry point. It handles input routing, differentiating between Slash Commands (routing to Skills) and natural language (routing to Agent).
*   **`src/skills/`**: Implements "Skills" - specific capabilities exposed as slash commands (e.g., `/explain`, `/refactor`, `/pr`).
    *   **Logic**: Each skill encapsulates the workflow: Argument Parsing -> Tool Execution -> LLM Prompting -> Output Formatting.
*   **`src/agent/`**: Implements the autonomous "Agent" loop.
    *   **`loop.ts`**: The main "Thought-Action-Observation" loop using Claude's Native Tool Use (Function Calling).
*   **`src/tools/`**: Low-level primitives (File I/O, Shell, Git, Search). These are used by both Skills and the Agent.
*   **`src/llm/`**: A custom wrapper around the Anthropic API (`client.ts`) to handle proxy connections (bypassing standard SDK limitations) and normalize Tool Use interactions.

## Key Files & Directories

*   **`deepresearch/`**: The main package directory.
    *   **`src/index.ts`**: CLI Entry point.
    *   **`src/skills/index.ts`**: Registry for all available skills.
    *   **`src/agent/prompts.ts`**: System prompts and tool definitions for the Agent.
    *   **`src/tools/index.ts`**: Exports for low-level tools.
    *   **`bin/agent.cjs`**: Production CLI binary.

## Usage Modes

The agent supports two primary interaction modes:

1.  **Skill Mode (Slash Commands):**
    *   Directly invokes a specific skill.
    *   Example: `/explain src/main.ts` or `/pr --title "Fix bug"`
    *   Best for: Well-defined tasks like explaining code, creating PRs, or running tests.

2.  **Agent Mode (Natural Language):**
    *   triggered by typing natural language without a leading slash.
    *   Example: "Analyze the project structure and suggest improvements."
    *   Best for: Open-ended exploration, debugging, and complex refactoring.

## Building and Running

All commands should be run from the `deepresearch/` directory or via the root scripts.

### Prerequisite
Create `deepresearch/.env` with your API key:
```env
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_BASE_URL=https://api.vectorengine.ai/v1 # Or official endpoint
```

### Commands

| Action | Command (Root) | Command (deepresearch/) | Description |
| :--- | :--- | :--- | :--- |
| **Install** | `npm run install:all` | `npm install` | Install dependencies. |
| **Dev Run** | `npm run dev` | `npm run dev` | Run `src/index.ts` using `tsx`. |
| **Build** | `npm run build` | `npm run build` | Compile TypeScript to `dist/`. |
| **Start** | `npm start` | `npm start` | Run the built agent. |

## Development Conventions

*   **Code Style:** TypeScript, strict types.
*   **Skills:** When adding a new capability, prefer creating a "Skill" in `src/skills/` if it's a specific workflow, or adding to `src/agent/prompts.ts` if it's a general tool for the autonomous agent.
*   **LLM Interaction:** Use `src/llm/client.ts` for all API calls to ensure proxy compatibility.
*   **Tools:** Low-level operations (fs, git, shell) belong in `src/tools/` and should be pure functions where possible.
