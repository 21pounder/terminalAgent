/**
 * Terminal Coding Agent - CLI Entry (v4.1)
 *
 * 增强版 CLI，支持：
 * - "/" 智能指令选择器
 * - "@" 文件浏览器引用
 * - 优化的配色方案
 */
import * as path from "node:path";
import * as fs from "node:fs";
import { runSkill, listSkills, getAllSkills, getSkill } from "./skills/index.js";
import { agentLoop } from "./agent/index.js";
import { logger, config, validateConfig } from "./utils/index.js";
import {
  theme,
  icons,
  borders,
  fmt,
  SmartInput,
  Command,
  builtinCommands,
  FileItem,
  showCursor,
} from "./ui/index.js";

// 版本号
const VERSION = "4.1.0";

/**
 * 打印 Banner
 */
function printBanner(): void {
  const width = 50;
  const inner = width - 2;

  console.log();
  console.log(
    fmt(borders.topLeft, theme.tiffany) +
    fmt(borders.horizontal.repeat(inner), theme.tiffany) +
    fmt(borders.topRight, theme.tiffany)
  );

  const title = `${icons.sparkle} Terminal Agent v${VERSION}`;
  const titlePad = Math.floor((inner - title.length + 10) / 2);
  console.log(
    fmt(borders.vertical, theme.tiffany) +
    " ".repeat(titlePad) +
    fmt(icons.sparkle, theme.accent) +
    fmt(` Terminal Agent v${VERSION}`, theme.white, theme.bold) +
    " ".repeat(inner - titlePad - title.length + 10) +
    fmt(borders.vertical, theme.tiffany)
  );

  const subtitle = "Powered by Claude";
  const subPad = Math.floor((inner - subtitle.length) / 2);
  console.log(
    fmt(borders.vertical, theme.tiffany) +
    " ".repeat(subPad) +
    fmt(subtitle, theme.dim) +
    " ".repeat(inner - subPad - subtitle.length) +
    fmt(borders.vertical, theme.tiffany)
  );

  console.log(
    fmt(borders.bottomLeft, theme.tiffany) +
    fmt(borders.horizontal.repeat(inner), theme.tiffany) +
    fmt(borders.bottomRight, theme.tiffany)
  );

  console.log();
  console.log(fmt(`  ${icons.folder} `, theme.accent) + fmt(config.workingDir, theme.dim));
  console.log();
  console.log(fmt("  Shortcuts:", theme.white));
  console.log(fmt(`    ${icons.chevronRight} `, theme.tiffany) + fmt("/", theme.accent) + fmt(" - Command menu", theme.dim));
  console.log(fmt(`    ${icons.chevronRight} `, theme.tiffany) + fmt("@", theme.accent) + fmt(" - File browser", theme.dim));
  console.log(fmt(`    ${icons.chevronRight} `, theme.tiffany) + fmt("exit", theme.accent) + fmt(" - Quit", theme.dim));
  console.log();
}

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log();
  console.log(fmt(`${icons.sparkle} Help`, theme.accent, theme.bold));
  console.log();

  console.log(fmt("  Built-in Commands:", theme.tiffany));
  console.log(fmt(`    /help     `, theme.accent) + fmt("- Show this help", theme.dim));
  console.log(fmt(`    /skills   `, theme.accent) + fmt("- List available skills", theme.dim));
  console.log(fmt(`    /clear    `, theme.accent) + fmt("- Clear screen", theme.dim));
  console.log(fmt(`    /exit     `, theme.accent) + fmt("- Exit program", theme.dim));
  console.log();

  console.log(fmt("  File Reference:", theme.tiffany));
  console.log(fmt(`    @         `, theme.accent) + fmt("- Open file browser", theme.dim));
  console.log(fmt(`    @file.ts  `, theme.accent) + fmt("- Attach file to context", theme.dim));
  console.log();

  console.log(fmt("  Skills:", theme.tiffany));
  const skills = getAllSkills();
  for (const skill of skills.slice(0, 5)) {
    console.log(fmt(`    /${skill.name.padEnd(9)}`, theme.accent) + fmt(`- ${skill.description}`, theme.dim));
  }
  if (skills.length > 5) {
    console.log(fmt(`    ... and ${skills.length - 5} more (use /skills)`, theme.dim));
  }
  console.log();

  console.log(fmt("  Agent Mode:", theme.tiffany));
  console.log(fmt("    Just type your question and press Enter", theme.dim));
  console.log();
}

/**
 * 构建命令列表（内置 + Skills）
 */
function buildCommandList(): Command[] {
  const skills = getAllSkills();

  const skillCommands: Command[] = skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
  }));

  return [...builtinCommands, ...skillCommands];
}

/**
 * 处理用户输入
 */
