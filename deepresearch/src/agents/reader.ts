/**
 * Reader Agent - 阅读者
 *
 * 职责：代码分析、结构理解、依赖追踪
 */
import { BaseAgent, type AgentCallbacks } from "./base.js";
import type { AgentResult } from "./types.js";
import { generateToolRestrictionPrompt } from "../utils/tool-interceptor.js";

/**
 * Reader Agent 类
 */
export class ReaderAgent extends BaseAgent {
  constructor() {
    super("reader");
  }

  /**
   * 执行任务 - 使用 SDK 进行代码分析
   */
  async execute(
    task: string,
    context?: string,
    callbacks?: AgentCallbacks
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // 记录开始分析
    this.writeContext("reader:currentTask", {
      task: task.slice(0, 100),
      startTime,
      status: "analyzing",
    });

    // 广播开始消息
    this.broadcast(`Starting analysis: ${task.slice(0, 50)}...`);

    try {
      // 使用 SDK 执行实际的代码分析
      const result = await this.runSDKQuery(task, {
        context,
        callbacks,
      });

      // 更新状态
      this.writeContext("reader:currentTask", {
        task: task.slice(0, 100),
        startTime,
        status: result.success ? "completed" : "failed",
        endTime: Date.now(),
      });

      // 广播完成消息
      this.broadcast(`Analysis ${result.success ? "completed" : "failed"}: ${task.slice(0, 50)}...`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.writeContext("reader:currentTask", {
        task: task.slice(0, 100),
        startTime,
        status: "failed",
        error: errorMsg,
      });

      return {
        agent: "reader",
        task,
        output: `Analysis failed: ${errorMsg}`,
        success: false,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建系统提示词（覆盖基类）
   */
  protected buildFullSystemPrompt(): string {
    // 生成工具限制提示词
    const toolRestrictions = generateToolRestrictionPrompt("reader");

    return `${this.systemPrompt}

${toolRestrictions}

IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${this.userCwd}
- When reading/writing files, use paths relative to ${this.userCwd} or absolute paths

You are the Reader agent - a specialized code analyst.

Your primary tools are:
- Read: Read file contents
- Glob: Find files by pattern
- Grep: Search for patterns in code
- LSP: Get code intelligence (definitions, references, hover info)

Focus on:
1. Understanding code structure and architecture
2. Identifying dependencies and relationships
3. Explaining how code works
4. Finding relevant files and functions

CRITICAL: You CANNOT use Write or Edit tools. If you need to write files, use [DISPATCH:coder] to hand off the task.`;
  }
}

/**
 * 创建 Reader Agent
 */
export function createReaderAgent(): ReaderAgent {
  return new ReaderAgent();
}
