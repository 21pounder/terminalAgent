/**
 * 会话管理
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { SessionState, ExecutionMode, PermissionMode, SubagentType } from "../agents/types.js";
import { generateId, ensureDir } from "../utils/file-utils.js";
import { getSharedContext } from "../runtime/shared.js";
import { getMessageBus } from "../runtime/bus.js";

// 会话存储目录
const SESSIONS_DIR = "data/sessions";

/**
 * 会话管理器类
 */
export class SessionManager {
  private currentSession: SessionState | null;
  private sessionsDir: string;

  constructor(baseDir: string = ".") {
    this.currentSession = null;
    this.sessionsDir = path.join(baseDir, SESSIONS_DIR);
  }

  /**
   * 创建新会话
   */
  createSession(
    mode: ExecutionMode = "single",
    permissionMode: PermissionMode = "acceptEdits"
  ): SessionState {
    const session: SessionState = {
      id: generateId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      mode,
      permissionMode,
      activeAgents: [],
      sharedContext: {},
      history: [],
    };

    this.currentSession = session;
    this.saveSession();

    return session;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): SessionState | null {
    return this.currentSession;
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string | undefined {
    return this.currentSession?.id;
  }

  /**
   * 恢复会话
   */
  resumeSession(sessionId: string): SessionState | null {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      if (fs.existsSync(sessionPath)) {
        const data = fs.readFileSync(sessionPath, "utf-8");
        const session = JSON.parse(data) as SessionState;
        session.lastActivity = Date.now();
        this.currentSession = session;

        // 恢复共享上下文
        const sharedContext = getSharedContext();
        sharedContext.loadSnapshot(session.sharedContext);

        return session;
      }
    } catch (error) {
      console.error(`Failed to resume session ${sessionId}:`, error);
    }

    return null;
  }

  /**
   * 保存会话
   */
  saveSession(): boolean {
    if (!this.currentSession) return false;

    try {
      ensureDir(this.sessionsDir);

      // 保存共享上下文快照
      const sharedContext = getSharedContext();
      this.currentSession.sharedContext = sharedContext.getSnapshot() as Record<string, any>;
      this.currentSession.lastActivity = Date.now();

      // 保存消息历史
      const bus = getMessageBus();
      this.currentSession.history = bus.getHistory();

      const sessionPath = path.join(this.sessionsDir, `${this.currentSession.id}.json`);
      fs.writeFileSync(sessionPath, JSON.stringify(this.currentSession, null, 2));

      return true;
    } catch (error) {
      console.error("Failed to save session:", error);
      return false;
    }
  }

  /**
   * 更新会话模式
   */
  updateMode(mode: ExecutionMode): void {
    if (this.currentSession) {
      this.currentSession.mode = mode;
      this.currentSession.lastActivity = Date.now();
    }
  }

  /**
   * 更新权限模式
   */
  updatePermissionMode(mode: PermissionMode): void {
    if (this.currentSession) {
      this.currentSession.permissionMode = mode;
      this.currentSession.lastActivity = Date.now();
    }
  }

  /**
   * 添加活动 Agent
   */
  addActiveAgent(agent: SubagentType): void {
    if (this.currentSession && !this.currentSession.activeAgents.includes(agent)) {
      this.currentSession.activeAgents.push(agent);
      this.currentSession.lastActivity = Date.now();
    }
  }

  /**
   * 移除活动 Agent
   */
  removeActiveAgent(agent: SubagentType): void {
    if (this.currentSession) {
      this.currentSession.activeAgents = this.currentSession.activeAgents.filter(
        (a) => a !== agent
      );
      this.currentSession.lastActivity = Date.now();
    }
  }

  /**
   * 清除会话
   */
  clearSession(): void {
    this.currentSession = null;

    // 清除共享上下文
    const sharedContext = getSharedContext();
    sharedContext.clear();

    // 清除消息历史
    const bus = getMessageBus();
    bus.clearHistory();
  }

  /**
   * 列出所有会话
   */
  listSessions(): Array<{ id: string; startTime: number; lastActivity: number }> {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        return [];
      }

      const files = fs.readdirSync(this.sessionsDir);
      const sessions: Array<{ id: string; startTime: number; lastActivity: number }> = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const data = fs.readFileSync(path.join(this.sessionsDir, file), "utf-8");
            const session = JSON.parse(data) as SessionState;
            sessions.push({
              id: session.id,
              startTime: session.startTime,
              lastActivity: session.lastActivity,
            });
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 按最后活动时间排序
      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch {
      return [];
    }
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
        return true;
      }
    } catch {
      // 忽略删除错误
    }

    return false;
  }

  /**
   * 清理过期会话（超过指定天数）
   */
  cleanupOldSessions(maxAgeDays: number = 7): number {
    const sessions = this.listSessions();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deleted = 0;

    for (const session of sessions) {
      if (now - session.lastActivity > maxAge) {
        if (this.deleteSession(session.id)) {
          deleted++;
        }
      }
    }

    return deleted;
  }

  /**
   * 获取会话统计
   */
  getSessionStats(): {
    totalSessions: number;
    currentSessionDuration: number;
    activeAgents: number;
  } {
    const sessions = this.listSessions();
    const currentDuration = this.currentSession
      ? Date.now() - this.currentSession.startTime
      : 0;

    return {
      totalSessions: sessions.length,
      currentSessionDuration: currentDuration,
      activeAgents: this.currentSession?.activeAgents.length || 0,
    };
  }
}

// 全局单例
let globalSessionManager: SessionManager | null = null;

/**
 * 获取全局会话管理器
 */
export function getSessionManager(baseDir?: string): SessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager(baseDir);
  }
  return globalSessionManager;
}

/**
 * 重置全局会话管理器
 */
export function resetSessionManager(): void {
  if (globalSessionManager) {
    globalSessionManager.clearSession();
    globalSessionManager = null;
  }
}
