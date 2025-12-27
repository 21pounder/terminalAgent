/**
 * Agents 模块统一导出
 */

// 类型
export * from "./types.js";

// 基类
export { BaseAgent, type AgentCallbacks } from "./base.js";

// 具体 Agent
export { CoordinatorAgent, createCoordinatorAgent, type DispatchCommand } from "./coordinator.js";
export { ReaderAgent, createReaderAgent } from "./reader.js";
export { CoderAgent, createCoderAgent } from "./coder.js";
export { ReviewerAgent, createReviewerAgent, type ReviewResult, type ReviewIssue } from "./reviewer.js";

// Agent 注册表
import type { SubagentType, PermissionMode } from "./types.js";
import { BaseAgent } from "./base.js";
import { CoordinatorAgent, createCoordinatorAgent } from "./coordinator.js";
import { ReaderAgent, createReaderAgent } from "./reader.js";
import { CoderAgent, createCoderAgent } from "./coder.js";
import { ReviewerAgent, createReviewerAgent } from "./reviewer.js";

// Agent 工厂映射
const AGENT_FACTORIES: Record<SubagentType, () => BaseAgent> = {
  coordinator: createCoordinatorAgent,
  reader: createReaderAgent,
  coder: createCoderAgent,
  reviewer: createReviewerAgent,
};

/**
 * Agent 注册表
 */
export class AgentRegistry {
  private agents: Map<SubagentType, BaseAgent>;
  private agentRoot: string = "";
  private userCwd: string = "";
  private permissionMode: PermissionMode = "acceptEdits";

  constructor() {
    this.agents = new Map();
  }

  /**
   * 设置环境（所有 Agent 共享）
   */
  setEnvironment(agentRoot: string, userCwd: string, permissionMode?: PermissionMode): void {
    this.agentRoot = agentRoot;
    this.userCwd = userCwd;
    if (permissionMode) {
      this.permissionMode = permissionMode;
    }
    // 更新所有已实例化的 Agent
    for (const agent of this.agents.values()) {
      agent.setEnvironment(agentRoot, userCwd, permissionMode);
    }
  }

  /**
   * 获取 Agent 实例（懒加载）
   */
  get(agentType: SubagentType): BaseAgent {
    if (!this.agents.has(agentType)) {
      const factory = AGENT_FACTORIES[agentType];
      if (!factory) {
        throw new Error(`Unknown agent type: ${agentType}`);
      }
      const agent = factory();
      // 设置环境
      if (this.agentRoot && this.userCwd) {
        agent.setEnvironment(this.agentRoot, this.userCwd, this.permissionMode);
      }
      this.agents.set(agentType, agent);
    }
    return this.agents.get(agentType)!;
  }

  /**
   * 获取 Coordinator
   */
  getCoordinator(): CoordinatorAgent {
    return this.get("coordinator") as CoordinatorAgent;
  }

  /**
   * 获取 Reader
   */
  getReader(): ReaderAgent {
    return this.get("reader") as ReaderAgent;
  }

  /**
   * 获取 Coder
   */
  getCoder(): CoderAgent {
    return this.get("coder") as CoderAgent;
  }

  /**
   * 获取 Reviewer
   */
  getReviewer(): ReviewerAgent {
    return this.get("reviewer") as ReviewerAgent;
  }

  /**
   * 获取所有已实例化的 Agent
   */
  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有 Agent 类型
   */
  getTypes(): SubagentType[] {
    return Object.keys(AGENT_FACTORIES) as SubagentType[];
  }

  /**
   * 检查 Agent 是否已实例化
   */
  has(agentType: SubagentType): boolean {
    return this.agents.has(agentType);
  }

  /**
   * 清除所有 Agent
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * 重新创建 Agent
   */
  recreate(agentType: SubagentType): BaseAgent {
    const factory = AGENT_FACTORIES[agentType];
    if (!factory) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }
    const agent = factory();
    // 设置环境
    if (this.agentRoot && this.userCwd) {
      agent.setEnvironment(this.agentRoot, this.userCwd, this.permissionMode);
    }
    this.agents.set(agentType, agent);
    return agent;
  }
}

// 全局单例
let globalRegistry: AgentRegistry | null = null;

/**
 * 获取全局 Agent 注册表
 */
export function getAgentRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}

/**
 * 重置全局 Agent 注册表
 */
export function resetAgentRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
    globalRegistry = null;
  }
}

/**
 * 快捷函数：获取 Agent
 */
export function getAgent(agentType: SubagentType): BaseAgent {
  return getAgentRegistry().get(agentType);
}
