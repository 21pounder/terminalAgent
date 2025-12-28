/**
 * Agent 基类
 */
import type { SubagentType, AgentConfig, AgentResult, PermissionMode } from "./types.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { AGENT_CONFIGS, TOOL_ICONS } from "../config/agents.js";
import { loadAgentPrompt } from "../utils/prompt-loader.js";
import { createMessageTool, type MessageTool } from "../tools/message.js";
import { createContextTool, type ContextTool } from "../tools/context.js";
import { getMessageBus } from "../runtime/bus.js";
import { getSharedContext } from "../runtime/shared.js";
import {
  isToolAllowed,
  generateToolRestrictionPrompt,
  logToolViolation,
  findAgentForTool,
} from "../utils/tool-interceptor.js";

/**
 * Agent 执行回调
 */
export interface AgentCallbacks {
  onInit?: (sessionId: string) => void;
  onText?: (text: string) => void;
  onToolUse?: (toolName: string, input: unknown) => void;
  onResult?: (success: boolean, duration: number, cost?: number) => void;
  onProgress?: (toolName: string, elapsed: number) => void;
}

/**
 * Agent 基类
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected messageTool: MessageTool;
  protected contextTool: ContextTool;
  protected systemPrompt: string;
  protected sharedContext = getSharedContext();

  // 执行上下文
  protected agentRoot: string = "";
  protected userCwd: string = "";
  protected permissionMode: PermissionMode = "acceptEdits";
  protected verbose: boolean = false;

  constructor(agentType: SubagentType) {
    this.config = AGENT_CONFIGS[agentType];
    this.messageTool = createMessageTool(agentType);
    this.contextTool = createContextTool(agentType);
    this.systemPrompt = loadAgentPrompt(this.config.promptFile);
  }

  /**
   * 设置执行环境
   */
  setEnvironment(agentRoot: string, userCwd: string, permissionMode?: PermissionMode): void {
    this.agentRoot = agentRoot;
    this.userCwd = userCwd;
    if (permissionMode) {
      this.permissionMode = permissionMode;
    }
  }

  /**
   * 设置详细输出模式
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * 获取工具图标
   */
  protected getToolIcon(toolName: string): string {
    return TOOL_ICONS[toolName] || "⚙️";
  }

  /**
   * 获取 Agent 类型
   */
  getType(): SubagentType {
    return this.config.type;
  }

  /**
   * 获取 Agent 名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取 Agent 描述
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * 获取系统提示词
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * 获取允许的工具列表
   */
  getAllowedTools(): string[] {
    return this.config.allowedTools;
  }

  /**
   * 检查是否可以派发任务
   */
  canDispatch(): boolean {
    return this.config.canDispatch;
  }

  /**
   * 发送消息给其他 Agent
   */
  sendMessage(to: SubagentType, content: string) {
    return this.messageTool.send(to, content);
  }

  /**
   * 广播消息
   */
  broadcast(content: string) {
    return this.messageTool.broadcast(content);
  }

  /**
   * 读取共享上下文
   */
  readContext<T>(key: string): T | undefined {
    return this.contextTool.read<T>(key);
  }

  /**
   * 写入共享上下文
   */
  writeContext(key: string, value: unknown): void {
    this.contextTool.write(key, value);
  }

  /**
   * 执行任务（抽象方法，子类实现）
   */
  abstract execute(
    task: string,
    context?: string,
    callbacks?: AgentCallbacks
  ): Promise<AgentResult>;

  /**
   * 使用 SDK 运行查询（供子类使用）
   */
  protected async runSDKQuery(
    prompt: string,
    options: {
      context?: string;
      sessionId?: string;
      callbacks?: AgentCallbacks;
    } = {}
  ): Promise<AgentResult> {
    // 动态导入避免循环依赖
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const { MCP_SERVERS } = await import("../config/tools.js");
    const { DEFAULT_MODEL } = await import("../config/constants.js");

    const startTime = Date.now();
    let output = "";
    let success = true;
    let newSessionId: string | undefined;
    let cost: number | undefined;

    const fullPrompt = options.context
      ? `Context:\n${options.context}\n\nTask: ${prompt}`
      : prompt;

    try {
      const result = query({
        prompt: fullPrompt,
        options: {
          cwd: this.agentRoot,
          model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
          settingSources: ["project"],
          additionalDirectories: [this.userCwd],
          mcpServers: MCP_SERVERS,
          permissionMode: this.permissionMode,
          tools: { type: "preset", preset: "claude_code" },
          resume: options.sessionId,
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: this.buildFullSystemPrompt(),
          },
        },
      });

      for await (const msg of result) {
        switch (msg.type) {
          case "system":
            if (msg.subtype === "init") {
              newSessionId = msg.session_id;
              options.callbacks?.onInit?.(msg.session_id);
            }
            break;

          case "assistant":
            const content = msg.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text") {
                  output += block.text + "\n";
                  options.callbacks?.onText?.(block.text);
                } else if (block.type === "tool_use") {
                  // Check tool permission
                  const toolAllowed = isToolAllowed(this.config.type, block.name);
                  if (!toolAllowed) {
                    logToolViolation(this.config.type, block.name, false);
                    // Log violation but still report the tool use
                    // (SDK already executed it, we can only warn)
                  }
                  options.callbacks?.onToolUse?.(block.name, block.input);
                }
              }
            }
            break;

          case "result":
            success = msg.subtype === "success";
            cost = msg.total_cost_usd;
            options.callbacks?.onResult?.(success, msg.duration_ms, cost);
            break;

          case "tool_progress":
            options.callbacks?.onProgress?.(msg.tool_name, msg.elapsed_time_seconds);
            break;
        }
      }
    } catch (error) {
      success = false;
      output = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      agent: this.config.type,
      task: prompt,
      output: output.trim(),
      success,
      duration_ms: Date.now() - startTime,
      sessionId: newSessionId,
      cost,
    };
  }

  /**
   * 构建完整系统提示词
   */
  protected buildFullSystemPrompt(): string {
    // 生成工具限制提示词
    const toolRestrictions = generateToolRestrictionPrompt(this.config.type);

    return `${this.systemPrompt}

${toolRestrictions}

IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${this.userCwd}
- When reading/writing files, use paths relative to ${this.userCwd} or absolute paths

You are the ${this.config.name} agent. ${this.config.description}.
Focus on your specific task and complete it directly.
Skills in .claude/skills/ are available via the Skill tool.`;
  }

  /**
   * 处理接收到的消息
   */
  protected handleMessage(handler: (msg: any) => void): () => void {
    return this.messageTool.subscribe(handler);
  }

  /**
   * 记录日志
   */
  protected log(message: string): void {
    console.log(`[${this.config.name}] ${message}`);
  }

  /**
   * 记录错误
   */
  protected logError(message: string): void {
    console.error(`[${this.config.name}] ERROR: ${message}`);
  }
}

/**
 * Agent 工厂函数类型
 */
export type AgentFactory = (agentType: SubagentType) => BaseAgent;
