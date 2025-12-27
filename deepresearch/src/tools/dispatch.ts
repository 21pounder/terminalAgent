/**
 * 任务派发工具
 */
import type { SubagentType, AgentTask, AgentResult } from "../agents/types.js";
import { AgentPool } from "../runtime/pool.js";
import { getMessageBus } from "../runtime/bus.js";
import { getSharedContext } from "../runtime/shared.js";
import { generateId } from "../utils/file-utils.js";

// 任务执行器类型
type TaskExecutor = (task: AgentTask) => Promise<AgentResult>;

/**
 * 派发工具类
 */
export class DispatchTool {
  private pool: AgentPool;
  private pendingTasks: Map<string, AgentTask>;
  private bus = getMessageBus();
  private sharedContext = getSharedContext();

  constructor(executor: TaskExecutor, maxParallel: number = 3) {
    this.pool = new AgentPool(executor, maxParallel);
    this.pendingTasks = new Map();
  }

  /**
   * 派发任务给指定 Agent
   */
  dispatch(
    agent: SubagentType,
    task: string,
    context?: string,
    priority: number = 0
  ): string {
    const agentTask = this.pool.createTask(agent, task, context, priority);
    this.pendingTasks.set(agentTask.id, agentTask);
    this.pool.submit(agentTask);

    // 发送派发事件
    this.bus.emit("task:dispatch", {
      taskId: agentTask.id,
      agent,
      task,
    });

    // 记录到共享上下文
    this.sharedContext.append("dispatch:history", {
      taskId: agentTask.id,
      agent,
      task: task.slice(0, 100),
      timestamp: Date.now(),
    });

    return agentTask.id;
  }

  /**
   * 并行派发多个任务
   */
  dispatchParallel(
    tasks: Array<{ agent: SubagentType; task: string; context?: string }>
  ): string[] {
    const ids: string[] = [];

    for (const { agent, task, context } of tasks) {
      const id = this.dispatch(agent, task, context);
      ids.push(id);
    }

    return ids;
  }

  /**
   * 派发并等待结果
   */
  async dispatchAndWait(
    agent: SubagentType,
    task: string,
    context?: string,
    timeout: number = 300000
  ): Promise<AgentResult | null> {
    const taskId = this.dispatch(agent, task, context);
    return this.pool.waitFor(taskId, timeout);
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<AgentResult[]> {
    return this.pool.waitAll();
  }

  /**
   * 等待特定任务
   */
  async waitFor(taskId: string, timeout?: number): Promise<AgentResult | null> {
    return this.pool.waitFor(taskId, timeout);
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): AgentTask["status"] | "not_found" {
    return this.pool.getTaskStatus(taskId);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    this.pendingTasks.delete(taskId);
    return this.pool.cancel(taskId);
  }

  /**
   * 取消所有待处理任务
   */
  cancelAll(): number {
    this.pendingTasks.clear();
    return this.pool.cancelAll();
  }

  /**
   * 获取池状态
   */
  getStatus() {
    return this.pool.getStatus();
  }

  /**
   * 获取所有结果
   */
  getResults(): AgentResult[] {
    return this.pool.getResults();
  }

  /**
   * 获取特定任务结果
   */
  getResult(taskId: string): AgentResult | undefined {
    return this.pool.getResult(taskId);
  }

  /**
   * 重置
   */
  reset(): void {
    this.pool.reset();
    this.pendingTasks.clear();
  }
}

// 全局派发工具实例
let globalDispatchTool: DispatchTool | null = null;

/**
 * 初始化派发工具
 */
export function initDispatchTool(executor: TaskExecutor, maxParallel?: number): DispatchTool {
  globalDispatchTool = new DispatchTool(executor, maxParallel);
  return globalDispatchTool;
}

/**
 * 获取派发工具
 */
export function getDispatchTool(): DispatchTool | null {
  return globalDispatchTool;
}

/**
 * 快捷函数：派发任务
 */
export function dispatchToAgent(
  agent: SubagentType,
  task: string,
  context?: string
): string | null {
  if (!globalDispatchTool) {
    console.error("DispatchTool not initialized");
    return null;
  }
  return globalDispatchTool.dispatch(agent, task, context);
}
