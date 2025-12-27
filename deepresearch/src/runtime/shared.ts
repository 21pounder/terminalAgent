/**
 * 共享上下文 - 跨 Agent 状态存储
 *
 * 提供线程安全的键值存储，支持变更订阅
 */
import type { SharedContextEntry, SubagentType } from "../agents/types.js";

// 变更监听器
type ChangeListener = (key: string, value: unknown, oldValue: unknown) => void;

/**
 * 共享上下文类
 */
export class SharedContext {
  private store: Map<string, SharedContextEntry>;
  private listeners: Map<string, Set<ChangeListener>>;
  private globalListeners: Set<ChangeListener>;
  private versionCounter: number;

  constructor() {
    this.store = new Map();
    this.listeners = new Map();
    this.globalListeners = new Set();
    this.versionCounter = 0;
  }

  /**
   * 设置值
   */
  set(key: string, value: unknown, setBy: SubagentType | "system" = "system"): void {
    const oldEntry = this.store.get(key);
    const oldValue = oldEntry?.value;

    const entry: SharedContextEntry = {
      key,
      value,
      setBy,
      timestamp: Date.now(),
      version: ++this.versionCounter,
    };

    this.store.set(key, entry);
    this.notifyListeners(key, value, oldValue);
  }

  /**
   * 获取值
   */
  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key)?.value as T | undefined;
  }

  /**
   * 获取完整条目（含元数据）
   */
  getEntry(key: string): SharedContextEntry | undefined {
    return this.store.get(key);
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * 删除键
   */
  delete(key: string): boolean {
    const oldEntry = this.store.get(key);
    if (oldEntry) {
      this.store.delete(key);
      this.notifyListeners(key, undefined, oldEntry.value);
      return true;
    }
    return false;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * 获取所有值
   */
  values(): unknown[] {
    return Array.from(this.store.values()).map(e => e.value);
  }

  /**
   * 获取所有条目
   */
  entries(): SharedContextEntry[] {
    return Array.from(this.store.values());
  }

  /**
   * 获取快照（普通对象）
   */
  getSnapshot(): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    for (const [key, entry] of this.store) {
      snapshot[key] = entry.value;
    }
    return snapshot;
  }

  /**
   * 从快照恢复
   */
  loadSnapshot(snapshot: Record<string, unknown>, setBy: SubagentType | "system" = "system"): void {
    for (const [key, value] of Object.entries(snapshot)) {
      this.set(key, value, setBy);
    }
  }

  /**
   * 订阅特定键的变更
   */
  subscribe(key: string, listener: ChangeListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * 订阅所有变更
   */
  subscribeAll(listener: ChangeListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * 批量更新（原子操作）
   */
  batchUpdate(updates: Record<string, unknown>, setBy: SubagentType | "system" = "system"): void {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key, value, setBy);
    }
  }

  /**
   * 合并对象（深度合并）
   */
  merge(key: string, partial: Record<string, unknown>, setBy: SubagentType | "system" = "system"): void {
    const current = this.get<Record<string, unknown>>(key) || {};
    const merged = { ...current, ...partial };
    this.set(key, merged, setBy);
  }

  /**
   * 追加到数组
   */
  append(key: string, item: unknown, setBy: SubagentType | "system" = "system"): void {
    const current = this.get<unknown[]>(key) || [];
    this.set(key, [...current, item], setBy);
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.store.size;
  }

  /**
   * 清空
   */
  clear(): void {
    const keys = this.keys();
    this.store.clear();
    for (const key of keys) {
      this.notifyListeners(key, undefined, undefined);
    }
  }

  /**
   * 获取特定 Agent 设置的所有值
   */
  getByAgent(agent: SubagentType): SharedContextEntry[] {
    return Array.from(this.store.values()).filter(e => e.setBy === agent);
  }

  /**
   * 通知监听器
   */
  private notifyListeners(key: string, newValue: unknown, oldValue: unknown): void {
    // 通知特定键的监听器
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      for (const listener of keyListeners) {
        try {
          listener(key, newValue, oldValue);
        } catch (error) {
          console.error(`SharedContext listener error for key "${key}":`, error);
        }
      }
    }

    // 通知全局监听器
    for (const listener of this.globalListeners) {
      try {
        listener(key, newValue, oldValue);
      } catch (error) {
        console.error("SharedContext global listener error:", error);
      }
    }
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): string {
    return JSON.stringify(Array.from(this.store.entries()));
  }

  /**
   * 从 JSON 恢复
   */
  fromJSON(json: string): void {
    const entries = JSON.parse(json) as [string, SharedContextEntry][];
    this.store = new Map(entries);
  }
}

// 全局单例
let globalContext: SharedContext | null = null;

/**
 * 获取全局共享上下文
 */
export function getSharedContext(): SharedContext {
  if (!globalContext) {
    globalContext = new SharedContext();
  }
  return globalContext;
}

/**
 * 重置全局共享上下文
 */
export function resetSharedContext(): void {
  if (globalContext) {
    globalContext.clear();
    globalContext = null;
  }
}
