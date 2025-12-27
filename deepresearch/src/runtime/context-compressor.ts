/**
 * 上下文压缩器 - 避免 token 溢出
 *
 * 策略：
 * 1. 滑动窗口：保留最近 N 条消息
 * 2. 摘要压缩：将旧消息压缩为摘要
 * 3. 工具输出截断：长输出只保留关键部分
 */
import { TOKEN_BUDGET, CONTEXT_COMPRESSION } from "../config/constants.js";
import type { CompressionResult, AgentMessage } from "../agents/types.js";

// Token 预算
export interface TokenBudget {
  total: number;
  system: number;
  history: number;
  current: number;
  reserved: number;
}

// 压缩配置
export interface CompressionConfig {
  strategy: "sliding" | "summarize" | "hybrid";
  maxMessages: number;
  maxToolOutputLength: number;
  summaryThreshold: number;
}

// 消息条目（用于压缩）
export interface MessageEntry {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp?: number;
  toolName?: string;
  important?: boolean;
}

/**
 * 上下文压缩器类
 */
export class ContextCompressor {
  private budget: TokenBudget;
  private config: CompressionConfig;
  private summaryCache: Map<string, string>;

  constructor(
    budget: Partial<TokenBudget> = {},
    config: Partial<CompressionConfig> = {}
  ) {
    this.budget = {
      total: budget.total ?? TOKEN_BUDGET.total,
      system: budget.system ?? TOKEN_BUDGET.system,
      history: budget.history ?? TOKEN_BUDGET.history,
      current: budget.current ?? TOKEN_BUDGET.current,
      reserved: budget.reserved ?? TOKEN_BUDGET.reserved,
    };

    this.config = {
      strategy: config.strategy ?? "hybrid",
      maxMessages: config.maxMessages ?? CONTEXT_COMPRESSION.maxMessages,
      maxToolOutputLength: config.maxToolOutputLength ?? CONTEXT_COMPRESSION.maxToolOutputLength,
      summaryThreshold: config.summaryThreshold ?? CONTEXT_COMPRESSION.summaryThreshold,
    };

    this.summaryCache = new Map();
  }

