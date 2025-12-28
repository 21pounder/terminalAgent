/**
 * Terminal Coding Agent - Multi-Agent Architecture v2
 *
 * 功能：
 * - "/" 智能指令选择器
 * - "@" 文件浏览器引用
 * - 官方 Skills 系统支持
 * - Multi-Agent: Coordinator, Reader, Coder, Reviewer
 * - 真正的多Agent并行执行
 * - 共享上下文和消息总线
 * - ReAct 推理模式
 * - 循环检测和上下文压缩
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

// SDK types imported as needed

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
  logoMinimal,
  welcomeBanner,
} from "./ui/index.js";

import { Transcript } from "./utils/index.js";

// 新架构导入
import { VERSION, MAX_SUBAGENT_DEPTH } from "./config/constants.js";
import { AGENT_CONFIGS, AGENT_ICONS, TOOL_ICONS } from "./config/agents.js";
import type { SubagentType, AgentResult, PermissionMode } from "./agents/types.js";
import { getAgentRegistry, type AgentCallbacks } from "./agents/index.js";
import { getRouter } from "./core/router.js";

// 全局会话记录
let currentTranscript: Transcript | null = null;

// 权限模式（全局状态）- 默认 unsafe 模式
let currentPermissionMode: PermissionMode = "bypassPermissions";

// 初始化 Agent Registry
const agentRegistry = getAgentRegistry();

/**
 * 初始化 Agent 系统
 */
function initializeAgents(): void {
  const userCwd = process.cwd();
  agentRegistry.setEnvironment(AGENT_ROOT, userCwd, currentPermissionMode);
}

/**
 * 检测任务类型，决定使用哪个 Agent
 * 使用新的 Router 系统
 */
function detectTaskType(prompt: string): SubagentType {
  const router = getRouter();
  return router.route(prompt);
}

// 子智能体执行结果（使用新类型）
// 保留接口以兼容现有代码
interface SubagentResultLegacy {
  agent: string;
  task: string;
  output: string;
  success: boolean;
  duration_ms: number;
}

/**
 * 运行子智能体（独立上下文）
 * 使用新的 Agent 类
 */
async function runSubagent(
  agentType: SubagentType,
  task: string,
  context: string,
  depth: number = 0
): Promise<SubagentResultLegacy> {
  const startTime = Date.now();
  const config = AGENT_CONFIGS[agentType];

  // Agent 类型对应的图标
  const agentIcon = AGENT_ICONS[agentType] || "*";

  console.log();
  console.log(fmt(`  + ${config.name}`, colors.tiffany));
  console.log(fmt(`    ${task.slice(0, 70)}${task.length > 70 ? '...' : ''}`, colors.dim));

  // 深度检查
  if (depth >= MAX_SUBAGENT_DEPTH) {
    console.log(fmt(`    x Max depth reached, skipping`, colors.error));
    return {
      agent: agentType,
      task,
      output: "Max subagent depth reached",
      success: false,
      duration_ms: Date.now() - startTime,
    };
  }

  // 使用新的 Agent 类执行
  const agent = agentRegistry.get(agentType);

  // 创建回调处理 UI 显示
  const callbacks: AgentCallbacks = {
    onInit: (sessionId) => {
      // 子 Agent 不显示 session ID
    },
    onText: (text) => {
      // 缩进显示子智能体输出
      const lines = text.split('\n');
      for (const line of lines) {
        console.log(fmt(`    `, colors.gray) + line);
      }
    },
    onToolUse: (toolName) => {
      const toolIcon = getToolIcon(toolName);
      console.log(fmt(`    ${toolIcon} `, colors.tiffany) + fmt(toolName, colors.accent));
    },
    onResult: (success, duration, cost) => {
      // 结果在最后统一处理
    },
    onProgress: (toolName, elapsed) => {
      if (elapsed > 2) {
        console.log(fmt(`    : ${toolName}...${elapsed.toFixed(0)}s`, colors.dim));
      }
    },
  };

  let result: AgentResult;
  try {
    result = await agent.execute(task, context, callbacks);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(fmt(`    x Error: ${errorMsg}`, colors.error));
    result = {
      agent: agentType,
      task,
      output: `Error: ${errorMsg}`,
      success: false,
      duration_ms: Date.now() - startTime,
    };
  }

  const duration = Date.now() - startTime;
  console.log(fmt(`    v Done in ${(duration / 1000).toFixed(1)}s`, colors.success));

  return {
    agent: result.agent,
    task: result.task,
    output: result.output,
    success: result.success,
    duration_ms: result.duration_ms,
  };
}

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
    if (agentName in AGENT_CONFIGS && agentName !== "coordinator") {
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
  lightGray: theme.lightGray,
  gray: theme.gray,
};

