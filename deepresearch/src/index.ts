/**
 * Terminal Coding Agent - 完全基于 Claude Agent SDK
 *
 * 功能：
 * - "/" 智能指令选择器
 * - "@" 文件浏览器引用
 * - 官方 Skills 系统支持
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { query, type SDKMessage, type SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";

// 获取 agent 安装目录（用于加载全局 skills）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_ROOT = path.resolve(__dirname, "..");  // deepresearch/
const GLOBAL_SKILLS_DIR = path.join(AGENT_ROOT, ".claude");
import {
  theme,
  icons,
  borders,
  fmt,
  SmartInput,
  Command,
  FileItem,
  showCursor,
} from "./ui/index.js";

// 版本号
const VERSION = "5.0.0";

// 颜色快捷方式
const colors = {
  reset: theme.reset,
  accent: theme.accent,
  tiffany: theme.tiffany,
  dim: theme.dim,
  white: theme.white,
  bold: theme.bold,
  success: theme.success,
  error: theme.error,
};

/**
 * 打印 Banner
 */
function printBanner(): void {
  const width = 50;
  const inner = width - 2;

  console.log();
  console.log(
    fmt(borders.topLeft, colors.tiffany) +
    fmt(borders.horizontal.repeat(inner), colors.tiffany) +
    fmt(borders.topRight, colors.tiffany)
  );

  const title = `${icons.sparkle} Terminal Agent v${VERSION}`;
  const titlePad = Math.floor((inner - title.length + 10) / 2);
  console.log(
    fmt(borders.vertical, colors.tiffany) +
    " ".repeat(titlePad) +
    fmt(icons.sparkle, colors.accent) +
    fmt(` Terminal Agent v${VERSION}`, colors.white, colors.bold) +
    " ".repeat(inner - titlePad - title.length + 10) +
    fmt(borders.vertical, colors.tiffany)
  );

  const subtitle = "Powered by Claude Agent SDK";
  const subPad = Math.floor((inner - subtitle.length) / 2);
  console.log(
    fmt(borders.vertical, colors.tiffany) +
    " ".repeat(subPad) +
    fmt(subtitle, colors.dim) +
    " ".repeat(inner - subPad - subtitle.length) +
    fmt(borders.vertical, colors.tiffany)
  );

  console.log(
    fmt(borders.bottomLeft, colors.tiffany) +
    fmt(borders.horizontal.repeat(inner), colors.tiffany) +
    fmt(borders.bottomRight, colors.tiffany)
  );

  console.log();
  console.log(fmt(`  ${icons.folder} `, colors.accent) + fmt(process.cwd(), colors.dim));
  console.log();
  console.log(fmt("  Shortcuts:", colors.white));
  console.log(fmt(`    ${icons.chevronRight} `, colors.tiffany) + fmt("/", colors.accent) + fmt(" - Command menu (Skills)", colors.dim));
  console.log(fmt(`    ${icons.chevronRight} `, colors.tiffany) + fmt("@", colors.accent) + fmt(" - File browser", colors.dim));
  console.log(fmt(`    ${icons.chevronRight} `, colors.tiffany) + fmt("exit", colors.accent) + fmt(" - Quit", colors.dim));
  console.log(fmt(`    ${icons.chevronRight} `, colors.tiffany) + fmt("clear", colors.accent) + fmt(" - New session", colors.dim));
  console.log();
}

/**
 * 处理 Assistant 消息
 */
function processAssistantMessage(msg: SDKAssistantMessage): void {
  const content = msg.message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "text") {
        console.log(block.text);
      } else if (block.type === "tool_use") {
        console.log(fmt(`  [${block.name}]`, colors.tiffany));
      }
    }
  }
}

/**
 * 读取附加文件内容
 */
function readAttachedFiles(files: FileItem[]): string {
  if (files.length === 0) return "";

  const fileContents: string[] = [];
  for (const file of files) {
    try {
      const fullPath = path.isAbsolute(file.path)
        ? file.path
        : path.join(process.cwd(), file.path);
      const content = fs.readFileSync(fullPath, "utf-8");
      fileContents.push(`--- File: ${file.relativePath} ---\n${content}\n--- End of ${file.relativePath} ---`);
    } catch (err) {
      fileContents.push(`--- File: ${file.relativePath} ---\n[Error reading file: ${err instanceof Error ? err.message : String(err)}]\n--- End of ${file.relativePath} ---`);
    }
  }
  return fileContents.join("\n\n");
}

