/**
 * Terminal Coding Agent - Multi-Agent Architecture
 *
 * 功能：
 * - "/" 智能指令选择器
 * - "@" 文件浏览器引用
 * - 官方 Skills 系统支持
 * - Multi-Agent: Coordinator, Reader, Coder, Reviewer
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// 加载 .env 配置（必须在导入 SDK 之前）
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_ROOT = path.resolve(__dirname, "..");  // deepresearch/
dotenv.config({ path: path.join(AGENT_ROOT, ".env") });

import { query, type SDKMessage, type SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";
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
  pickCommand,
} from "./ui/index.js";

import { tracker, messageHandler, Transcript } from "./utils/index.js";

// 版本号
const VERSION = "6.0.0";

// 子智能体类型
type SubagentType = "coordinator" | "reader" | "coder" | "reviewer";

// 子智能体配置
interface SubagentConfig {
  name: string;
  description: string;
  promptFile: string;
}

const SUBAGENTS: Record<SubagentType, SubagentConfig> = {
  coordinator: {
    name: "Coordinator",
    description: "理解意图，分配任务",
    promptFile: "coordinator.md",
  },
  reader: {
    name: "Reader",
    description: "代码阅读和理解",
    promptFile: "reader.md",
  },
  coder: {
    name: "Coder",
    description: "代码编写和修改",
    promptFile: "coder.md",
  },
  reviewer: {
    name: "Reviewer",
    description: "代码审查和质量检查",
    promptFile: "reviewer.md",
  },
};

// 全局会话记录
let currentTranscript: Transcript | null = null;

// 子智能体执行深度限制
const MAX_SUBAGENT_DEPTH = 3;

// 子智能体执行结果
interface SubagentResult {
  agent: string;
  task: string;
  output: string;
  success: boolean;
  duration_ms: number;
}

/**
 * 加载子智能体提示词
 */
function loadSubagentPrompt(agentType: SubagentType): string {
  const config = SUBAGENTS[agentType];
  const promptPath = path.join(AGENT_ROOT, "src", "prompts", config.promptFile);

  try {
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
  } catch {
    // 忽略读取错误
  }

  return `You are the ${config.name} agent. ${config.description}.`;
}

/**
 * 运行子智能体（独立上下文）
 */
async function runSubagent(
  agentType: SubagentType,
  task: string,
  context: string,
  depth: number = 0
): Promise<SubagentResult> {
  const startTime = Date.now();
  const config = SUBAGENTS[agentType];
  const userCwd = process.cwd();

  // Agent 类型对应的图标
  const agentIcons: Record<SubagentType, string> = {
    coordinator: "🎯",
    reader: "📖",
    coder: "💻",
    reviewer: "🔍",
  };
  const agentIcon = agentIcons[agentType] || "🤖";

  console.log();
  console.log(fmt(`  ┌─ ${agentIcon} ${config.name} ─────────────────────`, colors.tiffany));
  console.log(fmt(`  │ ${task.slice(0, 60)}${task.length > 60 ? '...' : ''}`, colors.dim));

  // 深度检查
  if (depth >= MAX_SUBAGENT_DEPTH) {
    console.log(fmt(`  │ [!] Max depth reached, skipping`, colors.error));
    console.log(fmt(`  └────────────────────────────────────────`, colors.tiffany));
    return {
      agent: agentType,
      task,
      output: "Max subagent depth reached",
      success: false,
      duration_ms: Date.now() - startTime,
    };
  }

  // 加载子智能体专属提示词
  const agentPrompt = loadSubagentPrompt(agentType);

  // 构建子智能体的完整提示
  const fullPrompt = `${context ? `Context from Coordinator:\n${context}\n\n` : ''}Task: ${task}`;

  let output = "";
  let success = true;

  try {
    const result = query({
      prompt: fullPrompt,
      options: {
        cwd: AGENT_ROOT,
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        settingSources: ["project"],
        additionalDirectories: [userCwd],
        permissionMode: currentPermissionMode,
        tools: { type: "preset", preset: "claude_code" },
        // 不传 resume，独立上下文
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `${agentPrompt}

Working Directory: ${userCwd}
You are a specialized ${config.name} agent. Focus on your specific task.
Respond in the same language as the task description.
Do NOT dispatch to other agents - complete your task directly.`,
        },
      },
    });

    // 处理子智能体响应
    for await (const msg of result) {
      if (msg.type === "assistant") {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              output += block.text + "\n";
              // 缩进显示子智能体输出
              const lines = block.text.split('\n');
              for (const line of lines) {
                console.log(fmt(`  │ `, colors.tiffany) + line);
              }
            } else if (block.type === "tool_use") {
              const toolIcon = getToolIcon(block.name);
              console.log(fmt(`  │ ${toolIcon} `, colors.tiffany) + fmt(block.name, colors.accent));
            }
          }
        }
      } else if (msg.type === "result") {
        if (msg.subtype !== "success") {
          success = false;
        }
      }
    }
  } catch (error) {
    success = false;
    output = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log(fmt(`  │ [!] ${output}`, colors.error));
  }

  const duration = Date.now() - startTime;
  console.log(fmt(`  └─ Done in ${(duration / 1000).toFixed(1)}s ───────────────────`, colors.tiffany));

  return {
    agent: agentType,
    task,
    output: output.trim(),
    success,
    duration_ms: duration,
  };
}

