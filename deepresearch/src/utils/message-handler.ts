/**
 * Message Handler
 *
 * 处理消息流，检测子智能体派发
 */

import type { SDKMessage, SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";

export interface SubagentDispatch {
  type: "dispatch";
  targetAgent: string;
  task: string;
  context?: Record<string, unknown>;
}

export interface MessageEvent {
  type: "text" | "tool_use" | "tool_result" | "subagent_dispatch";
  content: string | SubagentDispatch;
  timestamp: string;
}

export class MessageHandler {
  private eventListeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  /**
   * 注册事件监听器
   */
  on(eventType: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(listener);
    this.eventListeners.set(eventType, listeners);
  }

  /**
   * 触发事件
   */
  private emit(eventType: string, event: MessageEvent): void {
    const listeners = this.eventListeners.get(eventType) || [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * 处理 SDK 消息
   */
  processMessage(msg: SDKMessage): MessageEvent[] {
    const events: MessageEvent[] = [];
    const timestamp = new Date().toISOString();

    switch (msg.type) {
      case "assistant":
        events.push(...this.processAssistantMessage(msg, timestamp));
        break;

      case "tool_progress":
        events.push({
          type: "tool_use",
          content: `[${msg.tool_name}] Running... (${msg.elapsed_time_seconds}s)`,
          timestamp,
        });
        break;

      case "result":
        events.push({
          type: "tool_result",
          content: msg.subtype === "success" ? "Completed" : `Error: ${msg.subtype}`,
          timestamp,
        });
        break;
    }

    // 触发事件
    for (const event of events) {
      this.emit(event.type, event);
      this.emit("*", event);
    }

    return events;
  }

  /**
   * 处理助手消息
   */
  private processAssistantMessage(msg: SDKAssistantMessage, timestamp: string): MessageEvent[] {
    const events: MessageEvent[] = [];
    const content = msg.message.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "text") {
          // 检测子智能体派发指令
          const dispatch = this.detectSubagentDispatch(block.text);
          if (dispatch) {
            events.push({
              type: "subagent_dispatch",
              content: dispatch,
              timestamp,
            });
          } else {
            events.push({
              type: "text",
              content: block.text,
              timestamp,
            });
          }
        } else if (block.type === "tool_use") {
          events.push({
            type: "tool_use",
            content: `[${block.name}] ${JSON.stringify(block.input).slice(0, 100)}...`,
            timestamp,
          });
        }
      }
    }

    return events;
  }

  /**
   * 检测子智能体派发指令
   *
   * 格式: [DISPATCH:AgentName] Task description
   */
  private detectSubagentDispatch(text: string): SubagentDispatch | null {
    const dispatchPattern = /\[DISPATCH:(\w+)\]\s*(.+)/;
    const match = text.match(dispatchPattern);

    if (match) {
      return {
        type: "dispatch",
        targetAgent: match[1],
        task: match[2].trim(),
      };
    }

    return null;
  }

  /**
   * 格式化消息用于显示
   */
  formatForDisplay(events: MessageEvent[]): string {
    return events
      .map(event => {
        switch (event.type) {
          case "text":
            return event.content as string;
          case "tool_use":
            return `  → ${event.content}`;
          case "subagent_dispatch":
            const dispatch = event.content as SubagentDispatch;
            return `  ⤷ Dispatching to ${dispatch.targetAgent}: ${dispatch.task}`;
          default:
            return "";
        }
      })
      .filter(Boolean)
      .join("\n");
  }
}

// 单例导出
export const messageHandler = new MessageHandler();