/**
 * 根据工具名称返回对应的图标
 * 使用新的 TOOL_ICONS 配置
 */
function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] || "⚙️";
}

/**
 * 打印 Banner - 新设计
 */
function printBanner(): void {
  console.log();

  // 欢迎横幅
  console.log(welcomeBanner(VERSION));
  console.log();

  // ASCII Art Logo - 使用蒂芙尼蓝
  const logoLines = logoMinimal.split("\n");
  for (const line of logoLines) {
    console.log(fmt(line, colors.tiffany));
  }
  console.log();

  // 描述信息
  console.log(fmt("Your AI assistant for coding tasks.", colors.lightGray));
  console.log(fmt("Ask me any questions. Type 'exit' or 'quit' to end.", colors.dim));
  console.log();

  // 当前目录
  console.log(fmt(icons.prompt, colors.accent) + " " + fmt(process.cwd(), colors.dim));
  console.log();
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
 * 使用 Agent 类运行指定类型的 Agent
 * 使用 AgentRegistry 管理 Agent 实例
 * 支持 dispatch 到其他 agents
 */
async function runAgent(
  agentType: SubagentType,
  prompt: string,
  sessionId?: string,
  depth: number = 0
): Promise<string | undefined> {
  console.log();
  console.log(fmt(`: Processing...`, colors.dim));
  console.log();

  const config = AGENT_CONFIGS[agentType];
  const agentIcon = AGENT_ICONS[agentType];
  let newSessionId: string | undefined;
  let collectedText = "";  // Collect text to detect dispatches

  // 获取 Agent 实例
  const agent = agentRegistry.get(agentType);

  // 创建回调处理 UI 显示
  const callbacks: AgentCallbacks = {
    onInit: (sid) => {
      newSessionId = sid;
      console.log(fmt(`> Task: `, colors.accent) + fmt(config.name, colors.white));
      console.log(fmt(`  Session: ${sid.slice(0, 8)}`, colors.dim));
      console.log();
    },
    onText: (text) => {
      collectedText += text + "\n";
      // 检测派发指令（用于 UI 显示）
      const dispatch = detectDispatch(text);
      if (dispatch) {
        console.log(fmt(`  > [DISPATCH:${dispatch.agent}] `, colors.accent) + fmt(dispatch.task.slice(0, 60) + "...", colors.dim));
      } else {
        console.log(text);
      }
      if (currentTranscript) {
        currentTranscript.addAssistant(text);
      }
    },
    onToolUse: (toolName) => {
      const toolIcon = getToolIcon(toolName);
      console.log(fmt(`  ${toolIcon} `, colors.tiffany) + fmt(toolName, colors.accent));
      if (currentTranscript) {
        currentTranscript.addTool(toolName, {});
      }
    },
    onResult: (success, duration, cost) => {
      console.log();
      if (success) {
        console.log(
          fmt(`v Completed `, colors.success) +
          fmt(`| ${config.name} | ${(duration / 1000).toFixed(1)}s`, colors.dim) +
          (cost ? fmt(` | $${cost.toFixed(4)}`, colors.dim) : "")
        );
      } else {
        console.log(fmt(`x Failed`, colors.error));
      }
    },
    onProgress: (toolName, elapsed) => {
      if (elapsed > 2) {
        console.log(fmt(`  : ${toolName}...${elapsed.toFixed(0)}s`, colors.dim));
      }
    },
  };

  try {
    await agent.execute(prompt, undefined, callbacks);

    // Check for dispatch instructions in collected text
    const dispatches = extractAllDispatches(collectedText);

    if (dispatches.length > 0 && depth < MAX_SUBAGENT_DEPTH) {
      console.log();
      console.log(fmt(`> Executing ${dispatches.length} dispatched agent(s)`, colors.accent));
      console.log();

      for (const dispatch of dispatches) {
        const subResult = await runSubagent(
          dispatch.agent,
          dispatch.task,
          collectedText,  // Pass context
          depth + 1
        );

        // If the subagent also dispatched, continue the chain
        if (subResult.output) {
          const subDispatches = extractAllDispatches(subResult.output);
          if (subDispatches.length > 0 && depth + 1 < MAX_SUBAGENT_DEPTH) {
            for (const subDispatch of subDispatches) {
              await runSubagent(
                subDispatch.agent,
                subDispatch.task,
                subResult.output,
                depth + 2
              );
            }
          }
        }
      }
    }

    return newSessionId;
  } catch (error) {
    console.log(
      fmt(`x Error: `, colors.error) +
      fmt(error instanceof Error ? error.message : String(error), colors.error)
    );
    return sessionId;
  }
}

/**
 * Extract all dispatch instructions from text
 */
function extractAllDispatches(text: string): Array<{ agent: SubagentType; task: string }> {
  const dispatches: Array<{ agent: SubagentType; task: string }> = [];
  const pattern = /\[DISPATCH:(\w+)\]\s*(.+?)(?=\[DISPATCH:|$)/gis;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const agentName = match[1].toLowerCase() as SubagentType;
    const task = match[2].trim();

    if (agentName in AGENT_CONFIGS && agentName !== "coordinator") {
      dispatches.push({ agent: agentName, task });
    }
  }

  return dispatches;
}

/**
 * 智能路由：根据任务类型选择合适的 Agent
 */
async function runQuery(prompt: string, sessionId?: string, depth: number = 0): Promise<string | undefined> {
  // 检测任务类型
  const agentType = detectTaskType(prompt);

  // 调试：显示路由决策
  console.log(fmt(`[Router] -> ${agentType}`, colors.dim));

  // 如果是 Coordinator，保持原有的多 Agent 协调逻辑
  if (agentType === "coordinator") {
    return runCoordinator(prompt, sessionId, depth);
  }

  // 否则直接使用专门的 Agent
  return runAgent(agentType, prompt, sessionId);
}

/**
 * 运行 Coordinator（支持多 Agent 协调）
 * 使用 CoordinatorAgent 类
 */
async function runCoordinator(prompt: string, sessionId?: string, depth: number = 0): Promise<string | undefined> {
  console.log();
  console.log(fmt(`: Processing...`, colors.dim));
  console.log();

  let newSessionId: string | undefined;
  let collectedText = "";

  // 获取 CoordinatorAgent 实例
  const coordinator = agentRegistry.getCoordinator();

  // 创建回调处理 UI 显示
  const callbacks: AgentCallbacks = {
    onInit: (sid) => {
      newSessionId = sid;
      const agentLabel = depth === 0 ? "Coordinator" : "Agent";
      console.log(fmt(`> Task: `, colors.accent) + fmt(agentLabel, colors.white));
      console.log(fmt(`  Session: ${sid.slice(0, 8)}`, colors.dim));
      console.log();
    },
    onText: (text) => {
      collectedText += text + "\n";
      // 检测派发指令（用于 UI 显示）
      const dispatch = detectDispatch(text);
      if (dispatch) {
        console.log(fmt(`  > [DISPATCH:${dispatch.agent}] `, colors.accent) + fmt(dispatch.task, colors.dim));
      } else {
        console.log(text);
      }
      if (currentTranscript) {
        currentTranscript.addAssistant(text);
      }
    },
    onToolUse: (toolName, input) => {
      const toolIcon = getToolIcon(toolName);
      console.log(fmt(`  ${toolIcon} `, colors.tiffany) + fmt(toolName, colors.accent));
      if (currentTranscript) {
        currentTranscript.addTool(toolName, input || {});
      }
    },
    onResult: (success, duration, cost) => {
      console.log();
      if (success) {
        console.log(
          fmt(`v Completed `, colors.success) +
          fmt(`| Coordinator | ${(duration / 1000).toFixed(1)}s`, colors.dim) +
          (cost ? fmt(` | $${cost.toFixed(4)}`, colors.dim) : "")
        );
      } else {
        console.log(fmt(`x Coordinator failed`, colors.error));
      }
    },
    onProgress: (toolName, elapsed) => {
      if (elapsed > 2) {
        console.log(fmt(`  : ${toolName}...${elapsed.toFixed(0)}s`, colors.dim));
      }
    },
  };

  try {
    // 执行 Coordinator
    await coordinator.execute(prompt, undefined, callbacks);

    // 获取 Coordinator 检测到的派发指令
    const pendingDispatches = coordinator.getPendingDispatches();

    // 执行收集到的派发任务
    if (pendingDispatches.length > 0 && depth < MAX_SUBAGENT_DEPTH) {
      console.log();
      console.log(fmt(`> Executing ${pendingDispatches.length} subagent(s)`, colors.accent));
      console.log();

      const subagentResults: SubagentResultLegacy[] = [];

      for (const dispatch of pendingDispatches) {
        const subResult = await runSubagent(
          dispatch.agent,
          dispatch.task,
          collectedText,  // 传递 Coordinator 的上下文
          depth + 1
        );
        subagentResults.push(subResult);
      }

      // 清除已执行的派发指令
      coordinator.clearPendingDispatches();

      // 将子智能体结果反馈给 Coordinator
      if (subagentResults.length > 0 && newSessionId) {
        const feedbackPrompt = buildSubagentFeedback(subagentResults);
        console.log();
        console.log(fmt(`> Coordinator processing results`, colors.accent));

        // 递归调用，让 Coordinator 处理子智能体结果
        return await runQuery(feedbackPrompt, newSessionId, depth + 1);
      }
    }

    return newSessionId;
  } catch (error) {
    console.log(
      fmt(`x Error: `, colors.error) +
      fmt(error instanceof Error ? error.message : String(error), colors.error)
    );
    return sessionId;
  }
}

/**
 * 构建子智能体结果反馈
 */
function buildSubagentFeedback(results: SubagentResultLegacy[]): string {
  const feedback = results.map(r => {
    const status = r.success ? "✓ Success" : "✗ Failed";
    return `## ${AGENT_CONFIGS[r.agent as SubagentType].name} Agent Result (${status})

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
  console.log(fmt(`* Help`, colors.accent, colors.bold));
  console.log();

  console.log(fmt("Commands:", colors.tiffany));
  console.log(fmt(`  /help     `, colors.accent) + fmt("Show this help", colors.dim));
  console.log(fmt(`  /mode     `, colors.accent) + fmt("Switch permission mode", colors.dim));
  console.log(fmt(`  /clear    `, colors.accent) + fmt("Start new session", colors.dim));
  console.log(fmt(`  /exit     `, colors.accent) + fmt("Exit program", colors.dim));
  console.log();

  console.log(fmt("File Reference:", colors.tiffany));
  console.log(fmt(`  @         `, colors.accent) + fmt("Open file browser", colors.dim));
  console.log(fmt(`  @file.ts  `, colors.accent) + fmt("Attach file to context", colors.dim));
  console.log();

  console.log(fmt("Skills:", colors.tiffany));
  console.log(fmt(`  Skills are loaded from .claude/skills/`, colors.dim));
  console.log(fmt(`  Use /skill-name or just ask naturally`, colors.dim));
  console.log();

  console.log(fmt("Usage:", colors.tiffany));
  console.log(fmt(`  Just type your question and press Enter`, colors.dim));
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
      agentRegistry.setEnvironment(AGENT_ROOT, process.cwd(), currentPermissionMode);
      console.log();
      console.log(fmt(`  ${icons.check} Switched to Safe mode`, colors.success));
      console.log(fmt(`    Auto-accept file edits, confirm Bash commands`, colors.dim));
      console.log();
    } else if (arg === "2" || arg.toLowerCase() === "unsafe") {
      currentPermissionMode = "bypassPermissions";
      agentRegistry.setEnvironment(AGENT_ROOT, process.cwd(), currentPermissionMode);
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
          agentRegistry.setEnvironment(AGENT_ROOT, process.cwd(), currentPermissionMode);
          console.log(fmt(`  ${icons.check} Switched to Safe mode`, colors.success));
        } else if (result.command.name === "unsafe") {
          currentPermissionMode = "bypassPermissions";
          agentRegistry.setEnvironment(AGENT_ROOT, process.cwd(), currentPermissionMode);
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

  // 初始化 Agent 系统
  initializeAgents();

  let sessionId: string | undefined;

  // 初始化会话记录
  currentTranscript = new Transcript(undefined, path.join(AGENT_ROOT, "data", "logs"));
  console.log(fmt(`Session: ${currentTranscript.getSessionId()}`, colors.dim));
  console.log();

  try {
    while (true) {
      const commands = buildCommandList();
      const smartInput = new SmartInput({
        prompt: fmt(`${icons.prompt} `, colors.accent),
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
      fmt(`\nx Fatal: `, colors.error) +
      fmt(error instanceof Error ? error.message : String(error), colors.error)
    );
  }

  // 保存会话记录
  if (currentTranscript) {
    const textPath = currentTranscript.saveAsText();
    const jsonPath = currentTranscript.saveAsJson();
    console.log(fmt(`Saved: ${textPath}`, colors.dim));
  }

  console.log();
  console.log(fmt(`* Goodbye!`, colors.tiffany));
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