/**
 * 构建多智能体系统提示词
 */
function buildMultiAgentSystemPrompt(userCwd: string): string {
  const agentDescriptions = Object.entries(SUBAGENTS)
    .map(([type, config]) => `- **${config.name}** (${type}): ${config.description}`)
    .join("\n");

  return `
IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${userCwd}
- When reading/writing files, use paths relative to ${userCwd} or absolute paths

## Multi-Agent System

You are the **Coordinator** of a multi-agent coding system. You can dispatch tasks to specialized agents:

${agentDescriptions}

### How to Dispatch

When you need a specialized agent, output EXACTLY this format on its own line:

\`\`\`
[DISPATCH:reader] Analyze the structure of src/index.ts and identify key functions
\`\`\`

or

\`\`\`
[DISPATCH:coder] Add error handling to the processData function in utils.ts
\`\`\`

**Rules:**
1. Agent name must be lowercase: reader, coder, reviewer (NOT Reader, Coder, Reviewer)
2. Put the dispatch command on its own line
3. The task description should be clear and specific
4. Wait for the agent's response before continuing
5. You can dispatch multiple agents sequentially for complex tasks

### Workflow Example

For "Add a login feature":
1. [DISPATCH:reader] Analyze the current auth structure
2. Review reader's findings
3. [DISPATCH:coder] Implement the login function based on the analysis
4. [DISPATCH:reviewer] Check the implementation for security issues
5. Summarize results to user

Skills in .claude/skills/ are also available via the Skill tool.
`;
}

// 权限模式类型
type PermissionMode = "acceptEdits" | "bypassPermissions";

// 当前权限模式（全局状态）
let currentPermissionMode: PermissionMode = "acceptEdits";

/**
 * 检测文本中的派发指令
 */
function detectDispatch(text: string): { agent: SubagentType; task: string } | null {
  // 匹配 [DISPATCH:agentname] task description
  const pattern = /\[DISPATCH:(\w+)\]\s*(.+)/i;
  const match = text.match(pattern);

  if (match) {
    const agentName = match[1].toLowerCase() as SubagentType;
    const task = match[2].trim();

    // 验证是否是有效的子智能体
    if (agentName in SUBAGENTS && agentName !== "coordinator") {
      return { agent: agentName, task };
    }
  }

  return null;
}

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
 * 根据工具名称返回对应的图标
 */
