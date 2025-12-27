/**
 * 上下文工具 - 共享状态读写
 */
import type { SubagentType, SharedContextEntry } from "../agents/types.js";
import { getSharedContext, type SharedContext } from "../runtime/shared.js";

/**
 * 上下文工具类
 */
export class ContextTool {
  private context: SharedContext;
  private agentType: SubagentType;

  constructor(agentType: SubagentType) {
    this.context = getSharedContext();
    this.agentType = agentType;
  }

  /**
   * 读取值
   */
  read<T = unknown>(key: string): T | undefined {
    return this.context.get<T>(key);
  }

  /**
   * 读取值（带默认值）
   */
  readOrDefault<T>(key: string, defaultValue: T): T {
    const value = this.context.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * 写入值
   */
  write(key: string, value: unknown): void {
    this.context.set(key, value, this.agentType);
  }

  /**
   * 删除值
   */
  delete(key: string): boolean {
    return this.context.delete(key);
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    return this.context.has(key);
  }

  /**
   * 获取完整条目（含元数据）
   */
  getEntry(key: string): SharedContextEntry | undefined {
    return this.context.getEntry(key);
  }

  /**
   * 获取快照
   */
  getSnapshot(): Record<string, unknown> {
    return this.context.getSnapshot();
  }

  /**
   * 合并对象
   */
  merge(key: string, partial: Record<string, unknown>): void {
    this.context.merge(key, partial, this.agentType);
  }

  /**
   * 追加到数组
   */
  append(key: string, item: unknown): void {
    this.context.append(key, item, this.agentType);
  }

  /**
   * 批量更新
   */
  batchUpdate(updates: Record<string, unknown>): void {
    this.context.batchUpdate(updates, this.agentType);
  }

  /**
   * 订阅变更
   */
  subscribe(key: string, handler: (key: string, newValue: unknown, oldValue: unknown) => void): () => void {
    return this.context.subscribe(key, handler);
  }

  /**
   * 订阅所有变更
   */
  subscribeAll(handler: (key: string, newValue: unknown, oldValue: unknown) => void): () => void {
    return this.context.subscribeAll(handler);
  }

  /**
   * 获取本 Agent 设置的所有值
   */
  getMyEntries(): SharedContextEntry[] {
    return this.context.getByAgent(this.agentType);
  }

  /**
   * 获取特定 Agent 设置的值
   */
  getEntriesByAgent(agent: SubagentType): SharedContextEntry[] {
    return this.context.getByAgent(agent);
  }

  /**
   * 创建命名空间键
   */
  namespaced(key: string): string {
    return `${this.agentType}:${key}`;
  }

  /**
   * 读取命名空间值
   */
  readNamespaced<T = unknown>(key: string): T | undefined {
    return this.read<T>(this.namespaced(key));
  }

  /**
   * 写入命名空间值
   */
  writeNamespaced(key: string, value: unknown): void {
    this.write(this.namespaced(key), value);
  }
}

/**
 * 创建上下文工具实例
 */
export function createContextTool(agentType: SubagentType): ContextTool {
  return new ContextTool(agentType);
}

/**
 * 快捷函数：读取共享值
 */
export function readShared<T = unknown>(key: string): T | undefined {
  return getSharedContext().get<T>(key);
}

/**
 * 快捷函数：写入共享值
 */
export function writeShared(key: string, value: unknown, setBy: SubagentType | "system" = "system"): void {
  getSharedContext().set(key, value, setBy);
}

/**
 * 快捷函数：获取任务历史
 */
export function getTaskHistory(): Array<{
  taskId: string;
  agent: SubagentType;
  task: string;
  timestamp: number;
}> {
  const history = getSharedContext().get<unknown[]>("dispatch:history");
  return (history || []) as Array<{
    taskId: string;
    agent: SubagentType;
    task: string;
    timestamp: number;
  }>;
}
