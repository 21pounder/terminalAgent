/**
 * 消息总线 - Agent 间通信
 *
 * 基于 EventEmitter 实现的发布/订阅模式
 */
import { EventEmitter } from "node:events";
import type { AgentMessage, SubagentType } from "../agents/types.js";
import { generateId } from "../utils/file-utils.js";

// 消息总线事件
type BusEvent =
  | "message"           // 点对点消息
  | "broadcast"         // 广播消息
  | "agent:start"       // Agent 启动
  | "agent:complete"    // Agent 完成
  | "agent:error"       // Agent 错误
  | "task:dispatch"     // 任务派发
  | "task:complete"     // 任务完成
  | "context:update";   // 上下文更新

// 消息处理器
type MessageHandler = (message: AgentMessage) => void | Promise<void>;

/**
 * 消息总线类
 */
export class MessageBus {
  private emitter: EventEmitter;
  private handlers: Map<string, Set<MessageHandler>>;
  private messageHistory: AgentMessage[];
  private maxHistory: number;

  constructor(maxHistory: number = 100) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // 支持多个 Agent 监听
    this.handlers = new Map();
    this.messageHistory = [];
    this.maxHistory = maxHistory;
  }

  /**
   * 发送点对点消息
   */
  send(from: SubagentType | "system", to: SubagentType, content: string, metadata?: Record<string, unknown>): AgentMessage {
    const message: AgentMessage = {
      id: generateId(),
      from,
      to,
      type: "request",
      content,
      timestamp: Date.now(),
      metadata,
    };

    this.recordMessage(message);
    this.emitter.emit("message", message);
    this.emitter.emit(`message:${to}`, message);

    return message;
  }

  /**
   * 广播消息给所有 Agent
   */
  broadcast(from: SubagentType | "system", content: string, metadata?: Record<string, unknown>): AgentMessage {
    const message: AgentMessage = {
      id: generateId(),
      from,
      to: "all",
      type: "broadcast",
      content,
      timestamp: Date.now(),
      metadata,
    };

    this.recordMessage(message);
    this.emitter.emit("broadcast", message);

    return message;
  }

  /**
   * 发送响应消息
   */
  reply(originalMessage: AgentMessage, from: SubagentType, content: string): AgentMessage {
    const message: AgentMessage = {
      id: generateId(),
      from,
      to: originalMessage.from as SubagentType,
      type: "response",
      content,
      timestamp: Date.now(),
      metadata: { replyTo: originalMessage.id },
    };

    this.recordMessage(message);
    this.emitter.emit("message", message);
    this.emitter.emit(`message:${message.to}`, message);

    return message;
  }

  /**
   * 订阅特定 Agent 的消息
   */
  subscribe(agent: SubagentType, handler: MessageHandler): () => void {
    const eventName = `message:${agent}`;

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);

    this.emitter.on(eventName, handler);

    // 返回取消订阅函数
    return () => {
      this.handlers.get(eventName)?.delete(handler);
      this.emitter.off(eventName, handler);
    };
  }

  /**
   * 订阅广播消息
   */
  subscribeBroadcast(handler: MessageHandler): () => void {
    this.emitter.on("broadcast", handler);
    return () => this.emitter.off("broadcast", handler);
  }

  /**
   * 订阅所有消息
   */
  subscribeAll(handler: MessageHandler): () => void {
    this.emitter.on("message", handler);
    return () => this.emitter.off("message", handler);
  }

  /**
   * 发送事件
   */
  emit(event: BusEvent, data: unknown): void {
    this.emitter.emit(event, data);
  }

  /**
   * 监听事件
   */
  on(event: BusEvent, handler: (data: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  /**
   * 等待特定消息
   */
  waitForMessage(predicate: (msg: AgentMessage) => boolean, timeout: number = 30000): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Wait for message timeout"));
      }, timeout);

      const handler = (msg: AgentMessage) => {
        if (predicate(msg)) {
          cleanup();
          resolve(msg);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.emitter.off("message", handler);
        this.emitter.off("broadcast", handler);
      };

      this.emitter.on("message", handler);
      this.emitter.on("broadcast", handler);
    });
  }

  /**
   * 等待特定 Agent 的响应
   */
  waitForReply(messageId: string, timeout: number = 30000): Promise<AgentMessage> {
    return this.waitForMessage(
      (msg) => msg.type === "response" && msg.metadata?.replyTo === messageId,
      timeout
    );
  }

  /**
   * 获取消息历史
   */
  getHistory(filter?: { from?: SubagentType; to?: SubagentType }): AgentMessage[] {
    if (!filter) return [...this.messageHistory];

    return this.messageHistory.filter((msg) => {
      if (filter.from && msg.from !== filter.from) return false;
      if (filter.to && msg.to !== filter.to) return false;
      return true;
    });
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * 记录消息到历史
   */
  private recordMessage(message: AgentMessage): void {
    this.messageHistory.push(message);

    // 限制历史大小
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistory);
    }
  }

  /**
   * 销毁总线
   */
  destroy(): void {
    this.emitter.removeAllListeners();
    this.handlers.clear();
    this.messageHistory = [];
  }
}

// 全局单例
let globalBus: MessageBus | null = null;

/**
 * 获取全局消息总线
 */
export function getMessageBus(): MessageBus {
  if (!globalBus) {
    globalBus = new MessageBus();
  }
  return globalBus;
}

/**
 * 重置全局消息总线
 */
export function resetMessageBus(): void {
  if (globalBus) {
    globalBus.destroy();
    globalBus = null;
  }
}
