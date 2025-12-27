/**
 * 执行模式定义
 */
import type { ExecutionMode, SubagentType } from "../agents/types.js";

/**
 * 模式配置
 */
export interface ModeConfig {
  name: string;
  description: string;
  allowedAgents: SubagentType[];
  enableParallel: boolean;
  enableReAct: boolean;
  maxIterations: number;
}

/**
 * 模式配置表
 */
export const MODE_CONFIGS: Record<ExecutionMode, ModeConfig> = {
  single: {
    name: "Single Agent",
    description: "单个 Agent 直接执行任务",
    allowedAgents: ["reader", "coder", "reviewer", "coordinator"],
    enableParallel: false,
    enableReAct: false,
    maxIterations: 1,
  },
  parallel: {
    name: "Parallel Agents",
    description: "多个 Agent 并行执行子任务",
    allowedAgents: ["reader", "coder", "reviewer"],
    enableParallel: true,
    enableReAct: false,
    maxIterations: 1,
  },
  react: {
    name: "ReAct Loop",
    description: "推理-行动循环，适合复杂推理任务",
    allowedAgents: ["coordinator", "coder"],
    enableParallel: false,
    enableReAct: true,
    maxIterations: 10,
  },
  coordinator: {
    name: "Coordinator Mode",
    description: "协调者模式，多 Agent 协作完成复杂任务",
    allowedAgents: ["coordinator", "reader", "coder", "reviewer"],
    enableParallel: true,
    enableReAct: true,
    maxIterations: 5,
  },
};

/**
 * 获取模式配置
 */
export function getModeConfig(mode: ExecutionMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * 检测适合的执行模式
 */
export function detectMode(task: string): ExecutionMode {
  const lowerTask = task.toLowerCase();

  // 复杂任务关键词
  const complexKeywords = [
    "重构", "refactor", "redesign", "重新设计",
    "implement feature", "实现功能", "develop", "开发",
  ];

  // ReAct 任务关键词
  const reactKeywords = [
    "debug", "调试", "investigate", "调查",
    "analyze", "分析", "trace", "追踪",
  ];

  // 并行任务关键词
  const parallelKeywords = [
    " and ", "并且", "同时", "以及",
    "multiple", "多个", "batch", "批量",
  ];

  // 检测复杂任务
  for (const keyword of complexKeywords) {
    if (lowerTask.includes(keyword)) {
      return "coordinator";
    }
  }

  // 检测 ReAct 任务
  for (const keyword of reactKeywords) {
    if (lowerTask.includes(keyword)) {
      return "react";
    }
  }

  // 检测并行任务
  for (const keyword of parallelKeywords) {
    if (lowerTask.includes(keyword)) {
      return "parallel";
    }
  }

  return "single";
}

/**
 * 验证模式是否支持指定 Agent
 */
export function isModeCompatible(mode: ExecutionMode, agent: SubagentType): boolean {
  const config = MODE_CONFIGS[mode];
  return config.allowedAgents.includes(agent);
}

/**
 * 获取模式的最大迭代次数
 */
export function getMaxIterations(mode: ExecutionMode): number {
  return MODE_CONFIGS[mode].maxIterations;
}

/**
 * 获取所有可用模式
 */
export function getAvailableModes(): ExecutionMode[] {
  return Object.keys(MODE_CONFIGS) as ExecutionMode[];
}

/**
 * 模式选择器
 */
export class ModeSelector {
  private defaultMode: ExecutionMode;

  constructor(defaultMode: ExecutionMode = "single") {
    this.defaultMode = defaultMode;
  }

  /**
   * 选择最适合的模式
   */
  select(task: string, hints?: { preferParallel?: boolean; preferReAct?: boolean }): ExecutionMode {
    const detected = detectMode(task);

    // 如果有偏好提示，优先考虑
    if (hints?.preferReAct && detected === "single") {
      return "react";
    }
    if (hints?.preferParallel && detected === "single") {
      return "parallel";
    }

    return detected;
  }

  /**
   * 设置默认模式
   */
  setDefaultMode(mode: ExecutionMode): void {
    this.defaultMode = mode;
  }

  /**
   * 获取默认模式
   */
  getDefaultMode(): ExecutionMode {
    return this.defaultMode;
  }
}

// 全局单例
let globalModeSelector: ModeSelector | null = null;

/**
 * 获取全局模式选择器
 */
export function getModeSelector(): ModeSelector {
  if (!globalModeSelector) {
    globalModeSelector = new ModeSelector();
  }
  return globalModeSelector;
}