/**
 * 使用 Claude Agent SDK 运行查询
 */
async function runQuery(prompt: string, sessionId?: string): Promise<string | undefined> {
  console.log();
  console.log(fmt(`  ${icons.sparkle} Processing...`, colors.dim));
  console.log(fmt("  " + borders.horizontal.repeat(40), colors.dim));
  console.log();

  try {
    const result = query({
      prompt,
      options: {
        // 加载项目设置（包括 .claude/skills/）
        settingSources: ["project", "local"],

        // 添加 agent 安装目录作为额外目录（加载全局 skills）
        additionalDirectories: fs.existsSync(GLOBAL_SKILLS_DIR) ? [AGENT_ROOT] : [],

        // 自动接受文件编辑
        permissionMode: "acceptEdits",

        // 使用 Claude Code 默认工具集
        tools: { type: "preset", preset: "claude_code" },

        // 恢复之前的会话
        resume: sessionId,

        // 包含流式消息
        includePartialMessages: true,

        // 系统提示词
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `
IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

Skills in .claude/skills/ are automatically available via the Skill tool.
Use /skill-name to invoke a skill directly.
`,
        },
      },
    });

    let newSessionId: string | undefined;

    // 处理流式响应
    for await (const msg of result) {
      switch (msg.type) {
        case "system":
          if (msg.subtype === "init") {
            newSessionId = msg.session_id;
            console.log(fmt(`  Session: ${msg.session_id.slice(0, 8)}...`, colors.dim));
            if (msg.skills && msg.skills.length > 0) {
              console.log(fmt(`  Skills: ${msg.skills.join(", ")}`, colors.tiffany));
            }
            console.log();
          }
          break;

        case "assistant":
          processAssistantMessage(msg);
          break;

        case "result":
          console.log();
          if (msg.subtype === "success") {
            console.log(
              fmt(`  ${icons.check} `, colors.success) +
              fmt(`Done in ${(msg.duration_ms / 1000).toFixed(1)}s`, colors.dim) +
              fmt(` | $${msg.total_cost_usd.toFixed(4)}`, colors.dim)
            );
          } else {
            console.log(fmt(`  ${icons.cross} Error: ${msg.subtype}`, colors.error));
            if ("errors" in msg && msg.errors) {
              for (const e of msg.errors as string[]) {
                console.log(fmt(`    ${e}`, colors.error));
              }
            }
          }
          break;

        case "tool_progress":
          // 只显示长时间运行的工具
          if (msg.elapsed_time_seconds > 2) {
            console.log(fmt(`  [${msg.tool_name}] ${msg.elapsed_time_seconds.toFixed(0)}s...`, colors.dim));
          }
          break;
      }
    }

    return newSessionId;
  } catch (error) {
    console.log(
      fmt(`  ${icons.cross} Error: `, colors.error) +
      fmt(error instanceof Error ? error.message : String(error), colors.error)
    );
    return sessionId;
  }
}

/**
 * 从目录加载 skills
 */
function loadSkillsFromDir(skillsDir: string): Command[] {
  const skillCommands: Command[] = [];

  if (fs.existsSync(skillsDir)) {
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
          if (fs.existsSync(skillMdPath)) {
            const content = fs.readFileSync(skillMdPath, "utf-8");
            const descMatch = content.match(/description:\s*(.+)/i);
            const description = descMatch ? descMatch[1].trim() : "Custom skill";
            skillCommands.push({
              name: entry.name,
              description: description.slice(0, 40) + (description.length > 40 ? "..." : ""),
            });
          }
        }
      }
    } catch {
      // 忽略读取错误
    }
  }

  return skillCommands;
}

/**
 * 构建命令列表（内置 + 全局 Skills + 项目 Skills）
 */
function buildCommandList(): Command[] {
  const builtinCommands: Command[] = [
    { name: "help", description: "Show help" },
    { name: "clear", description: "New session" },
    { name: "exit", description: "Exit program" },
  ];

  // 加载全局 skills（从 agent 安装目录）
  const globalSkillsDir = path.join(AGENT_ROOT, ".claude", "skills");
  const globalSkills = loadSkillsFromDir(globalSkillsDir);

  // 加载项目 skills（从当前工作目录）
  const projectSkillsDir = path.join(process.cwd(), ".claude", "skills");
  const projectSkills = loadSkillsFromDir(projectSkillsDir);

  // 合并，项目 skills 优先（去重）
  const allSkills = [...globalSkills];
  for (const skill of projectSkills) {
    if (!allSkills.find(s => s.name === skill.name)) {
      allSkills.push(skill);
    }
  }

  return [...builtinCommands, ...allSkills];
}

