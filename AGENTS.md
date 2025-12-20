# Repository Guidelines

## Project Structure & Module Organization
- Root orchestrates three TypeScript packages: asic/ (intro flows), deepresearch/ (code-defined agents), deepresearch-md/ (Markdown-defined agents). Each has its own package.json, 	sconfig.json, and src/.
- Agent definitions for the markdown variant live in deepresearch-md/.claude/agents/*.md; helper code sits in deepresearch-md/src/.
- The asic/src folder contains example flows plus mcps/, 	ools/, and utils/ helpers; start from asic/src/index.ts.
- Environment samples are in .env.example; keep real secrets in process env vars.

## Setup, Build, and Run
- Requirements: Node.js 18+, a valid ANTHROPIC_API_KEY.
- Install everything once: 
pm run install:all.
- Run per package:
  - cd basic && npm run dev (tsx live run), 
pm run build (tsc emit), 
pm start (run built output).
  - cd deepresearch && npm run dev|build|start for the code-driven agent.
  - cd deepresearch-md && npm run dev|build|start for the markdown-driven agent.
- Set env vars before running, e.g. setx ANTHROPIC_API_KEY your_key on Windows or export in your shell.

## Coding Style & Naming Conventions
- TypeScript with ES modules; prefer named exports and async/await.
- Indent with 2 spaces, keep semicolons, and favor small, single-purpose functions.
- File names are kebab-case (	ui-chat-with-tools.ts); mirror that for new modules and .claude/agents/*.md.
- Keep configuration in 	sconfig.json untouched unless all packages are updated together.

## Testing Guidelines
- No automated test harness is configured; at minimum run 
pm run build in touched packages as a type-safety gate.
- Add new tests as *.spec.ts alongside source (e.g., src/__tests__/ or near the module) using your preferred runner; document the command in package.json when introduced.
- For agent flows, smoke-test manually by running the relevant 
pm run dev target and verifying tool calls and transcripts.

## Commit & Pull Request Guidelines
- Repository has no commit history yet; adopt Conventional Commit prefixes (eat:, ix:, chore:) for clarity.
- In PRs, describe which package(s) changed, commands executed (
pm run build, manual smoke tests), and any config/env updates. Include screenshots or logs for TUI runs when relevant.
- Keep diffs scoped; update .env.example if new configuration is required.
