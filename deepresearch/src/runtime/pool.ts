/**
 * Agent 池 - 并行执行管理
 *
 * 支持并行、串行、优先级执行
 */
import type { SubagentType, AgentTask, AgentResult } from "../agents/types.js";
import { generateId } from "../utils/file-utils.js";
import { MAX_PARALLEL_AGENTS, AGENT_TIMEOUT } from "../config/constants.js";
import { getMessageBus } from "./bus.js";

// 任务执行器类型
type TaskExecutor = (task: AgentTask) => Promise<AgentResult>;

// 池状态
interface PoolStatus {
  running: number;
  pending: number;
  completed: number;
  failed: number;
}

/**
 * Agent 池类
 */
export class AgentPool {
  private executor: TaskExecutor;
  private pendingTasks: AgentTask[];
  private runningTasks: Map<string, AgentTask>;
  private completedTasks: Map<string, AgentResult>;
  private maxConcurrent: number;
  private bus = getMessageBus();

  constructor(executor: TaskExecutor, maxConcurrent: number = MAX_PARALLEL_AGENTS) {
    this.executor = executor;
    this.pendingTasks = [];
    this.runningTasks = new Map();
    this.completedTasks = new Map();
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * 创建任务
   */
  createTask(
    agent: SubagentType,
    task: string,
    context?: string,
    priority: number = 0,
    dependencies: string[] = []
  ): AgentTask {
    const agentTask: AgentTask = {
      id: generateId(),
      agent,
      task,
      context,
      priority,
      dependencies,
      status: "pending",
    };

    return agentTask;
  }

  /**
   * 提交单个任务
   */
  submit(task: AgentTask): string {
    this.pendingTasks.push(task);
    // 按优先级排序（高优先级在前）
    this.pendingTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.bus.emit("task:dispatch", task);
    return task.id;
  }

  /**
   * 批量提交任务
   */
  submitBatch(tasks: AgentTask[]): string[] {
    const ids: string[] = [];
    for (const task of tasks) {
      ids.push(this.submit(task));
    }
    return ids;
  }

  /**
   * 并行执行所有待处理任务
   */
  async runParallel(): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const executing: Promise<void>[] = [];

    while (this.pendingTasks.length > 0 || this.runningTasks.size > 0) {
      // 启动新任务（不超过最大并发数）
      while (
        this.pendingTasks.length > 0 &&
        this.runningTasks.size < this.maxConcurrent
      ) {
        const task = this.getNextReadyTask();
        if (!task) break;

        const promise = this.executeTask(task).then((result) => {
          results.push(result);
        });
        executing.push(promise);
      }

      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing);
        // 移除已完成的 Promise
        executing.length = 0;
        for (const [id, task] of this.runningTasks) {
          if (task.status === "running") {
            executing.push(
              this.executeTask(task).then((result) => {
                results.push(result);
              })
            );
          }
        }
      }
    }

    return results;
  }

  /**
   * 串行执行所有待处理任务
   */
  async runSequential(): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    while (this.pendingTasks.length > 0) {
      const task = this.getNextReadyTask();
      if (!task) break;

      const result = await this.executeTask(task);
      results.push(result);
    }

    return results;
  }

  /**
   * 执行单个任务
   */
  async run(taskId: string): Promise<AgentResult | null> {
    const taskIndex = this.pendingTasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return null;

    const task = this.pendingTasks.splice(taskIndex, 1)[0];
    return this.executeTask(task);
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<AgentResult[]> {
    return this.runParallel();
  }

  /**
   * 等待特定任务完成
   */
  async waitFor(taskId: string, timeout: number = AGENT_TIMEOUT): Promise<AgentResult | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = this.completedTasks.get(taskId);
      if (result) return result;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * 获取下一个可执行的任务（检查依赖）
   */
  private getNextReadyTask(): AgentTask | null {
    for (let i = 0; i < this.pendingTasks.length; i++) {
      const task = this.pendingTasks[i];

      // 检查依赖是否都已完成
      const dependenciesMet = (task.dependencies || []).every((depId) =>
        this.completedTasks.has(depId)
      );

      if (dependenciesMet) {
        return this.pendingTasks.splice(i, 1)[0];
      }
    }

    return null;
  }

  /**
   * 执行任务
   */
  private async executeTask(task: AgentTask): Promise<AgentResult> {
    task.status = "running";
    this.runningTasks.set(task.id, task);
    this.bus.emit("agent:start", { taskId: task.id, agent: task.agent });

    try {
      const result = await Promise.race([
        this.executor(task),
        this.timeout(AGENT_TIMEOUT, task.id),
      ]);

      task.status = "completed";
      task.result = result;
      this.completedTasks.set(task.id, result);
      this.bus.emit("agent:complete", { taskId: task.id, result });

      return result;
    } catch (error) {
      const errorResult: AgentResult = {
        agent: task.agent,
        task: task.task,
        output: `Error: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
        duration_ms: 0,
      };

      task.status = "failed";
      task.result = errorResult;
      this.completedTasks.set(task.id, errorResult);
      this.bus.emit("agent:error", { taskId: task.id, error });

      return errorResult;
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * 超时处理
   */
  private timeout(ms: number, taskId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * 获取池状态
   */
  getStatus(): PoolStatus {
    return {
      running: this.runningTasks.size,
      pending: this.pendingTasks.length,
      completed: Array.from(this.completedTasks.values()).filter((r) => r.success).length,
      failed: Array.from(this.completedTasks.values()).filter((r) => !r.success).length,
    };
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): AgentTask["status"] | "not_found" {
    if (this.completedTasks.has(taskId)) return "completed";
    if (this.runningTasks.has(taskId)) return "running";
    if (this.pendingTasks.find((t) => t.id === taskId)) return "pending";
    return "not_found";
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    const index = this.pendingTasks.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      this.pendingTasks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 取消所有待处理任务
   */
  cancelAll(): number {
    const count = this.pendingTasks.length;
    this.pendingTasks = [];
    return count;
  }

  /**
   * 重置池
   */
  reset(): void {
    this.pendingTasks = [];
    this.runningTasks.clear();
    this.completedTasks.clear();
  }

  /**
   * 获取所有结果
   */
  getResults(): AgentResult[] {
    return Array.from(this.completedTasks.values());
  }

  /**
   * 获取特定任务的结果
   */
  getResult(taskId: string): AgentResult | undefined {
    return this.completedTasks.get(taskId);
  }
}
