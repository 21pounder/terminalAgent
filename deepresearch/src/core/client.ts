/**
 * SDK 客户端 - query() 封装
 */
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SubagentType, AgentResult, PermissionMode } from "../agents/types.js";
import { AGENT_CONFIGS, TOOL_ICONS } from "../config/agents.js";
import { DEFAULT_MODEL } from "../config/constants.js";
import { MCP_SERVERS } from "../config/tools.js";
import { loadAgentPrompt } from "../utils/prompt-loader.js";
import { getRouter } from "./router.js";
import { getPermissionManager } from "./permissions.js";
import { getSessionManager } from "./session.js";
import { getMessageBus } from "../runtime/bus.js";
import { getSharedContext } from "../runtime/shared.js";

// 查询选项
export interface QueryOptions {
  agentType?: SubagentType;
  sessionId?: string;
  context?: string;
  model?: string;
  permissionMode?: PermissionMode;
  verbose?: boolean;
  onMessage?: (msg: SDKMessage) => void;
}

// 查询结果
export interface QueryResult {
  output: string;
  sessionId?: string;
  success: boolean;
  duration_ms: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
  cost?: number;
}

/**
 * SDK 客户端类
 */
export class Client {
  private agentRoot: string;
  private userCwd: string;
  private bus = getMessageBus();
  private sharedContext = getSharedContext();

  constructor(agentRoot: string, userCwd?: string) {
    this.agentRoot = agentRoot;
    this.userCwd = userCwd || process.cwd();
  }

  /**
   * 运行查询
   */
  async runQuery(prompt: string, options: QueryOptions = {}): Promise<QueryResult> {
    const startTime = Date.now();
    const router = getRouter();
    const permissionManager = getPermissionManager();
    const sessionManager = getSessionManager(this.agentRoot);

    // 确定 Agent 类型
    const agentType = options.agentType || router.detectTaskType(prompt).agent;
    const config = AGENT_CONFIGS[agentType];

    // 加载 Agent 提示词
    const agentPrompt = loadAgentPrompt(config.promptFile);

    // 构建系统提示词
    const systemPromptAppend = this.buildSystemPrompt(agentType, agentPrompt);

    // 权限模式
    const permissionMode = options.permissionMode || permissionManager.getMode();

    let output = "";
    let newSessionId: string | undefined;
    let success = true;
    let tokenUsage: { input: number; output: number } | undefined;
    let cost: number | undefined;

    try {
      const result = query({
        prompt: options.context
          ? `Context:\n${options.context}\n\nTask: ${prompt}`
          : prompt,
        options: {
          cwd: this.agentRoot,
          model: options.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
          settingSources: ["project"],
          additionalDirectories: [this.userCwd],
          mcpServers: MCP_SERVERS,
          permissionMode,
          tools: { type: "preset", preset: "claude_code" },
          resume: options.sessionId,
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: systemPromptAppend,
          },
        },
      });

      // 处理流式响应
      for await (const msg of result) {
        // 调用回调
        if (options.onMessage) {
          options.onMessage(msg);
        }

        switch (msg.type) {
          case "system":
            if (msg.subtype === "init") {
              newSessionId = msg.session_id;
              sessionManager.addActiveAgent(agentType);
            }
            break;

          case "assistant":
            const content = msg.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text") {
                  output += block.text + "\n";
                } else if (block.type === "tool_use") {
                  if (options.verbose) {
                    const icon = TOOL_ICONS[block.name] || "⚙️";
                    console.log(`  ${icon} ${block.name}`);
                  }
                }
              }
            }
            break;

          case "result":
            success = msg.subtype === "success";
            cost = msg.total_cost_usd;
            break;
        }
      }
    } catch (error) {
      success = false;
      output = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    const duration = Date.now() - startTime;

    // 更新会话
    sessionManager.removeActiveAgent(agentType);

    // 保存到共享上下文
    this.sharedContext.set(`client:lastQuery:${agentType}`, {
      prompt: prompt.slice(0, 100),
      success,
      duration,
    });

    return {
      output: output.trim(),
      sessionId: newSessionId,
      success,
      duration_ms: duration,
      tokenUsage,
      cost,
    };
  }

  /**
   * 运行 Agent 任务
   */
  async runAgent(
    agentType: SubagentType,
    task: string,
    context?: string,
    sessionId?: string
  ): Promise<AgentResult> {
    const result = await this.runQuery(task, {
      agentType,
      context,
      sessionId,
    });

    return {
      agent: agentType,
      task,
      output: result.output,
      success: result.success,
      duration_ms: result.duration_ms,
      tokenUsage: result.tokenUsage,
      cost: result.cost,
    };
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(agentType: SubagentType, agentPrompt: string): string {
    const config = AGENT_CONFIGS[agentType];

    let prompt = agentPrompt;

    prompt += `

IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${this.userCwd}
- When reading/writing files, use paths relative to ${this.userCwd} or absolute paths

You are the ${config.name} agent. ${config.description}.`;

    if (agentType === "coordinator") {
      prompt += `

## Multi-Agent System

You can dispatch tasks to specialized agents by outputting:

\`\`\`
[DISPATCH:reader] Analyze the structure of src/index.ts
\`\`\`

or

\`\`\`
[DISPATCH:coder] Add error handling to the processData function
\`\`\`

Available agents: reader, coder, reviewer`;
    } else {
      prompt += `
Focus on your specific task and complete it directly.
Skills in .claude/skills/ are available via the Skill tool.`;
    }

    return prompt;
  }

  /**
   * 更新工作目录
   */
  setUserCwd(cwd: string): void {
    this.userCwd = cwd;
  }

  /**
   * 获取当前工作目录
   */
  getUserCwd(): string {
    return this.userCwd;
  }
}

// 全局单例
let globalClient: Client | null = null;

/**
 * 获取全局客户端
 */
export function getClient(agentRoot?: string): Client {
  if (!globalClient && agentRoot) {
    globalClient = new Client(agentRoot);
  }
  if (!globalClient) {
    throw new Error("Client not initialized. Call getClient(agentRoot) first.");
  }
  return globalClient;
}

/**
 * 初始化客户端
 */
export function initClient(agentRoot: string, userCwd?: string): Client {
  globalClient = new Client(agentRoot, userCwd);
  return globalClient;
}

/**
 * 重置客户端
 */
export function resetClient(): void {
  globalClient = null;
}
