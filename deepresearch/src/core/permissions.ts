/**
 * 权限管理
 */
import type { SubagentType, PermissionMode } from "../agents/types.js";
import { TOOL_WHITELIST, TOOL_BLACKLIST, DANGEROUS_TOOLS } from "../config/tools.js";

// 权限检查结果
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

/**
 * 权限管理器类
 */
export class PermissionManager {
  private mode: PermissionMode;
  private confirmedTools: Set<string>;

  constructor(mode: PermissionMode = "acceptEdits") {
    this.mode = mode;
    this.confirmedTools = new Set();
  }

  /**
   * 检查工具权限
   */
  checkToolPermission(
    agent: SubagentType,
    tool: string
  ): PermissionCheckResult {
    // 检查黑名单
    const blacklist = TOOL_BLACKLIST[agent] || [];
    if (blacklist.includes(tool)) {
      return {
        allowed: false,
        reason: `Tool "${tool}" is blacklisted for ${agent} agent`,
      };
    }

    // 检查白名单
    const whitelist = TOOL_WHITELIST[agent] || [];
    if (whitelist.length > 0 && !whitelist.includes(tool)) {
      return {
        allowed: false,
        reason: `Tool "${tool}" is not in whitelist for ${agent} agent`,
      };
    }

    // 检查危险工具
    if (this.mode === "acceptEdits" && DANGEROUS_TOOLS.includes(tool)) {
      if (!this.confirmedTools.has(tool)) {
        return {
          allowed: true,
          requiresConfirmation: true,
          reason: `Tool "${tool}" requires confirmation`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 确认工具使用
   */
  confirmTool(tool: string): void {
    this.confirmedTools.add(tool);
  }

  /**
   * 撤销工具确认
   */
  revokeToolConfirmation(tool: string): void {
    this.confirmedTools.delete(tool);
  }

  /**
   * 获取 Agent 允许的工具列表
   */
  getAllowedTools(agent: SubagentType): string[] {
    const whitelist = TOOL_WHITELIST[agent] || [];
    const blacklist = TOOL_BLACKLIST[agent] || [];

    if (whitelist.length === 0) {
      // 没有白名单，返回所有非黑名单工具
      return [];
    }

    return whitelist.filter((tool) => !blacklist.includes(tool));
  }

  /**
   * 获取 Agent 禁止的工具列表
   */
  getDisallowedTools(agent: SubagentType): string[] {
    return TOOL_BLACKLIST[agent] || [];
  }

  /**
   * 设置权限模式
   */
  setMode(mode: PermissionMode): void {
    this.mode = mode;
    // 切换到 bypass 模式时清除确认记录
    if (mode === "bypassPermissions") {
      this.confirmedTools.clear();
    }
  }

  /**
   * 获取当前模式
   */
  getMode(): PermissionMode {
    return this.mode;
  }

  /**
   * 重置确认记录
   */
  resetConfirmations(): void {
    this.confirmedTools.clear();
  }

  /**
   * 检查是否为危险工具
   */
  isDangerousTool(tool: string): boolean {
    return DANGEROUS_TOOLS.includes(tool);
  }
}

// 全局单例
let globalPermissionManager: PermissionManager | null = null;

/**
 * 获取全局权限管理器
 */
export function getPermissionManager(): PermissionManager {
  if (!globalPermissionManager) {
    globalPermissionManager = new PermissionManager();
  }
  return globalPermissionManager;
}

/**
 * 重置全局权限管理器
 */
export function resetPermissionManager(): void {
  globalPermissionManager = null;
}