async function handleInput(value: string, files: FileItem[]): Promise<boolean> {
  const trimmed = value.trim();

  // 退出命令
  if (["exit", "quit", "q", "/exit", "/quit"].includes(trimmed.toLowerCase())) {
    return false; // 返回 false 表示退出
  }

  // 帮助
  if (trimmed === "/help") {
    printHelp();
    return true;
  }

  // 技能列表
  if (trimmed === "/skills") {
    console.log();
    console.log(fmt(`${icons.sparkle} Available Skills`, theme.accent, theme.bold));
    console.log();
    console.log(listSkills());
    return true;
  }

  // 清屏
  if (trimmed === "/clear" || trimmed.toLowerCase() === "clear") {
    console.clear();
    printBanner();
    return true;
  }

  // 重置
  if (trimmed === "/reset") {
    console.log(fmt("  Session reset", theme.tiffany));
    return true;
  }

  // 空输入
  if (!trimmed && files.length === 0) {
    return true;
  }

  console.log();

  try {
    // 构建带有文件上下文的消息
    let message = trimmed;
    if (files.length > 0) {
      // 读取每个附加文件的内容
      const fileContents: string[] = [];
      for (const file of files) {
        try {
          const fullPath = path.isAbsolute(file.path)
            ? file.path
            : path.join(config.workingDir, file.path);
          const content = fs.readFileSync(fullPath, "utf-8");
          fileContents.push(`--- File: ${file.relativePath} ---\n${content}\n--- End of ${file.relativePath} ---`);
        } catch (err) {
          fileContents.push(`--- File: ${file.relativePath} ---\n[Error reading file: ${err instanceof Error ? err.message : String(err)}]\n--- End of ${file.relativePath} ---`);
        }
      }
      const fileContext = fileContents.join("\n\n");
      message = `${fileContext}\n\nUser request: ${message}`.trim();
    }

    if (message.startsWith("/")) {
      // Skill 模式
      const skillName = message.split(" ")[0].slice(1);
      console.log(
        fmt(`  ${icons.lightning} `, theme.accent) +
        fmt(`Executing /${skillName}...`, theme.dim)
      );

      const result = await runSkill(message);

      if (result.success) {
        console.log(fmt(`  ${icons.check} `, theme.success) + fmt("Success", theme.success));
        console.log();
        logger.output(result.output);

        if (result.artifacts?.length) {
          console.log();
          console.log(fmt(`  ${icons.file} Output:`, theme.tiffany));
          for (const artifact of result.artifacts) {
            console.log(fmt(`    ${artifact}`, theme.dim));
          }
        }
      } else {
        console.log(fmt(`  ${icons.cross} `, theme.error) + fmt("Failed", theme.error));
        console.log();
        logger.error(result.output);
      }
    } else {
      // Agent 模式
      console.log(
        fmt(`  ${icons.sparkle} `, theme.tiffany) +
        fmt("Agent Mode", theme.tiffany, theme.bold)
      );
      console.log(fmt("  " + borders.horizontal.repeat(40), theme.darkGray));
      console.log();

      await agentLoop(message);
    }
  } catch (error) {
    console.log(
      fmt(`  ${icons.cross} Error: `, theme.error) +
      fmt(error instanceof Error ? error.message : String(error), theme.error)
    );
  }

  console.log();
  return true;
}

/**
 * 交互模式
 */
async function interactive(): Promise<void> {
  printBanner();

  const commands = buildCommandList();

  try {
    while (true) {
      const smartInput = new SmartInput({
        prompt: fmt(`  ${icons.chevronRight} `, theme.accent),
        commands,
      });

      const result = await smartInput.getInput();

      if (result.cancelled) {
        break;
      }

      const shouldContinue = await handleInput(result.value, result.files);
      if (!shouldContinue) {
        break;
      }
    }
  } catch (error) {
    // 处理意外错误
    showCursor();
    console.error(
      fmt(`\n  ${icons.cross} Fatal: `, theme.error) +
      fmt(error instanceof Error ? error.message : String(error), theme.error)
    );
  }

  console.log();
  console.log(fmt(`  ${icons.sparkle} Goodbye!`, theme.tiffany));
  console.log();
}

/**
 * 单次查询模式
 */
async function singleQuery(inputText: string): Promise<void> {
  await handleInput(inputText, []);
}

/**
 * 主入口
 */
async function main(): Promise<void> {
  // 验证配置
  try {
    validateConfig();
  } catch (error) {
    console.error(
      fmt(`${icons.cross} `, theme.error) +
      fmt(error instanceof Error ? error.message : String(error), theme.error)
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.length > 0) {
    // 单次查询模式
    await singleQuery(args.join(" "));
  } else {
    // 交互模式
    await interactive();
  }
}

// 确保退出时恢复光标
process.on("exit", () => {
  showCursor();
});

process.on("SIGINT", () => {
  showCursor();
  console.log();
  process.exit(0);
});

main().catch((error) => {
  showCursor();
  console.error(
    fmt(`${icons.cross} Fatal: `, theme.error) +
    fmt(error instanceof Error ? error.message : String(error), theme.error)
  );
  process.exit(1);
});