function getToolIcon(toolName: string): string {
  const toolIcons: Record<string, string> = {
    Read: "📖",
    Write: "✏️",
    Edit: "✏️",
    Bash: "⚡",
    Glob: "🔍",
    Grep: "🔍",
    Task: "🤖",
    WebFetch: "🌐",
    WebSearch: "🌐",
    Skill: "✨",
    TodoWrite: "📋",
    LSP: "🔗",
    NotebookEdit: "📓",
  };
  return toolIcons[toolName] || "⚙️";
}

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
        // 检测子智能体派发
        const events = messageHandler.processMessage(msg);
        for (const event of events) {
          if (event.type === "subagent_dispatch") {
            const dispatch = event.content as { targetAgent: string; task: string };
            console.log(fmt(`  ⤷ [${dispatch.targetAgent}] `, colors.tiffany) + fmt(dispatch.task, colors.dim));
          }
        }
        console.log(block.text);

        // 记录到会话日志
        if (currentTranscript) {
          currentTranscript.addAssistant(block.text);
        }
      } else if (block.type === "tool_use") {
        console.log(fmt(`  [${block.name}]`, colors.tiffany));

        // 记录工具调用
        if (currentTranscript) {
          currentTranscript.addTool(block.name, block.input);
        }
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
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];

  for (const file of files) {
    try {
      const fullPath = path.isAbsolute(file.path)
        ? file.path
        : path.join(process.cwd(), file.path);

      const ext = path.extname(file.path).toLowerCase();

      if (ext === '.pdf') {
        // PDF 文件：提示使用 /pdf-analyze skill
        fileContents.push(`--- File: ${file.relativePath} ---
[PDF file detected at: ${fullPath}]

NOTE: For PDF analysis, please use the /pdf-analyze skill or extract text using Python:
\`\`\`python
import pdfplumber
with pdfplumber.open("${fullPath.replace(/\\/g, '\\\\')}") as pdf:
    for page in pdf.pages:
        print(page.extract_text())
\`\`\`

Alternatively, run: pdftotext "${fullPath}" -
--- End of ${file.relativePath} ---`);
      } else if (binaryExtensions.includes(ext)) {
        // 二进制文件只传路径，让 Claude 用 Read 工具处理
        fileContents.push(`--- File: ${file.relativePath} ---\n[Binary file at: ${fullPath}]\nUse the Read tool to access this file.\n--- End of ${file.relativePath} ---`);
      } else {
        const content = fs.readFileSync(fullPath, "utf-8");
        fileContents.push(`--- File: ${file.relativePath} ---\n${content}\n--- End of ${file.relativePath} ---`);
      }
    } catch (err) {
      fileContents.push(`--- File: ${file.relativePath} ---\n[Error reading file: ${err instanceof Error ? err.message : String(err)}]\n--- End of ${file.relativePath} ---`);
    }
  }
  return fileContents.join("\n\n");
}

/**
 * 使用 Claude Agent SDK 运行查询（支持 Multi-Agent 调度）
 */