  /**
   * 估算 token 数（简单估算：4 字符 ≈ 1 token）
   */
  estimateTokens(content: string): number {
    // 对于中文，大约 1.5 字符 = 1 token
    // 对于英文，大约 4 字符 = 1 token
    // 这里使用混合估算
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = content.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 估算消息列表的 token 数
   */
  estimateMessagesTokens(messages: MessageEntry[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
  }

  /**
   * 检查是否需要压缩
   */
  needsCompression(messages: MessageEntry[]): boolean {
    const currentTokens = this.estimateMessagesTokens(messages);
    const threshold = this.budget.history * this.config.summaryThreshold;
    return currentTokens > threshold;
  }

  /**
   * 压缩消息列表
   */
  compress(messages: MessageEntry[]): CompressionResult & { messages: MessageEntry[] } {
    const originalTokens = this.estimateMessagesTokens(messages);

    if (!this.needsCompression(messages)) {
      return {
        original: originalTokens,
        compressed: originalTokens,
        ratio: 1,
        method: "sliding",
        messages,
      };
    }

    let result: MessageEntry[];
    let method: CompressionResult["method"];

    switch (this.config.strategy) {
      case "sliding":
        result = this.slidingWindowCompress(messages);
        method = "sliding";
        break;

      case "summarize":
        result = this.summarizeCompress(messages);
        method = "summarize";
        break;

      case "hybrid":
      default:
        result = this.hybridCompress(messages);
        method = this.estimateMessagesTokens(result) < originalTokens * 0.5
          ? "summarize"
          : "sliding";
        break;
    }

    const compressedTokens = this.estimateMessagesTokens(result);

    return {
      original: originalTokens,
      compressed: compressedTokens,
      ratio: compressedTokens / originalTokens,
      method,
      messages: result,
    };
  }

  /**
   * 滑动窗口压缩：保留最近 N 条消息
   */
  private slidingWindowCompress(messages: MessageEntry[]): MessageEntry[] {
    // 保留重要消息
    const important = messages.filter((m) => m.important);
    const recent = messages.slice(-this.config.maxMessages);

    // 合并，去重
    const result: MessageEntry[] = [];
    const seen = new Set<string>();

    for (const msg of [...important, ...recent]) {
      const key = `${msg.role}:${msg.content.slice(0, 100)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(this.truncateMessage(msg));
      }
    }

    return result;
  }

  /**
   * 摘要压缩：将旧消息压缩为摘要
   */
  private summarizeCompress(messages: MessageEntry[]): MessageEntry[] {
    const recentCount = Math.floor(this.config.maxMessages / 2);
    const recent = messages.slice(-recentCount);
    const old = messages.slice(0, -recentCount);

    if (old.length === 0) {
      return recent.map((m) => this.truncateMessage(m));
    }

    // 生成摘要
    const summary = this.generateSummary(old);

    return [
      {
        role: "assistant",
        content: `[Previous conversation summary]\n${summary}`,
        important: true,
      },
      ...recent.map((m) => this.truncateMessage(m)),
    ];
  }

  /**
   * 混合压缩：结合滑动窗口和摘要
   */
  private hybridCompress(messages: MessageEntry[]): MessageEntry[] {
    // 先截断工具输出
    let compressed = messages.map((m) => this.truncateMessage(m));

    // 检查是否仍需压缩
    if (this.estimateMessagesTokens(compressed) > this.budget.history) {
      // 尝试滑动窗口
      compressed = this.slidingWindowCompress(compressed);

      // 如果还是太大，使用摘要
      if (this.estimateMessagesTokens(compressed) > this.budget.history) {
        compressed = this.summarizeCompress(messages);
      }
    }

    return compressed;
  }

  /**
   * 截断单条消息
   */
  private truncateMessage(msg: MessageEntry): MessageEntry {
    if (msg.role === "tool") {
      return {
        ...msg,
        content: this.truncateToolOutput(msg.content),
      };
    }

    // 对于非工具消息，限制长度
    const maxLength = this.config.maxToolOutputLength * 2;
    if (msg.content.length > maxLength) {
      return {
        ...msg,
        content: msg.content.slice(0, maxLength) + "\n[...truncated...]",
      };
    }

    return msg;
  }

  /**
   * 截断工具输出
   */
  truncateToolOutput(output: string): string {
    if (output.length <= this.config.maxToolOutputLength) {
      return output;
    }

    const halfLength = Math.floor(this.config.maxToolOutputLength / 2);
    const head = output.slice(0, halfLength);
    const tail = output.slice(-halfLength);

    return `${head}\n\n[...${output.length - this.config.maxToolOutputLength} characters truncated...]\n\n${tail}`;
  }

  /**
   * 生成摘要（简单实现，实际可调用小模型）
   */
  private generateSummary(messages: MessageEntry[]): string {
    // 缓存检查
    const cacheKey = messages.map((m) => m.content.slice(0, 50)).join("|");
    if (this.summaryCache.has(cacheKey)) {
      return this.summaryCache.get(cacheKey)!;
    }

    // 简单摘要：提取关键信息
    const userMessages = messages.filter((m) => m.role === "user");
    const toolCalls = messages.filter((m) => m.role === "tool");
    const assistantMessages = messages.filter((m) => m.role === "assistant");

    const summaryParts: string[] = [];

    if (userMessages.length > 0) {
      const topics = userMessages
        .map((m) => m.content.slice(0, 100))
        .join("; ");
      summaryParts.push(`User discussed: ${topics}`);
    }

    if (toolCalls.length > 0) {
      const tools = [...new Set(toolCalls.map((m) => m.toolName || "unknown"))];
      summaryParts.push(`Tools used: ${tools.join(", ")}`);
    }

    if (assistantMessages.length > 0) {
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      summaryParts.push(`Last response: ${lastAssistant.content.slice(0, 200)}...`);
    }

    const summary = summaryParts.join("\n");

    // 缓存
    this.summaryCache.set(cacheKey, summary);

    // 限制缓存大小
    if (this.summaryCache.size > 100) {
      const firstKey = this.summaryCache.keys().next().value;
      if (firstKey) this.summaryCache.delete(firstKey);
    }

    return summary;
  }

  /**
   * 获取当前预算使用情况
   */
  getBudgetUsage(messages: MessageEntry[]): {
    used: number;
    available: number;
    percentage: number;
  } {
    const used = this.estimateMessagesTokens(messages);
    const available = this.budget.history - used;
    const percentage = (used / this.budget.history) * 100;

    return { used, available, percentage };
  }

  /**
   * 更新预算
   */
  updateBudget(budget: Partial<TokenBudget>): void {
    Object.assign(this.budget, budget);
  }

  /**
   * 清空摘要缓存
   */
  clearCache(): void {
    this.summaryCache.clear();
  }

  /**
   * 将 AgentMessage 转换为 MessageEntry
   */
  convertAgentMessages(messages: AgentMessage[]): MessageEntry[] {
    return messages.map((msg) => ({
      role: msg.from === "user" ? "user" : "assistant",
      content: msg.content,
      timestamp: msg.timestamp,
    }));
  }
}
