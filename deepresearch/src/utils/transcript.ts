/**
 * Transcript
 *
 * 会话日志记录
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface TranscriptEntry {
  timestamp: string;
  role: "user" | "assistant" | "system" | "tool";
  agent?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class Transcript {
  private entries: TranscriptEntry[] = [];
  private sessionId: string;
  private logDir: string;

  constructor(sessionId?: string, logDir: string = "./data/logs") {
    this.sessionId = sessionId || this.generateSessionId();
    this.logDir = logDir;
    this.ensureLogDir();
  }

  private generateSessionId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `session_${timestamp}`;
  }

  private ensureLogDir(): void {
    const sessionDir = path.join(this.logDir, this.sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  /**
   * 添加条目
   */
  add(entry: Omit<TranscriptEntry, "timestamp">): void {
    const fullEntry: TranscriptEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(fullEntry);
  }

  /**
   * 添加用户消息
   */
  addUser(content: string): void {
    this.add({ role: "user", content });
  }

  /**
   * 添加助手消息
   */
  addAssistant(content: string, agent?: string): void {
    this.add({ role: "assistant", content, agent });
  }

  /**
   * 添加系统消息
   */
  addSystem(content: string): void {
    this.add({ role: "system", content });
  }

  /**
   * 添加工具调用
   */
  addTool(toolName: string, input: unknown, output?: unknown): void {
    this.add({
      role: "tool",
      content: toolName,
      metadata: { input, output },
    });
  }

  /**
   * 获取所有条目
   */
  getEntries(): TranscriptEntry[] {
    return [...this.entries];
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 保存为人类可读的文本
   */
  saveAsText(): string {
    const filepath = path.join(this.logDir, this.sessionId, "transcript.txt");
    const content = this.formatAsText();
    fs.writeFileSync(filepath, content);
    return filepath;
  }

  /**
   * 保存为 JSON
   */
  saveAsJson(): string {
    const filepath = path.join(this.logDir, this.sessionId, "transcript.json");
    fs.writeFileSync(filepath, JSON.stringify(this.entries, null, 2));
    return filepath;
  }

  /**
   * 格式化为人类可读的文本
   */
  formatAsText(): string {
    const lines: string[] = [
      `Session: ${this.sessionId}`,
      `Started: ${this.entries[0]?.timestamp || "N/A"}`,
      `Entries: ${this.entries.length}`,
      "=".repeat(60),
      "",
    ];

    for (const entry of this.entries) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const roleLabel = this.getRoleLabel(entry);

      lines.push(`[${time}] ${roleLabel}`);
      lines.push(entry.content);
      lines.push("");
    }

    return lines.join("\n");
  }

  private getRoleLabel(entry: TranscriptEntry): string {
    switch (entry.role) {
      case "user":
        return "👤 User";
      case "assistant":
        return entry.agent ? `🤖 ${entry.agent}` : "🤖 Assistant";
      case "system":
        return "⚙️ System";
      case "tool":
        return `🔧 Tool: ${entry.content}`;
      default:
        return entry.role;
    }
  }

  /**
   * 从文件加载
   */
  static load(sessionId: string, logDir: string = "./data/logs"): Transcript | null {
    const filepath = path.join(logDir, sessionId, "transcript.json");
    if (!fs.existsSync(filepath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filepath, "utf-8");
      const entries = JSON.parse(content) as TranscriptEntry[];
      const transcript = new Transcript(sessionId, logDir);
      transcript.entries = entries;
      return transcript;
    } catch {
      return null;
    }
  }

  /**
   * 列出所有会话
   */
  static listSessions(logDir: string = "./data/logs"): string[] {
    if (!fs.existsSync(logDir)) {
      return [];
    }

    return fs
      .readdirSync(logDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith("session_"))
      .map(d => d.name)
      .sort()
      .reverse();
  }
}

// 便捷函数
export function createTranscript(sessionId?: string): Transcript {
  return new Transcript(sessionId);
}