async function runQuery(prompt: string, sessionId?: string, depth: number = 0): Promise<string | undefined> {
  console.log();
  console.log(fmt(`  ${icons.sparkle} Processing...`, colors.dim));
  console.log(fmt("  " + borders.horizontal.repeat(40), colors.dim));
  console.log();

  try {
    const userCwd = process.cwd();
    let newSessionId: string | undefined;
    let collectedText = "";  // 收集 Coordinator 的输出
    const pendingDispatches: Array<{ agent: SubagentType; task: string }> = [];

    const result = query({
      prompt,
      options: {
        cwd: AGENT_ROOT,
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        settingSources: ["project"],
        additionalDirectories: [userCwd],
        mcpServers: {
          playwright: {
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"],
          },
        },
        permissionMode: currentPermissionMode,
        tools: { type: "preset", preset: "claude_code" },
        resume: sessionId,
        includePartialMessages: true,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: buildMultiAgentSystemPrompt(userCwd),
        },
      },
    });

    // 处理流式响应
    for await (const msg of result) {
      switch (msg.type) {
        case "system":
          if (msg.subtype === "init") {
            newSessionId = msg.session_id;
            // 显示当前 Agent 类型和会话 ID
            const agentLabel = depth === 0 ? "Coordinator" : "Agent";
            console.log(fmt(`  🎯 ${agentLabel}`, colors.accent) +
              fmt(` | Session: ${msg.session_id.slice(0, 8)}`, colors.dim));
            console.log();
          }
          break;

        case "assistant":
          const content = msg.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text") {
                collectedText += block.text;

                // 检测派发指令
                const dispatch = detectDispatch(block.text);
                if (dispatch) {
                  pendingDispatches.push(dispatch);
                  console.log(fmt(`  ⤷ [DISPATCH:${dispatch.agent}] `, colors.accent) + fmt(dispatch.task, colors.dim));
                } else {
                  console.log(block.text);
                }

                if (currentTranscript) {
                  currentTranscript.addAssistant(block.text);
                }
              } else if (block.type === "tool_use") {
                // 更详细的工具状态显示
                const toolName = block.name;
                const toolIcon = getToolIcon(toolName);
                console.log(fmt(`  ${toolIcon} `, colors.tiffany) + fmt(toolName, colors.accent));
                if (currentTranscript) {
                  currentTranscript.addTool(block.name, block.input);
                }
              }
            }
          }
          break;

        case "result":
          console.log();
          if (msg.subtype === "success") {
            console.log(
              fmt(`  ${icons.check} `, colors.success) +
              fmt(`Coordinator done in ${(msg.duration_ms / 1000).toFixed(1)}s`, colors.dim) +
              fmt(` | $${msg.total_cost_usd.toFixed(4)}`, colors.dim)
            );
          } else {
            console.log(fmt(`  ${icons.cross} Error: ${msg.subtype}`, colors.error));
          }
          break;

        case "tool_progress":
          if (msg.elapsed_time_seconds > 2) {
            console.log(fmt(`  [${msg.tool_name}] ${msg.elapsed_time_seconds.toFixed(0)}s...`, colors.dim));
          }
          break;
      }
    }

    // 执行收集到的派发任务
    if (pendingDispatches.length > 0 && depth < MAX_SUBAGENT_DEPTH) {
      console.log();
      console.log(fmt(`  ═══ Executing ${pendingDispatches.length} subagent(s) ═══`, colors.accent));

      const subagentResults: SubagentResult[] = [];

      for (const dispatch of pendingDispatches) {
        const subResult = await runSubagent(
          dispatch.agent,
          dispatch.task,
          collectedText,  // 传递 Coordinator 的上下文
          depth + 1
        );
        subagentResults.push(subResult);
      }

      // 将子智能体结果反馈给 Coordinator
      if (subagentResults.length > 0 && newSessionId) {
        const feedbackPrompt = buildSubagentFeedback(subagentResults);
        console.log();
        console.log(fmt(`  ═══ Coordinator processing results ═══`, colors.accent));

        // 递归调用，让 Coordinator 处理子智能体结果
        return await runQuery(feedbackPrompt, newSessionId, depth + 1);
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
 * 构建子智能体结果反馈
 */
function buildSubagentFeedback(results: SubagentResult[]): string {
  const feedback = results.map(r => {
    const status = r.success ? "✓ Success" : "✗ Failed";
    return `## ${SUBAGENTS[r.agent as SubagentType].name} Agent Result (${status})

**Task:** ${r.task}

**Output:**
${r.output}

**Duration:** ${(r.duration_ms / 1000).toFixed(1)}s`;
  }).join("\n\n---\n\n");

  return `The following subagent(s) have completed their tasks. Please review their results and continue:

${feedback}

Based on these results, please continue with the original task or provide a summary to the user.`;
}

/**
 * 从目录加载 skills
 */
function loadSkillsFromDir(skillsDir: string, excludeInternal: boolean = false): Command[] {
  const skillCommands: Command[] = [];

  // 内部 Skills，仅供 Agent 使用，用户无法通过 / 命令触发
  const internalSkills = ["web-scrape", "doc-generate", "deep-research"];

  if (fs.existsSync(skillsDir)) {
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 过滤内部 skills
          if (excludeInternal && internalSkills.includes(entry.name)) {
            continue;
          }

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
 * 注意：内部 Skills (web-scrape, doc-generate, deep-research) 不显示在菜单中
 */
function buildCommandList(): Command[] {
  const builtinCommands: Command[] = [
    { name: "help", description: "Show help" },
    { name: "mode", description: "Switch permission mode" },
    { name: "clear", description: "New session" },
    { name: "exit", description: "Exit program" },
  ];

  // 加载全局 skills（从 agent 安装目录），排除内部 skills
  const globalSkillsDir = path.join(AGENT_ROOT, ".claude", "skills");
  const globalSkills = loadSkillsFromDir(globalSkillsDir, true);

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
  console.log(fmt(`    /mode     `, colors.accent) + fmt("- Switch permission mode", colors.dim));
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

  // 切换权限模式
  if (trimmed === "/mode" || trimmed.startsWith("/mode ")) {
    const arg = trimmed.slice(6).trim();

    if (arg === "1" || arg.toLowerCase() === "safe") {
      currentPermissionMode = "acceptEdits";
      console.log();
      console.log(fmt(`  ${icons.check} Switched to Safe mode`, colors.success));
      console.log(fmt(`    Auto-accept file edits, confirm Bash commands`, colors.dim));
      console.log();
    } else if (arg === "2" || arg.toLowerCase() === "unsafe") {
      currentPermissionMode = "bypassPermissions";
      console.log();
      console.log(fmt(`  ${icons.check} Switched to Unsafe mode`, colors.success));
      console.log(fmt(`    Auto-accept everything (no confirmations)`, colors.dim));
      console.log();
    } else {
      // 没有参数，显示交互式选择菜单
      const modeCommands: Command[] = [
        {
          name: "safe",
          description: currentPermissionMode === "acceptEdits"
            ? "Auto-accept edits, confirm Bash (current)"
            : "Auto-accept edits, confirm Bash",
        },
        {
          name: "unsafe",
          description: currentPermissionMode === "bypassPermissions"
            ? "Auto-accept everything (current)"
            : "Auto-accept everything",
        },
      ];

      console.log();
      const result = await pickCommand(modeCommands, "");

      if (!result.cancelled && result.command) {
        if (result.command.name === "safe") {
          currentPermissionMode = "acceptEdits";
          console.log(fmt(`  ${icons.check} Switched to Safe mode`, colors.success));
        } else if (result.command.name === "unsafe") {
          currentPermissionMode = "bypassPermissions";
          console.log(fmt(`  ${icons.check} Switched to Unsafe mode`, colors.success));
        }
        console.log();
      }
    }
    return { continue: true, sessionId };
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
  // 注意：单独的 "/" 应该由 SmartInput 处理，不应该到达这里
  if (message.startsWith("/") && !message.startsWith("/exit") && !message.startsWith("/help") && !message.startsWith("/clear") && !message.startsWith("/mode")) {
    const skillName = message.split(" ")[0].slice(1);
    // 确保 skillName 不为空
    if (skillName) {
      const args = message.slice(skillName.length + 2).trim();
      message = `Use the "${skillName}" skill${args ? ` with: ${args}` : ""}`;
    } else {
      // 单独的 "/" 忽略
      return { continue: true, sessionId };
    }
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

  // 初始化会话记录
  currentTranscript = new Transcript(undefined, path.join(AGENT_ROOT, "data", "logs"));
  console.log(fmt(`  Transcript: ${currentTranscript.getSessionId()}`, colors.dim));
  console.log();

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

      // 记录用户输入
      if (currentTranscript && result.value) {
        currentTranscript.addUser(result.value);
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

  // 保存会话记录
  if (currentTranscript) {
    const textPath = currentTranscript.saveAsText();
    const jsonPath = currentTranscript.saveAsJson();
    console.log(fmt(`  Saved: ${textPath}`, colors.dim));
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
