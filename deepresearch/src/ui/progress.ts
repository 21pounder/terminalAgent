/**
 * 进度显示组件
 */
import { theme, fmt, icons, borders, hideCursor, showCursor, clearLine, moveCursor } from "./theme.js";
import type { SubagentType } from "../agents/types.js";
import { AGENT_ICONS, TOOL_ICONS } from "../config/agents.js";

// Agent 状态
type AgentStatus = "idle" | "running" | "completed" | "failed";

// 进度条配置
interface ProgressConfig {
  width: number;
  showPercentage: boolean;
  showEta: boolean;
}

/**
 * Spinner 动画
 */
export class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentFrame = 0;
  private message: string;
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;

  constructor(message: string = "Processing") {
    this.message = message;
  }

  /**
   * 开始动画
   */
  start(): void {
    this.startTime = Date.now();
    hideCursor();

    this.interval = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      clearLine();
      process.stdout.write(
        `\r  ${fmt(frame, theme.tiffany)} ${fmt(this.message, theme.dim)} ${fmt(`${elapsed}s`, theme.dim)}`
      );
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  /**
   * 更新消息
   */
  update(message: string): void {
    this.message = message;
  }

  /**
   * 停止动画
   */
  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    clearLine();
    if (finalMessage) {
      console.log(`\r  ${fmt(icons.check, theme.success)} ${finalMessage}`);
    }
    showCursor();
  }

  /**
   * 失败停止
   */
  fail(message: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    clearLine();
    console.log(`\r  ${fmt(icons.cross, theme.error)} ${message}`);
    showCursor();
  }
}

/**
 * 进度条
 */
export class ProgressBar {
  private current: number = 0;
  private total: number;
  private width: number;
  private showPercentage: boolean;
  private startTime: number = 0;
  private label: string;

  constructor(total: number, label: string = "", config: Partial<ProgressConfig> = {}) {
    this.total = total;
    this.label = label;
    this.width = config.width ?? 30;
    this.showPercentage = config.showPercentage ?? true;
  }

  /**
   * 开始
   */
  start(): void {
    this.startTime = Date.now();
    this.render();
  }

  /**
   * 更新进度
   */
  update(current: number, label?: string): void {
    this.current = Math.min(current, this.total);
    if (label) this.label = label;
    this.render();
  }

  /**
   * 增加进度
   */
  increment(amount: number = 1): void {
    this.update(this.current + amount);
  }

  /**
   * 完成
   */
  complete(message?: string): void {
    this.current = this.total;
    this.render();
    console.log();
    if (message) {
      console.log(`  ${fmt(icons.check, theme.success)} ${message}`);
    }
  }

  /**
   * 渲染进度条
   */
  private render(): void {
    const percent = this.total > 0 ? this.current / this.total : 0;
    const filled = Math.round(this.width * percent);
    const empty = this.width - filled;

    const bar =
      fmt("[", theme.dim) +
      fmt("█".repeat(filled), theme.tiffany) +
      fmt("░".repeat(empty), theme.dim) +
      fmt("]", theme.dim);

    const percentStr = this.showPercentage
      ? fmt(` ${Math.round(percent * 100)}%`, theme.white)
      : "";

    const labelStr = this.label ? fmt(` ${this.label}`, theme.dim) : "";

    clearLine();
    process.stdout.write(`\r  ${bar}${percentStr}${labelStr}`);
  }
}

/**
 * Agent 状态显示
 */
export class AgentStatusDisplay {
  private agents: Map<SubagentType, { status: AgentStatus; task?: string; startTime?: number }>;
  private renderedLines: number = 0;

  constructor() {
    this.agents = new Map();
  }

  /**
   * 设置 Agent 状态
   */
  setStatus(agent: SubagentType, status: AgentStatus, task?: string): void {
    const existing = this.agents.get(agent);
    this.agents.set(agent, {
      status,
      task,
      startTime: status === "running" ? Date.now() : existing?.startTime,
    });
    this.render();
  }

  /**
   * 渲染状态
   */
  render(): void {
    this.clear();

    const lines: string[] = [];
    lines.push(fmt("  ═══ Agent Status ═══", theme.tiffany));

    for (const [agent, info] of this.agents) {
      const icon = AGENT_ICONS[agent] || "🤖";
      let statusIcon: string;
      let statusColor: string;

      switch (info.status) {
        case "running":
          statusIcon = "●";
          statusColor = theme.accent;
          break;
        case "completed":
          statusIcon = icons.check;
          statusColor = theme.success;
          break;
        case "failed":
          statusIcon = icons.cross;
          statusColor = theme.error;
          break;
        default:
          statusIcon = "○";
          statusColor = theme.dim;
      }

      let line = `  ${icon} ${agent.padEnd(12)} ${fmt(statusIcon, statusColor)}`;

      if (info.status === "running" && info.startTime) {
        const elapsed = ((Date.now() - info.startTime) / 1000).toFixed(1);
        line += fmt(` ${elapsed}s`, theme.dim);
      }

      if (info.task) {
        line += fmt(` ${info.task.slice(0, 30)}${info.task.length > 30 ? "..." : ""}`, theme.dim);
      }

      lines.push(line);
    }

    console.log(lines.join("\n"));
    this.renderedLines = lines.length;
  }

  /**
   * 清除渲染
   */
  clear(): void {
    if (this.renderedLines > 0) {
      moveCursor(-this.renderedLines);
      for (let i = 0; i < this.renderedLines; i++) {
        clearLine();
        if (i < this.renderedLines - 1) {
          moveCursor(1);
        }
      }
      moveCursor(-(this.renderedLines - 1));
      this.renderedLines = 0;
    }
  }

  /**
   * 重置
   */
  reset(): void {
    this.clear();
    this.agents.clear();
  }
}

/**
 * 工具调用显示
 */
export function showToolCall(toolName: string, status: "start" | "end" = "start"): void {
  const icon = TOOL_ICONS[toolName] || "⚙️";

  if (status === "start") {
    console.log(fmt(`  ${icon} `, theme.tiffany) + fmt(toolName, theme.accent));
  } else {
    console.log(fmt(`  ${icon} `, theme.tiffany) + fmt(toolName, theme.dim) + fmt(" done", theme.success));
  }
}

/**
 * 创建 Spinner
 */
export function createSpinner(message?: string): Spinner {
  return new Spinner(message);
}

/**
 * 创建进度条
 */
export function createProgressBar(total: number, label?: string): ProgressBar {
  return new ProgressBar(total, label);
}

/**
 * 创建 Agent 状态显示
 */
export function createAgentStatusDisplay(): AgentStatusDisplay {
  return new AgentStatusDisplay();
}
