/**
 * 编排器 - 协调多个运行时组件
 *
 * 统一执行入口，根据模式选择执行策略
 */
import type {
  SubagentType,
  AgentTask,
  AgentResult,
  ExecutionMode,
  AgentMessage,
} from "../agents/types.js";
import { AgentPool } from "./pool.js";
import { ReActExecutor, type ReActResult } from "./react.js";
import { getMessageBus, type MessageBus } from "./bus.js";
import { getSharedContext, type SharedContext } from "./shared.js";
import { ContextCompressor } from "./context-compressor.js";
import { AGENT_CONFIGS } from "../config/agents.js";

// 编排结果
export interface OrchestratorResult {
  mode: ExecutionMode;
  success: boolean;
  results: AgentResult[];
  duration: number;
  summary?: string;
}

// 编排配置
export interface OrchestratorConfig {
  defaultMode: ExecutionMode;
  enableReAct: boolean;
  enableParallel: boolean;
  maxParallel: number;
  verbose: boolean;
}

// 任务执行器
type TaskExecutor = (task: AgentTask) => Promise<AgentResult>;

/**
 * 编排器类
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private executor: TaskExecutor;
  private bus: MessageBus;
  private sharedContext: SharedContext;
  private compressor: ContextCompressor;
  private pool: AgentPool;

  constructor(executor: TaskExecutor, config: Partial<OrchestratorConfig> = {}) {
    this.executor = executor;
    this.config = {
      defaultMode: config.defaultMode ?? "single",
      enableReAct: config.enableReAct ?? true,
      enableParallel: config.enableParallel ?? true,
      maxParallel: config.maxParallel ?? 3,
      verbose: config.verbose ?? false,
    };

    this.bus = getMessageBus();
    this.sharedContext = getSharedContext();
    this.compressor = new ContextCompressor();
    this.pool = new AgentPool(executor, this.config.maxParallel);
  }

  /**
   * 执行任务
   */
  async execute(
    task: string,
    mode?: ExecutionMode,
    context?: string
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const effectiveMode = mode ?? this.detectMode(task);

    this.log(`Executing in ${effectiveMode} mode: ${task.slice(0, 50)}...`);

    // 保存任务到共享上下文
    this.sharedContext.set("orchestrator:currentTask", {
      task,
      mode: effectiveMode,
      startTime,
    });

    try {
      let results: AgentResult[];

      switch (effectiveMode) {
        case "single":
          results = await this.executeSingle(task, context);
          break;

        case "parallel":
          results = await this.executeParallel(task, context);
          break;

        case "react":
          results = await this.executeReAct(task, context);
          break;

        case "coordinator":
          results = await this.executeCoordinator(task, context);
          break;

        default:
          results = await this.executeSingle(task, context);
      }

      const duration = Date.now() - startTime;
      const success = results.every((r) => r.success);

      return {
        mode: effectiveMode,
        success,
        results,
        duration,
        summary: this.generateSummary(results),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        mode: effectiveMode,
        success: false,
        results: [
          {
            agent: "coordinator",
            task,
            output: `Error: ${error instanceof Error ? error.message : String(error)}`,
            success: false,
            duration_ms: duration,
          },
        ],
        duration,
      };
    }
  }

  /**
   * 单 Agent 执行
   */
  private async executeSingle(task: string, context?: string): Promise<AgentResult[]> {
    const agentType = this.detectAgent(task);
    const agentTask = this.pool.createTask(agentType, task, context);

    this.pool.submit(agentTask);
    return this.pool.runSequential();
  }

  /**
   * 并行执行
   */
  private async executeParallel(task: string, context?: string): Promise<AgentResult[]> {
    // 分解任务为多个子任务
    const subtasks = await this.decomposeTasks(task, context);

    if (subtasks.length === 0) {
      return this.executeSingle(task, context);
    }

    // 提交所有子任务
    for (const subtask of subtasks) {
      this.pool.submit(subtask);
    }

    // 并行执行
    return this.pool.runParallel();
  }

  /**
   * ReAct 模式执行
   */
  private async executeReAct(task: string, context?: string): Promise<AgentResult[]> {
    const startTime = Date.now();

    // 创建 ReAct 执行器
    const reactExecutor = new ReActExecutor(
      async (observation, history) => {
        // 简化的思考函数 - 实际应该调用 LLM
        return {
          thought: `Analyzing: ${observation.slice(0, 100)}...`,
          action: { tool: "Read", input: { file_path: "." } },
          shouldStop: history.length >= 5,
        };
      },
      async (action) => {
        // 执行行动
        const agentTask = this.pool.createTask("coder", `Execute ${action.tool}`, JSON.stringify(action));
        this.pool.submit(agentTask);
        const results = await this.pool.runSequential();
        return results[0]?.output || "No output";
      },
      { verbose: this.config.verbose }
    );

    const initialObservation = context
      ? `Task: ${task}\n\nContext:\n${context}`
      : `Task: ${task}`;

    const reactResult = await reactExecutor.run(initialObservation);

    return [
      {
        agent: "coordinator",
        task,
        output: reactResult.finalOutput || `ReAct completed with status: ${reactResult.status}`,
        success: reactResult.status === "success",
        duration_ms: Date.now() - startTime,
      },
    ];
  }

  /**
   * Coordinator 模式执行
   */
  private async executeCoordinator(task: string, context?: string): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const startTime = Date.now();

    // 1. 首先让 Reader 分析
    const readerTask = this.pool.createTask(
      "reader",
      `Analyze the context for: ${task}`,
      context,
      1 // 高优先级
    );
    this.pool.submit(readerTask);
    const readerResults = await this.pool.runSequential();
    results.push(...readerResults);

    // 2. 根据分析结果，让 Coder 执行
    if (readerResults[0]?.success) {
      const coderTask = this.pool.createTask(
        "coder",
        task,
        readerResults[0].output,
        0,
        [readerTask.id] // 依赖 Reader
      );
      this.pool.submit(coderTask);
      const coderResults = await this.pool.runSequential();
      results.push(...coderResults);

      // 3. 让 Reviewer 审查
      if (coderResults[0]?.success) {
        const reviewerTask = this.pool.createTask(
          "reviewer",
          `Review the changes for: ${task}`,
          coderResults[0].output,
          0,
          [coderTask.id] // 依赖 Coder
        );
        this.pool.submit(reviewerTask);
        const reviewerResults = await this.pool.runSequential();
        results.push(...reviewerResults);
      }
    }

    return results;
  }

  /**
   * 检测执行模式
   */
  private detectMode(task: string): ExecutionMode {
    const lowerTask = task.toLowerCase();

    // 复杂任务使用 Coordinator
    if (
      lowerTask.includes("重构") ||
      lowerTask.includes("refactor") ||
      lowerTask.includes("implement") ||
      lowerTask.includes("实现")
    ) {
      return "coordinator";
    }

    // 需要深度推理的任务使用 ReAct
    if (
      lowerTask.includes("debug") ||
      lowerTask.includes("调试") ||
      lowerTask.includes("investigate") ||
      lowerTask.includes("分析")
    ) {
      return this.config.enableReAct ? "react" : "single";
    }

    // 多个独立子任务使用并行
    if (
      lowerTask.includes("and") ||
      lowerTask.includes("并且") ||
      lowerTask.includes("同时")
    ) {
      return this.config.enableParallel ? "parallel" : "single";
    }

    return this.config.defaultMode;
  }

  /**
   * 检测应该使用的 Agent
   */
  private detectAgent(task: string): SubagentType {
    const lowerTask = task.toLowerCase();

    // 简单关键词匹配
    const keywords: Record<SubagentType, string[]> = {
      coder: ["write", "create", "add", "fix", "implement", "写", "创建", "添加", "修复"],
      reader: ["read", "analyze", "understand", "explain", "看", "分析", "理解"],
      reviewer: ["review", "check", "audit", "审查", "检查"],
      coordinator: ["coordinate", "plan", "orchestrate"],
    };

    for (const [agent, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (lowerTask.includes(word)) {
          return agent as SubagentType;
        }
      }
    }

    return "coordinator";
  }

  /**
   * 分解任务为子任务
   */
  private async decomposeTasks(task: string, context?: string): Promise<AgentTask[]> {
    // 简单实现：按 "and"/"并且" 分割
    const parts = task.split(/\s+and\s+|并且|同时/i).filter(Boolean);

    if (parts.length <= 1) {
      return [];
    }

    return parts.map((part, index) => {
      const agentType = this.detectAgent(part);
      return this.pool.createTask(agentType, part.trim(), context, index);
    });
  }

  /**
   * 生成执行摘要
   */
  private generateSummary(results: AgentResult[]): string {
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

    const agentSummary = results
      .map((r) => `${AGENT_CONFIGS[r.agent]?.name || r.agent}: ${r.success ? "✓" : "✗"}`)
      .join(", ");

    return `Completed ${successful}/${results.length} tasks (${failed} failed) in ${(totalDuration / 1000).toFixed(1)}s. Agents: ${agentSummary}`;
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Orchestrator] ${message}`);
    }
  }

  /**
   * 重置编排器
   */
  reset(): void {
    this.pool.reset();
    this.sharedContext.delete("orchestrator:currentTask");
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      pool: this.pool.getStatus(),
      sharedContext: this.sharedContext.size(),
      messageHistory: this.bus.getHistory().length,
    };
  }
}

// 全局单例
let globalOrchestrator: Orchestrator | null = null;

/**
 * 获取全局编排器
 */
export function getOrchestrator(executor?: (task: any) => Promise<any>): Orchestrator {
  if (!globalOrchestrator) {
    if (!executor) {
      // 默认执行器
      executor = async (task) => ({
        agent: task.agent,
        task: task.task,
        output: `Executed: ${task.task}`,
        success: true,
        duration_ms: 0,
      });
    }
    globalOrchestrator = new Orchestrator(executor);
  }
  return globalOrchestrator;
}

/**
 * 重置全局编排器
 */
export function resetOrchestrator(): void {
  if (globalOrchestrator) {
    globalOrchestrator.reset();
    globalOrchestrator = null;
  }
}
