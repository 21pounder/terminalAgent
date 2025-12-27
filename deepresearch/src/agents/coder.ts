/**
 * Coder Agent - 编码者
 *
 * 职责：代码生成、修改、重构
 */
import { BaseAgent, type AgentCallbacks } from "./base.js";
import type { AgentResult } from "./types.js";

/**
 * Coder Agent 类
 */
export class CoderAgent extends BaseAgent {
  constructor() {
    super("coder");
  }

  /**
   * 执行任务 - 使用 SDK 进行代码编写
   */
  async execute(
    task: string,
    context?: string,
    callbacks?: AgentCallbacks
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // 记录开始编码
    this.writeContext("coder:currentTask", {
      task: task.slice(0, 100),
      startTime,
      status: "coding",
    });

    // 广播开始消息
    this.broadcast(`Starting implementation: ${task.slice(0, 50)}...`);

    try {
      // 使用 SDK 执行实际的代码编写
      const result = await this.runSDKQuery(task, {
        context,
        callbacks,
      });

      // 更新状态
      this.writeContext("coder:currentTask", {
        task: task.slice(0, 100),
        startTime,
        status: result.success ? "completed" : "failed",
        endTime: Date.now(),
      });

      // 广播完成消息
      this.broadcast(`Implementation ${result.success ? "completed" : "failed"}: ${task.slice(0, 50)}...`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.writeContext("coder:currentTask", {
        task: task.slice(0, 100),
        startTime,
        status: "failed",
        error: errorMsg,
      });

      return {
        agent: "coder",
        task,
        output: `Coding failed: ${errorMsg}`,
        success: false,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建系统提示词（覆盖基类）
   */
  protected buildFullSystemPrompt(): string {
    return `${this.systemPrompt}

IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${this.userCwd}
- When reading/writing files, use paths relative to ${this.userCwd} or absolute paths

You are the Coder agent - a specialized code implementer.

Your primary tools are:
- Read: Read existing code
- Write: Create new files
- Edit: Modify existing files
- Bash: Run commands (npm, git, build tools, etc.)
- Glob/Grep: Find relevant code
- LSP: Navigate code structure

Focus on:
1. Writing clean, maintainable code
2. Following existing code patterns and conventions
3. Adding proper error handling
4. Making minimal, focused changes

Skills in .claude/skills/ are available via the Skill tool.`;
  }
}

/**
 * 创建 Coder Agent
 */
export function createCoderAgent(): CoderAgent {
  return new CoderAgent();
}
