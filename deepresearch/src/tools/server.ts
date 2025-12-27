/**
 * MCP 服务器创建
 *
 * 注意：此模块提供自定义 MCP 工具的实现
 * 目前通过 executeCustomTool 手动执行，而非 MCP 服务器
 */
import { getMessageBus } from "../runtime/bus.js";
import { getSharedContext } from "../runtime/shared.js";
import type { SubagentType } from "../agents/types.js";

/**
 * 自定义工具定义
 */
export const CUSTOM_TOOLS = {
  send_message: {
    name: "send_message",
    description: "Send a message to a specific agent",
  },
  broadcast: {
    name: "broadcast",
    description: "Broadcast a message to all agents",
  },
  read_shared: {
    name: "read_shared",
    description: "Read a value from shared context",
  },
  write_shared: {
    name: "write_shared",
    description: "Write a value to shared context",
  },
  get_context_snapshot: {
    name: "get_context_snapshot",
    description: "Get a snapshot of all shared context",
  },
  get_message_history: {
    name: "get_message_history",
    description: "Get message history between agents",
  },
};

/**
 * 工具处理结果类型
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * 手动执行工具
 */
export async function executeCustomTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const bus = getMessageBus();
  const sharedContext = getSharedContext();

  try {
    switch (toolName) {
      case "send_message": {
        const to = input.to as SubagentType;
        const content = input.content as string;
        const message = bus.send("system", to, content);
        return { success: true, data: { messageId: message.id } };
      }

      case "broadcast": {
        const content = input.content as string;
        const message = bus.broadcast("system", content);
        return { success: true, data: { messageId: message.id } };
      }

      case "read_shared": {
        const key = input.key as string;
        const value = sharedContext.get(key);
        return { success: true, data: { key, value, exists: value !== undefined } };
      }

      case "write_shared": {
        const key = input.key as string;
        const value = input.value;
        sharedContext.set(key, value, "system");
        return { success: true, data: { key } };
      }

      case "get_context_snapshot": {
        return { success: true, data: sharedContext.getSnapshot() };
      }

      case "get_message_history": {
        const limit = (input.limit as number) || 10;
        const history = bus.getHistory();
        return { success: true, data: history.slice(-limit) };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
