/**
 * 工具配置
 */
import type { SubagentType } from "../agents/types.js";

// 工具白名单：每个 Agent 允许使用的工具
export const TOOL_WHITELIST: Record<SubagentType, string[]> = {
  coordinator: [
    "Read", "Glob", "Grep", "Task", "WebSearch", "WebFetch", "Bash", "Skill",
    "send_message", "broadcast", "dispatch_to_agent", "read_shared", "write_shared",
  ],
  reader: [
    "Read", "Glob", "Grep", "LSP", "Bash", "Skill",
    "send_message", "read_shared", "write_shared",
  ],
  coder: [
    "Read", "Write", "Edit", "Bash", "Glob", "Grep", "LSP", "NotebookEdit", "WebFetch", "Skill",
    "send_message", "read_shared", "write_shared",
  ],
  reviewer: [
    "Read", "Glob", "Grep", "Bash", "LSP", "Skill",
    "send_message", "read_shared", "write_shared",
  ],
};

// 工具黑名单：每个 Agent 禁止使用的工具
export const TOOL_BLACKLIST: Record<SubagentType, string[]> = {
  coordinator: ["Write", "Edit", "NotebookEdit"], // 协调者不直接写代码
  reader: ["Write", "Edit", "Bash", "NotebookEdit"], // 阅读者只读
  coder: ["Task"], // 编码者不调度其他 Agent
  reviewer: ["Write", "Edit", "NotebookEdit"], // 审查者不修改代码
};

// 危险工具：需要额外确认
export const DANGEROUS_TOOLS = [
  "Bash",
  "Write",
  "Edit",
];

// MCP 服务器配置
export const MCP_SERVERS = {
  playwright: {
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
  },
};

// 自定义 MCP 工具定义
export const CUSTOM_MCP_TOOLS = {
  send_message: {
    name: "send_message",
    description: "Send a message to another agent",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Target agent type" },
        content: { type: "string", description: "Message content" },
      },
      required: ["to", "content"],
    },
  },
  broadcast: {
    name: "broadcast",
    description: "Broadcast a message to all agents",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Message content" },
      },
      required: ["content"],
    },
  },
  dispatch_to_agent: {
    name: "dispatch_to_agent",
    description: "Dispatch a task to a specialized agent",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent: { type: "string", enum: ["reader", "coder", "reviewer"], description: "Target agent" },
        task: { type: "string", description: "Task description" },
        context: { type: "string", description: "Additional context" },
      },
      required: ["agent", "task"],
    },
  },
  read_shared: {
    name: "read_shared",
    description: "Read a value from shared context",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Key to read" },
      },
      required: ["key"],
    },
  },
  write_shared: {
    name: "write_shared",
    description: "Write a value to shared context",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Key to write" },
        value: { type: "string", description: "Value to store" },
      },
      required: ["key", "value"],
    },
  },
};
