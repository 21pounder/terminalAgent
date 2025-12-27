/**
 * 常量定义
 */

// 版本号
export const VERSION = "7.0.0";

// Agent 执行深度限制
export const MAX_SUBAGENT_DEPTH = 3;

// ReAct 最大迭代次数
export const MAX_REACT_ITERATIONS = 10;

// 默认模型
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// Token 预算
export const TOKEN_BUDGET = {
  total: 100000,
  system: 8000,
  history: 60000,
  current: 30000,
  reserved: 2000,
};

// 循环检测配置
export const LOOP_DETECTION = {
  windowSize: 10,
  repeatThreshold: 3,
  similarityThreshold: 0.85,
};

// 上下文压缩配置
export const CONTEXT_COMPRESSION = {
  maxMessages: 20,
  maxToolOutputLength: 2000,
  summaryThreshold: 0.7, // 当使用超过 70% 预算时触发压缩
};

// 内部 Skills（用户不可见）
export const INTERNAL_SKILLS = ["web-scrape", "doc-generate", "deep-research"];

// Agent 超时（毫秒）
export const AGENT_TIMEOUT = 300000; // 5 分钟

// 并行执行最大 Agent 数
export const MAX_PARALLEL_AGENTS = 3;
