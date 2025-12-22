# Repository Guidelines

## Project Structure & Modules
- Single package lives in `deepresearch/`; CLI entry in `bin/agent.cjs`, TypeScript sources in `src/` (`agent.ts`, `run.ts`, helpers), build output in `dist/`.
- Environment config goes in `deepresearch/.env` (not committed). Set `ANTHROPIC_API_KEY` and optional `ANTHROPIC_BASE_URL` via `.env` or shell.
- Do not edit generated files in `dist/`; make changes under `src/` and rebuild.

## Setup, Build, and Run
- Requirements: Node.js 18+ and a valid Anthropic API key.
- Install deps from repo root: `npm run install:all` (runs install inside `deepresearch/`).
- Root commands `cd` into `deepresearch/`:
  - `npm run dev` — run the agent via tsx for fast iteration.
  - `npm run build` — type-check and emit JS with `tsc`.
  - `npm start` — run the compiled output from `dist/`.
- Windows: `setx ANTHROPIC_API_KEY your_key`; Unix shells: `export ANTHROPIC_API_KEY=...`.

## Coding Style & Naming
- TypeScript + ES modules; prefer async/await and named exports.
- 2-space indentation, keep semicolons, favor small single-purpose functions.
- File names stay kebab-case (`simple-agent.cjs`, `run.ts`); prompts/system strings in English, docs may be Chinese.

## Testing & QA
- No automated tests yet; at minimum run `npm run build` before committing to ensure types pass.
- Manual smoke: `npm run dev`, exercise commands like `list_files`, `read_file`, `run_command`; verify tool output is truncated and safety checks fire.
- If adding tests, place `*.spec.ts` near sources (e.g., `src/__tests__/`) and add a script to `deepresearch/package.json`.

## Commit & PR Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`).
- In PRs, note touched areas (`bin/`, `src/`), commands executed (`npm run build`, smoke steps), and any config/env updates. Attach logs for agent runs when useful.
- Update `.env.example` if new configuration keys are introduced; keep diffs scoped.
