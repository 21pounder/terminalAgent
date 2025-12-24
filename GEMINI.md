# Terminal Coding Agent (Gemini Context)

This document provides context for the Gemini AI agent to understand and interact with the Terminal Coding Agent project.

## Project Overview

**Name:** Terminal Coding Agent
**Version:** 5.0.0
**Purpose:** A terminal coding assistant powered directly by the official **Claude Agent SDK**. It enables natural language coding tasks and supports custom "Skills" defined via Markdown.
**Core Technology:**
*   **Runtime:** Node.js (TypeScript).
*   **Engine:** `@anthropic-ai/claude-agent-sdk`.
*   **Skill System:** Doc-based skills (Markdown definitions in `.claude/skills/`).

## Architecture & Design

This version (v5) moves away from custom tool loops and raw API calls, fully embracing the official SDK.

### Key Components

*   **`src/index.ts`**: The CLI entry point.
    *   Initializes the SDK `query()` function.
    *   Handles "Smart Input" (files references with `@`, command completion).
    *   Dynamically loads skills from `.claude/skills` directories.
*   **Skills System (`.claude/skills/`)**:
    *   Skills are defined as directories containing a `SKILL.md` file.
    *   The SDK reads these definitions and injects them as capabilities into the agent context.
    *   This allows for "Low-Code" skill creation (Prompt Engineering vs. Coding).
*   **UI (`src/ui/`)**:
    *   Custom TUI components for input, banners, and message formatting.

## Usage

### Interaction Modes

1.  **Natural Language:**
    *   "Refactor src/index.ts to use a class."
    *   "Explain the authentication logic."

2.  **Skill Invocation:**
    *   Slash commands (e.g., `/deep-research`, `/code-migrate`) are routed to the specific skill defined in `.claude/skills/`.
    *   The agent uses the prompt instructions in `SKILL.md` to execute the task.

3.  **File Context:**
    *   Use `@filename` to explicitly attach files to the context (e.g., "Fix the bug in @src/utils.ts").

## Directory Structure

*   **`deepresearch/`**
    *   **`.claude/skills/`**: (User-defined) Collection of skill directories (e.g., `code-migrate/SKILL.md`).
    *   **`src/`**
        *   **`index.ts`**: Main logic and SDK integration.
        *   **`ui/`**: UI components.
    *   **`bin/`**: Executable entry points.

## Building and Running

### Prerequisites
*   Node.js 18+
*   `ANTHROPIC_API_KEY` set in `deepresearch/.env`

### Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Install** | `npm install` | Install dependencies (inside `deepresearch/`). |
| **Run (Dev)** | `npm run dev` | Run with `tsx` (hot reload). |
| **Build** | `npm run build` | Compile to `dist/`. |
| **Start** | `npm start` | Run compiled code. |

## Development Conventions

*   **Skills:** Do NOT write TypeScript logic for skills unless extending the SDK core. Instead, create a new directory in `.claude/skills/<skill-name>` and add a `SKILL.md`.
*   **UI:** Use the `SmartInput` class for any user interaction to ensure consistent `@` file referencing behavior.
