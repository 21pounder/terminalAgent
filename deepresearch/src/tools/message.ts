/**
 * Agent 通信工具
 */
import type { SubagentType, AgentMessage } from "../agents/types.js";
import { getMessageBus, type MessageBus } from "../runtime/bus.js";
import { generateId } from "../utils/file-utils.js";

/**
 * 消息工具类
 */
export class MessageTool {
  private bus: MessageBus;
  private agentType: SubagentType;

  constructor(agentType: SubagentType) {
    this.bus = getMessageBus();
    this.agentType = agentType;
  }

  /**
   * 发送消息给指定 Agent
   */
  send(to: SubagentType, content: string, metadata?: Record<string, unknown>): AgentMessage {
    return this.bus.send(this.agentType, to, content, metadata);
  }

  /**
   * 广播消息给所有 Agent
   */
  broadcast(content: string, metadata?: Record<string, unknown>): AgentMessage {
    return this.bus.broadcast(this.agentType, content, metadata);
  }

  /**
   * 回复消息
   */
  reply(originalMessage: AgentMessage, content: string): AgentMessage {
    return this.bus.reply(originalMessage, this.agentType, content);
  }

  /**
   * 等待来自指定 Agent 的消息
   */
  async waitForMessage(from: SubagentType, timeout: number = 30000): Promise<AgentMessage> {
    return this.bus.waitForMessage(
      (msg) => msg.from === from && msg.to === this.agentType,
      timeout
    );
  }

  /**
   * 等待对特定消息的回复
   */
  async waitForReply(messageId: string, timeout: number = 30000): Promise<AgentMessage> {
    return this.bus.waitForReply(messageId, timeout);
  }

  /**
   * 发送请求并等待回复
   */
  async request(
    to: SubagentType,
    content: string,
    timeout: number = 30000
  ): Promise<AgentMessage> {
    const message = this.send(to, content, { expectsReply: true });
    return this.waitForReply(message.id, timeout);
  }

  /**
   * 订阅消息
   */
  subscribe(handler: (message: AgentMessage) => void | Promise<void>): () => void {
    return this.bus.subscribe(this.agentType, handler);
  }

  /**
   * 订阅广播
   */
  subscribeBroadcast(handler: (message: AgentMessage) => void | Promise<void>): () => void {
    return this.bus.subscribeBroadcast(handler);
  }

  /**
   * 获取消息历史
   */
  getHistory(options?: { from?: SubagentType; to?: SubagentType }): AgentMessage[] {
    return this.bus.getHistory(options);
  }

  /**
   * 获取与特定 Agent 的对话历史
   */
  getConversationWith(other: SubagentType): AgentMessage[] {
    const history = this.bus.getHistory();
    return history.filter(
      (msg) =>
        (msg.from === this.agentType && msg.to === other) ||
        (msg.from === other && msg.to === this.agentType)
    );
  }
}

/**
 * 创建消息工具实例
 */
export function createMessageTool(agentType: SubagentType): MessageTool {
  return new MessageTool(agentType);
}

/**
 * 快捷函数：发送消息
 */
export function sendMessage(
  from: SubagentType,
  to: SubagentType,
  content: string
): AgentMessage {
  const bus = getMessageBus();
  return bus.send(from, to, content);
}

/**
 * 快捷函数：广播消息
 */
export function broadcastMessage(
  from: SubagentType,
  content: string
): AgentMessage {
  const bus = getMessageBus();
  return bus.broadcast(from, content);
}
