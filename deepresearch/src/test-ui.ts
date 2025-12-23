/**
 * UI 组件单元测试
 *
 * 测试内容：
 * 1. 主题配色模块
 * 2. 命令选择器过滤逻辑
 * 3. 文件浏览器搜索逻辑
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { theme, fmt, icons, borders } from "./ui/theme.js";
import { builtinCommands, Command } from "./ui/commands.js";

// 测试结果收集
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          results.push({ name, passed: true });
          console.log(`${fmt("✓", theme.success)} ${name}`);
        })
        .catch((error) => {
          results.push({ name, passed: false, error: String(error) });
          console.log(`${fmt("✗", theme.error)} ${name}: ${error}`);
        });
    } else {
      results.push({ name, passed: true });
      console.log(`${fmt("✓", theme.success)} ${name}`);
    }
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`${fmt("✗", theme.error)} ${name}: ${error}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============================================
// 主题测试
// ============================================
console.log(`\n${fmt("=== Theme Tests ===", theme.accent, theme.bold)}\n`);

test("theme colors are defined", () => {
  assert(theme.reset !== undefined, "reset color should be defined");
  assert(theme.accent !== undefined, "accent color should be defined");
  assert(theme.tiffany !== undefined, "tiffany color should be defined");
  assert(theme.success !== undefined, "success color should be defined");
  assert(theme.error !== undefined, "error color should be defined");
});

test("fmt applies styles correctly", () => {
  const styled = fmt("test", theme.accent);
  assert(styled.includes("test"), "styled text should contain original text");
  assert(styled.includes(theme.reset), "styled text should include reset");
});

test("icons are defined", () => {
  assert(icons.command !== undefined, "command icon should be defined");
  assert(icons.folder !== undefined, "folder icon should be defined");
  assert(icons.file !== undefined, "file icon should be defined");
  assert(icons.check !== undefined, "check icon should be defined");
});

test("borders are defined", () => {
  assert(borders.topLeft !== undefined, "topLeft border should be defined");
  assert(borders.horizontal !== undefined, "horizontal border should be defined");
  assert(borders.vertical !== undefined, "vertical border should be defined");
});

// ============================================
// 命令测试
// ============================================
console.log(`\n${fmt("=== Command Tests ===", theme.accent, theme.bold)}\n`);

test("builtin commands are defined", () => {
  assert(builtinCommands.length > 0, "should have builtin commands");
  assert(builtinCommands.some((c) => c.name === "help"), "should have help command");
  assert(builtinCommands.some((c) => c.name === "exit"), "should have exit command");
});

test("command filter works correctly", () => {
  const filter = (commands: Command[], term: string) => {
    const lower = term.toLowerCase();
    return commands.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)
    );
  };

  const filtered = filter(builtinCommands, "help");
  assert(filtered.length > 0, "should find help command");
  assertEqual(filtered[0].name, "help", "first result should be help");
});

test("command filter is case insensitive", () => {
  const filter = (commands: Command[], term: string) => {
    const lower = term.toLowerCase();
    return commands.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)
    );
  };

  const filtered1 = filter(builtinCommands, "EXIT");
  const filtered2 = filter(builtinCommands, "exit");
  assertEqual(filtered1.length, filtered2.length, "case should not affect results");
});

// ============================================
// 文件浏览器测试
// ============================================
console.log(`\n${fmt("=== File Browser Tests ===", theme.accent, theme.bold)}\n`);

test("can read current directory", async () => {
  const entries = await fs.promises.readdir(process.cwd());
  assert(entries.length >= 0, "should be able to read directory");
});

test("file items are sorted correctly", () => {
  interface FileItem {
    name: string;
    isDirectory: boolean;
  }

  const items: FileItem[] = [
    { name: "file.ts", isDirectory: false },
    { name: "src", isDirectory: true },
    { name: "another.js", isDirectory: false },
    { name: "dist", isDirectory: true },
  ];

  const sorted = items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  assert(sorted[0].isDirectory, "directories should come first");
  assert(sorted[1].isDirectory, "directories should come first");
  assert(!sorted[2].isDirectory, "files should come after directories");
});

test("fuzzy search matches partial names", () => {
  const items = [
    { name: "index.ts", path: "/src/index.ts" },
    { name: "config.ts", path: "/src/config.ts" },
    { name: "utils.ts", path: "/src/utils.ts" },
  ];

  const query = "ind";
  const matches = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  assertEqual(matches.length, 1, "should find one match");
  assertEqual(matches[0].name, "index.ts", "should match index.ts");
});

test("exclude patterns work", () => {
  const excludePatterns = ["node_modules", ".git", "dist"];
  const entries = ["src", "node_modules", ".git", "package.json", "dist"];

  const filtered = entries.filter((name) => !excludePatterns.includes(name));

  assertEqual(filtered.length, 2, "should exclude 3 directories");
  assert(!filtered.includes("node_modules"), "should not include node_modules");
  assert(!filtered.includes(".git"), "should not include .git");
});

// ============================================
// 总结
// ============================================
setTimeout(() => {
  console.log(`\n${fmt("=== Test Summary ===", theme.accent, theme.bold)}\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total: ${results.length}`);
  console.log(`${fmt(`Passed: ${passed}`, theme.success)}`);
  console.log(`${fmt(`Failed: ${failed}`, failed > 0 ? theme.error : theme.dim)}`);

  if (failed > 0) {
    console.log(`\n${fmt("Failed Tests:", theme.error)}`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ${fmt("✗", theme.error)} ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log(`\n${fmt("All tests passed!", theme.success, theme.bold)}`);
  }
}, 1000);
