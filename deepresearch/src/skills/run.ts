/**
 * Run Skills - test, build, lint
 */
import type { Skill } from "./types.js";
import { success, failure } from "./types.js";
import { run } from "../tools/shell.js";
import { fileExists } from "../tools/file.js";

/**
 * /test - Run tests
 */
export const testSkill: Skill = {
  name: "test",
  description: "Run project tests",
  usage: "/test [--watch]",
  args: [
    { name: "watch", description: "Watch mode", required: false },
  ],

  async execute(ctx) {
    let testCmd = "";

    if (await fileExists("package.json")) {
      if (await fileExists("vitest.config.ts") || await fileExists("vitest.config.js")) {
        testCmd = ctx.args.watch ? "npx vitest" : "npx vitest run";
      } else if (await fileExists("jest.config.js") || await fileExists("jest.config.ts")) {
        testCmd = ctx.args.watch ? "npx jest --watch" : "npx jest";
      } else {
        testCmd = "npm test";
      }
    } else if (await fileExists("pytest.ini") || await fileExists("pyproject.toml")) {
      testCmd = "pytest";
    } else if (await fileExists("Cargo.toml")) {
      testCmd = "cargo test";
    } else if (await fileExists("go.mod")) {
      testCmd = "go test ./...";
    } else {
      return failure("Unable to detect test framework. Please run tests manually.");
    }

    const result = await run(testCmd);
    return success(`Running: ${testCmd}\n\n${result}`);
  },
};

/**
 * /build - Build project
 */
export const buildSkill: Skill = {
  name: "build",
  description: "Build project",
  usage: "/build",
  args: [],

  async execute() {
    let buildCmd = "";

    if (await fileExists("package.json")) {
      if (await fileExists("tsconfig.json")) {
        buildCmd = "npm run build";
      } else if (await fileExists("vite.config.ts") || await fileExists("vite.config.js")) {
        buildCmd = "npx vite build";
      } else {
        buildCmd = "npm run build";
      }
    } else if (await fileExists("Cargo.toml")) {
      buildCmd = "cargo build --release";
    } else if (await fileExists("go.mod")) {
      buildCmd = "go build ./...";
    } else if (await fileExists("Makefile")) {
      buildCmd = "make";
    } else {
      return failure("Unable to detect build tool. Please run build manually.");
    }

    const result = await run(buildCmd);

    if (result.includes("error") || result.includes("Error")) {
      return failure(`Build failed:\n\n${result}`);
    }

    return success(`Running: ${buildCmd}\n\n${result}`);
  },
};

/**
 * /lint - Code linting
 */
export const lintSkill: Skill = {
  name: "lint",
  description: "Run code linting",
  usage: "/lint [--fix]",
  args: [
    { name: "fix", description: "Auto-fix issues", required: false },
  ],

  async execute(ctx) {
    const fix = ctx.args.fix === "true" || ctx.args.fix === "";
    let lintCmd = "";

    if (await fileExists("package.json")) {
      if (await fileExists(".eslintrc.js") || await fileExists(".eslintrc.json") || await fileExists("eslint.config.js")) {
        lintCmd = fix ? "npx eslint . --fix" : "npx eslint .";
      } else if (await fileExists("biome.json")) {
        lintCmd = fix ? "npx biome check --apply ." : "npx biome check .";
      } else {
        lintCmd = fix ? "npm run lint -- --fix" : "npm run lint";
      }
    } else if (await fileExists("pyproject.toml")) {
      if (await fileExists(".ruff.toml") || await fileExists("ruff.toml")) {
        lintCmd = fix ? "ruff check --fix ." : "ruff check .";
      } else {
        lintCmd = "pylint .";
      }
    } else if (await fileExists("Cargo.toml")) {
      lintCmd = "cargo clippy";
    } else if (await fileExists("go.mod")) {
      lintCmd = "golangci-lint run";
    } else {
      return failure("Unable to detect linter. Please run linting manually.");
    }

    const result = await run(lintCmd);
    return success(`Running: ${lintCmd}\n\n${result}`);
  },
};
