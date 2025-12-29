# Terminal Coding Agent

A powerful CLI-based multi-agent coding assistant powered by [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk).

<p align="center">
  <img src="https://img.shields.io/badge/version-7.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Claude-Agent%20SDK-orange" alt="Claude Agent SDK">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

## Features

- **Multi-Agent Architecture** - Coordinator, Reader, Coder, Reviewer agents working together
- **Smart Routing** - Automatically routes tasks to the most suitable agent
- **Skills System** - Extensible skills for specialized tasks (code review, git commit, PDF analysis, etc.)
- **Interactive UI** - `/` command menu and `@` file browser for easy interaction
- **Web Scraping** - Built-in Playwright integration for web content extraction
- **Deep Research** - Dify-powered comprehensive research workflow

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/terminalAgent.git
cd terminalAgent
npm run install:all
```

### 2. Configure Environment

Copy the example environment file and add your API key:

```bash
cp deepresearch/.env.example deepresearch/.env
```

Edit `deepresearch/.env`:

```env
ANTHROPIC_API_KEY=your-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

Supports custom API endpoints (e.g., API proxy services).

### 3. Run

```bash
# Development mode
npm run dev

# Or build and run
npm run build
npm start
```

### 4. Global CLI (Optional)

```bash
cd deepresearch
npm link

# Now you can use from anywhere:
agent                    # Interactive mode
agent "your question"    # Single query
agent /code-review       # Invoke a skill
```

## Usage

### Interactive Mode

```
╔══════════════════════════════════════════════════════════════╗
║            Terminal Coding Agent v7.0                        ║
╚══════════════════════════════════════════════════════════════╝

Your AI assistant for coding tasks.
Ask me any questions. Type 'exit' or 'quit' to end.

❯ /code-review src/index.ts
```

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/mode` | Switch permission mode (safe/unsafe) |
| `/clear` | Start new session |
| `/exit` | Exit program |
| `@` | Open file browser |
| `@file.ts` | Attach file to context |

### Built-in Skills

| Skill | Description |
|-------|-------------|
| `/code-review` | Analyze code quality, find bugs, security issues |
| `/git-commit` | Create well-structured conventional commits |
| `/pdf-analyze` | Extract text/tables from PDFs, fill forms |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Smart Router                                │
│         (Keyword matching, Skill detection)                  │
└───────┬─────────┬─────────┬─────────┬───────────────────────┘
        │         │         │         │
        ▼         ▼         ▼         ▼
    ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐
    │Reader │ │ Coder │ │Review │ │Coordinator│
    │  📖   │ │  💻   │ │  🔍   │ │    🎯     │
    └───────┘ └───────┘ └───────┘ └───────────┘
        │         │         │         │
        └─────────┴─────────┴─────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   [DISPATCH:agent]    │
              │   Inter-agent calls   │
              └───────────────────────┘
```

### Agent Types

| Agent | Icon | Role |
|-------|------|------|
| **Coordinator** | 🎯 | Task decomposition, multi-agent dispatch |
| **Reader** | 📖 | Code reading, analysis, understanding |
| **Coder** | 💻 | Code writing, modification, implementation |
| **Reviewer** | 🔍 | Code review, quality checks, bug detection |

### Available Tools

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Create/overwrite files |
| `Edit` | Edit existing files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search text in files |
| `LSP` | Language Server Protocol integration |
| `WebFetch` | Fetch web content |
| `WebSearch` | Search the web |
| `Skill` | Invoke skills |

## Project Structure

```
terminalAgent/
├── deepresearch/
│   ├── src/
│   │   ├── index.ts              # Main entry point
│   │   ├── agents/               # Agent implementations
│   │   │   ├── base.ts           # BaseAgent class
│   │   │   ├── coordinator.ts    # Coordinator agent
│   │   │   ├── reader.ts         # Reader agent
│   │   │   ├── coder.ts          # Coder agent
│   │   │   └── reviewer.ts       # Reviewer agent
│   │   ├── core/
│   │   │   ├── router.ts         # Smart routing logic
│   │   │   └── session.ts        # Session management
│   │   ├── config/
│   │   │   ├── agents.ts         # Agent configurations
│   │   │   └── constants.ts      # Constants
│   │   ├── ui/
│   │   │   ├── smart-input.ts    # Input with "/" and "@"
│   │   │   ├── commands.ts       # Command picker
│   │   │   └── file-browser.ts   # File browser
│   │   └── prompts/              # Agent system prompts
│   ├── .claude/
│   │   └── skills/               # Skill definitions
│   ├── bin/agent.cjs             # CLI entry point
│   └── package.json
├── CLAUDE.md                     # Instructions for Claude Code
└── README.md
```

## Custom Skills

Create custom skills in `.claude/skills/<skill-name>/SKILL.md`:

```markdown
---
name: my-skill
description: Description of what this skill does
version: 1.0.0
allowed-tools:
  - Read
  - Write
  - Bash
---

# My Custom Skill

Instructions for Claude on how to execute this skill...
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |
| `ANTHROPIC_BASE_URL` | API endpoint (default: api.anthropic.com) | No |
| `ANTHROPIC_MODEL` | Model to use (default: claude-sonnet-4-20250514) | No |
| `DIFY_API_KEY` | Dify API key for deep-research skill | No |
| `DIFY_BASE_URL` | Dify API endpoint | No |

## Development

```bash
# Install dependencies
npm run install:all

# Development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run compiled version
npm start

# Test UI components
cd deepresearch && npm run test:ui
```

## Tech Stack

- **TypeScript** - Type-safe development
- **@anthropic-ai/claude-agent-sdk** - Claude Agent SDK
- **Playwright** - Web automation and scraping
- **Cheerio** - HTML parsing
- **dotenv** - Environment configuration

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