/**
 * 打印帮助
 */
function printHelp(): void {
  console.log();
  console.log(fmt(`${icons.sparkle} Help`, colors.accent, colors.bold));
  console.log();

  console.log(fmt("  Commands:", colors.tiffany));
  console.log(fmt(`    /help     `, colors.accent) + fmt("- Show this help", colors.dim));
  console.log(fmt(`    /clear    `, colors.accent) + fmt("- Start new session", colors.dim));
  console.log(fmt(`    /exit     `, colors.accent) + fmt("- Exit program", colors.dim));
  console.log();

  console.log(fmt("  File Reference:", colors.tiffany));
  console.log(fmt(`    @         `, colors.accent) + fmt("- Open file browser", colors.dim));
  console.log(fmt(`    @file.ts  `, colors.accent) + fmt("- Attach file to context", colors.dim));
  console.log();

  console.log(fmt("  Skills:", colors.tiffany));
  console.log(fmt(`    Skills are loaded from .claude/skills/`, colors.dim));
  console.log(fmt(`    Use /skill-name or just ask naturally`, colors.dim));
  console.log();

  console.log(fmt("  Agent Mode:", colors.tiffany));
  console.log(fmt(`    Just type your question and press Enter`, colors.dim));
  console.log();
}

/**
 * 处理用户输入
 */
async function handleInput(
  value: string,
  files: FileItem[],
  sessionId?: string
): Promise<{ continue: boolean; sessionId?: string }> {
  const trimmed = value.trim();

  // 退出命令
  if (["exit", "quit", "q", "/exit", "/quit"].includes(trimmed.toLowerCase())) {
    return { continue: false };
  }

  // 帮助
  if (trimmed === "/help") {
    printHelp();
    return { continue: true, sessionId };
  }

  // 清除会话
  if (trimmed === "/clear" || trimmed.toLowerCase() === "clear") {
    console.clear();
    printBanner();
    console.log(fmt("  Session cleared", colors.tiffany));
    console.log();
    return { continue: true, sessionId: undefined };
  }

  // 空输入
  if (!trimmed && files.length === 0) {
    return { continue: true, sessionId };
  }

  // 构建带文件上下文的消息
  let message = trimmed;
  if (files.length > 0) {
    const fileContext = readAttachedFiles(files);
    const fileList = files.map(f => f.relativePath).join(", ");
    // 明确告诉 Claude 只关注附加的文件
    message = `The user has attached the following file(s) for you to analyze: ${fileList}

${fileContext}

IMPORTANT: Focus ONLY on the attached file(s) above. Do NOT explore or analyze other files in the project unless the user explicitly asks.

User request: ${message || "Analyze the attached file(s)"}`.trim();
  }

  // 如果是 skill 命令（/skill-name），转换为自然语言请求
  if (message.startsWith("/") && !message.startsWith("/exit") && !message.startsWith("/help") && !message.startsWith("/clear")) {
    const skillName = message.split(" ")[0].slice(1);
    const args = message.slice(skillName.length + 2).trim();
    message = `Use the "${skillName}" skill${args ? ` with: ${args}` : ""}`;
  }

  // 运行查询
  const newSessionId = await runQuery(message, sessionId);
  console.log();

  return { continue: true, sessionId: newSessionId };
}

/**
 * 交互模式
 */
async function interactive(): Promise<void> {
  printBanner();

  let sessionId: string | undefined;

  try {
    while (true) {
      const commands = buildCommandList();
      const smartInput = new SmartInput({
        prompt: fmt(`  ${icons.chevronRight} `, colors.accent),
        commands,
      });

      const result = await smartInput.getInput();

      if (result.cancelled) {
        break;
      }

      const outcome = await handleInput(result.value, result.files, sessionId);
      sessionId = outcome.sessionId;

      if (!outcome.continue) {
        break;
      }
    }
  } catch (error) {
    showCursor();
    console.error(
      fmt(`\n  ${icons.cross} Fatal: `, colors.error) +
      fmt(error instanceof Error ? error.message : String(error), colors.error)
    );
  }

  console.log();
  console.log(fmt(`  ${icons.sparkle} Goodbye!`, colors.tiffany));
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
  const args = process.argv.slice(2);

  if (args.length > 0) {
    await singleQuery(args.join(" "));
  } else {
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
