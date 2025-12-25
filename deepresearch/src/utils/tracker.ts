/**
 * Subagent Tracker
 *
 * 追踪子智能体的工具调用和执行状态
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ToolCall {
  timestamp: string;
  agent: string;
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  duration_ms?: number;
  status: "pending" | "success" | "error";
}

export interface AgentExecution {
  id: string;
  agent: string;
  startTime: string;
  endTime?: string;
  status: "running" | "completed" | "failed";
  toolCalls: ToolCall[];
  result?: unknown;
  error?: string;
}

export class SubagentTracker {
  private executions: Map<string, AgentExecution> = new Map();
  private logDir: string;

  constructor(logDir: string = "./data/logs") {
    this.logDir = logDir;
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 开始追踪一个子智能体的执行
   */
  startExecution(agent: string): string {
    const id = `${agent}-${Date.now()}`;
    const execution: AgentExecution = {
      id,
      agent,
      startTime: new Date().toISOString(),
      status: "running",
      toolCalls: [],
    };
    this.executions.set(id, execution);
    return id;
  }

  /**
   * 记录工具调用
   */
  logToolCall(executionId: string, call: Omit<ToolCall, "timestamp" | "status">): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const toolCall: ToolCall = {
      ...call,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    execution.toolCalls.push(toolCall);
  }

  /**
   * 更新工具调用结果
   */
  updateToolCall(
    executionId: string,
    toolIndex: number,
    result: { output?: unknown; duration_ms?: number; status: "success" | "error" }
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution || !execution.toolCalls[toolIndex]) return;

    Object.assign(execution.toolCalls[toolIndex], result);
  }

  /**
   * 完成执行
   */
  completeExecution(executionId: string, result?: unknown): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.endTime = new Date().toISOString();
    execution.status = "completed";
    execution.result = result;

    this.saveExecution(execution);
  }

  /**
   * 执行失败
   */
  failExecution(executionId: string, error: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.endTime = new Date().toISOString();
    execution.status = "failed";
    execution.error = error;

    this.saveExecution(execution);
  }

  /**
   * 获取执行详情
   */
  getExecution(executionId: string): AgentExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * 获取所有执行
   */
  getAllExecutions(): AgentExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * 保存执行记录到文件
   */
  private saveExecution(execution: AgentExecution): void {
    const filename = `${execution.id}.json`;
    const filepath = path.join(this.logDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(execution, null, 2));
  }

  /**
   * 生成执行摘要
   */
  getSummary(executionId: string): string {
    const execution = this.executions.get(executionId);
    if (!execution) return "Execution not found";

    const duration = execution.endTime
      ? new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()
      : 0;

    const toolStats = execution.toolCalls.reduce((acc, call) => {
      acc[call.tool] = (acc[call.tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      `Agent: ${execution.agent}`,
      `Status: ${execution.status}`,
      `Duration: ${duration}ms`,
      `Tool calls: ${execution.toolCalls.length}`,
      `Tools used: ${Object.entries(toolStats).map(([k, v]) => `${k}(${v})`).join(", ")}`,
    ].join("\n");
  }
}

// 单例导出
export const tracker = new SubagentTracker();
