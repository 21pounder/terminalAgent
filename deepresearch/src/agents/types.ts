/**
 * Agent 类型定义
 */

// 子智能体类型
export type SubagentType = "coordinator" | "reader" | "coder" | "reviewer";

// 执行模式
export type ExecutionMode = "single" | "parallel" | "react" | "coordinator";

// 权限模式
export type PermissionMode = "acceptEdits" | "bypassPermissions";

// Agent 配置
export interface AgentConfig {
  name: string;
  type: SubagentType;
  description: string;
  promptFile: string;
  canDispatch: boolean;
  allowedTools: string[];
  disallowedTools?: string[];
}

// Agent 执行结果
export interface AgentResult {
  agent: SubagentType;
  task: string;
  output: string;
  success: boolean;
  duration_ms: number;
  sessionId?: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
  cost?: number;
}

// 消息类型
export interface AgentMessage {
  id: string;
  from: SubagentType | "user" | "system";
  to: SubagentType | "all";
  type: "request" | "response" | "broadcast" | "event";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// 任务定义
export interface AgentTask {
  id: string;
  agent: SubagentType;
  task: string;
  context?: string;
  priority?: number;
  dependencies?: string[]; // 依赖的任务 ID
  status: "pending" | "running" | "completed" | "failed";
  result?: AgentResult;
}

// ReAct 步骤
export interface ReActStep {
  iteration: number;
  thought: string;
  action: {
    tool: string;
    input: Record<string, unknown>;
  };
  observation: string;
  timestamp: number;
}

// 循环检测结果
export interface LoopDetectionResult {
  detected: boolean;
  type?: "exact" | "pattern" | "semantic";
  confidence: number;
  details?: string;
}

// 上下文压缩结果
export interface CompressionResult {
  original: number;  // 原始 token 数
  compressed: number; // 压缩后 token 数
  ratio: number;      // 压缩比
  method: "sliding" | "summarize" | "truncate";
}

// 共享上下文条目
export interface SharedContextEntry {
  key: string;
  value: unknown;
  setBy: SubagentType | "system";
  timestamp: number;
  version: number;
}

// 会话状态
export interface SessionState {
  id: string;
  startTime: number;
  lastActivity: number;
  mode: ExecutionMode;
  permissionMode: PermissionMode;
  activeAgents: SubagentType[];
  sharedContext: Record<string, SharedContextEntry>;
  history: AgentMessage[];
}
