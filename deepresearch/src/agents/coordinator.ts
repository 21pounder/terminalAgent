/**
 * Coordinator Agent - 协调者
 *
 * 职责：理解意图、任务分解、Agent 调度
 */
import { BaseAgent, type AgentCallbacks } from "./base.js";
import type { AgentResult, SubagentType } from "./types.js";
import { getRouter } from "../core/router.js";
import { AGENT_CONFIGS, AGENT_ICONS } from "../config/agents.js";

// 派发检测结果
export interface DispatchCommand {
  agent: SubagentType;
  task: string;
}

/**
 * Coordinator Agent 类
 */
export class CoordinatorAgent extends BaseAgent {
  private pendingDispatches: DispatchCommand[] = [];
  private collectedOutput: string = "";

  constructor() {
    super("coordinator");
  }

  /**
   * 执行任务 - 使用 SDK 进行协调
   */
  async execute(
    task: string,
    context?: string,
    callbacks?: AgentCallbacks
  ): Promise<AgentResult> {
    const startTime = Date.now();
    this.pendingDispatches = [];
    this.collectedOutput = "";

    // 分析任务复杂度
    const router = getRouter();
    const complexity = router.analyzeComplexity(task);

    this.log(`Task complexity: ${complexity.level}`);
    this.log(`Suggested agents: ${complexity.suggestedAgents.join(", ")}`);

    // 保存分析结果到共享上下文
    this.writeContext("coordinator:analysis", {
      task: task.slice(0, 100),
      complexity: complexity.level,
      suggestedAgents: complexity.suggestedAgents,
      timestamp: Date.now(),
    });

    // 广播开始消息
    this.broadcast(`Starting coordination: ${task.slice(0, 50)}...`);

    try {
      // 使用 SDK 执行，同时检测派发指令
      const result = await this.runSDKQueryWithDispatch(task, {
        context,
        callbacks,
      });

      // 更新状态
      this.writeContext("coordinator:lastTask", {
        task: task.slice(0, 100),
        success: result.success,
        dispatches: this.pendingDispatches.length,
        duration: Date.now() - startTime,
      });

      // 广播完成消息
      this.broadcast(`Coordination ${result.success ? "completed" : "failed"}: ${task.slice(0, 50)}...`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      return {
        agent: "coordinator",
        task,
        output: `Coordination failed: ${errorMsg}`,
        success: false,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * 使用 SDK 运行查询，同时检测派发指令
   */
  private async runSDKQueryWithDispatch(
    prompt: string,
    options: {
      context?: string;
      sessionId?: string;
      callbacks?: AgentCallbacks;
    } = {}
  ): Promise<AgentResult> {
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
            append: this.buildCoordinatorPrompt(),
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
                  // 检测派发指令
                  const dispatch = this.parseDispatchCommand(block.text);
                  if (dispatch) {
                    this.pendingDispatches.push(dispatch);
                    // 通知回调有派发
                    if (options.callbacks?.onText) {
                      options.callbacks.onText(`[DISPATCH:${dispatch.agent}] ${dispatch.task}`);
                    }
                  } else {
                    output += block.text + "\n";
                    options.callbacks?.onText?.(block.text);
                  }
                  this.collectedOutput += block.text + "\n";
                } else if (block.type === "tool_use") {
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
   * 构建 Coordinator 专属提示词
   */
  private buildCoordinatorPrompt(): string {
    const agentDescriptions = Object.entries(AGENT_CONFIGS)
      .filter(([type]) => type !== "coordinator")
      .map(([type, config]) => `- **${config.name}** (${type}): ${config.description}`)
      .join("\n");

    return `${this.systemPrompt}

IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${this.userCwd}
- When reading/writing files, use paths relative to ${this.userCwd} or absolute paths

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

Skills in .claude/skills/ are also available via the Skill tool.`;
  }

  /**
   * 解析派发指令
   */
  parseDispatchCommand(text: string): DispatchCommand | null {
    const pattern = /\[DISPATCH:(\w+)\]\s*(.+)/i;
    const match = text.match(pattern);

    if (match) {
      const agentName = match[1].toLowerCase() as SubagentType;
      const task = match[2].trim();

      if (["reader", "coder", "reviewer"].includes(agentName)) {
        return { agent: agentName, task };
      }
    }

    return null;
  }

  /**
   * 获取待执行的派发指令
   */
  getPendingDispatches(): DispatchCommand[] {
    return [...this.pendingDispatches];
  }

  /**
   * 清除待执行的派发指令
   */
  clearPendingDispatches(): void {
    this.pendingDispatches = [];
  }

  /**
   * 获取收集的输出
   */
  getCollectedOutput(): string {
    return this.collectedOutput;
  }

  /**
   * 创建子任务
   */
  createSubtask(originalTask: string, agent: SubagentType): string {
    switch (agent) {
      case "reader":
        return `Analyze and understand: ${originalTask}`;
      case "coder":
        return `Implement: ${originalTask}`;
      case "reviewer":
        return `Review and check: ${originalTask}`;
      default:
        return originalTask;
    }
  }

  /**
   * 汇总子 Agent 结果
   */
  summarizeResults(results: AgentResult[]): string {
    if (results.length === 0) {
      return "No subtasks were executed.";
    }

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    let summary = `## Coordination Summary\n\n`;
    summary += `Total: ${results.length} tasks, ${successful.length} successful, ${failed.length} failed\n\n`;

    for (const result of results) {
      const status = result.success ? "✓" : "✗";
      const config = AGENT_CONFIGS[result.agent];
      const icon = AGENT_ICONS[result.agent] || "🤖";
      summary += `### ${status} ${icon} ${config?.name || result.agent}\n`;
      summary += `${result.output.slice(0, 500)}\n\n`;
    }

    return summary;
  }
}

/**
 * 创建 Coordinator Agent
 */
export function createCoordinatorAgent(): CoordinatorAgent {
  return new CoordinatorAgent();
}
