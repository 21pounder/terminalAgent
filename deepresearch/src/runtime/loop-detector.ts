/**
 * 循环检测器 - 检测 Agent 是否陷入循环
 *
 * 循环类型：
 * 1. 完全重复：相同 action 连续出现
 * 2. 模式循环：A→B→A→B 交替出现
 * 3. 语义循环：不同表述但相同意图
 */
import { simpleHash } from "../utils/file-utils.js";
import { LOOP_DETECTION } from "../config/constants.js";
import type { LoopDetectionResult } from "../agents/types.js";

// 行动指纹
export interface ActionFingerprint {
  tool: string;
  argsHash: string;
  outputHash: string;
  timestamp: number;
}

// 循环打破策略
export type BreakStrategy =
  | { type: "inject_hint"; hint: string }
  | { type: "force_different_tool"; exclude: string[] }
  | { type: "escalate_to_user"; reason: string }
  | { type: "abort"; reason: string }
  | { type: "continue" };

// 检测配置
export interface LoopDetectorConfig {
  windowSize: number;
  repeatThreshold: number;
  similarityThreshold: number;
}

/**
 * 循环检测器类
 */
export class LoopDetector {
  private history: ActionFingerprint[];
  private config: LoopDetectorConfig;
  private loopCount: number;

  constructor(config: Partial<LoopDetectorConfig> = {}) {
    this.history = [];
    this.config = {
      windowSize: config.windowSize ?? LOOP_DETECTION.windowSize,
      repeatThreshold: config.repeatThreshold ?? LOOP_DETECTION.repeatThreshold,
      similarityThreshold: config.similarityThreshold ?? LOOP_DETECTION.similarityThreshold,
    };
    this.loopCount = 0;
  }

  /**
   * 记录行动
   */
  record(tool: string, args: unknown, output: string): ActionFingerprint {
    const fingerprint: ActionFingerprint = {
      tool,
      argsHash: simpleHash(JSON.stringify(args)),
      outputHash: simpleHash(output),
      timestamp: Date.now(),
    };

    this.history.push(fingerprint);

    // 限制历史大小
    if (this.history.length > this.config.windowSize * 2) {
      this.history = this.history.slice(-this.config.windowSize * 2);
    }

    return fingerprint;
  }

  /**
   * 检测是否存在循环
   */
  detect(): LoopDetectionResult {
    if (this.history.length < this.config.repeatThreshold) {
      return { detected: false, confidence: 0 };
    }

    // 检测完全重复
    const exactRepeat = this.detectExactRepeat();
    if (exactRepeat.detected) {
      this.loopCount++;
      return exactRepeat;
    }

    // 检测模式循环
    const patternLoop = this.detectPatternLoop();
    if (patternLoop.detected) {
      this.loopCount++;
      return patternLoop;
    }

    // 检测语义循环（相同工具但不同参数）
    const semanticLoop = this.detectSemanticLoop();
    if (semanticLoop.detected) {
      this.loopCount++;
      return semanticLoop;
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 检测完全重复：相同的工具+参数连续出现
   */
  private detectExactRepeat(): LoopDetectionResult {
    const recent = this.history.slice(-this.config.windowSize);
    if (recent.length < this.config.repeatThreshold) {
      return { detected: false, confidence: 0 };
    }

    // 检查最近 N 个是否完全相同
    const last = recent[recent.length - 1];
    let repeatCount = 0;

    for (let i = recent.length - 2; i >= 0; i--) {
      const fp = recent[i];
      if (fp.tool === last.tool && fp.argsHash === last.argsHash) {
        repeatCount++;
      } else {
        break;
      }
    }

    if (repeatCount >= this.config.repeatThreshold - 1) {
      return {
        detected: true,
        type: "exact",
        confidence: Math.min(1, repeatCount / this.config.repeatThreshold),
        details: `Tool "${last.tool}" repeated ${repeatCount + 1} times with same arguments`,
      };
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 检测模式循环：A→B→A→B 交替出现
   */
  private detectPatternLoop(): LoopDetectionResult {
    const recent = this.history.slice(-this.config.windowSize);
    if (recent.length < 4) {
      return { detected: false, confidence: 0 };
    }

    // 检查长度为 2 和 3 的模式
    for (const patternLen of [2, 3]) {
      if (recent.length < patternLen * 2) continue;

      const pattern = recent.slice(-patternLen);
      let matches = 0;

      for (let i = recent.length - patternLen - 1; i >= 0; i -= patternLen) {
        const segment = recent.slice(i, i + patternLen);
        if (segment.length !== patternLen) break;

        const isMatch = segment.every((fp, j) =>
          fp.tool === pattern[j].tool && fp.argsHash === pattern[j].argsHash
        );

        if (isMatch) {
          matches++;
        } else {
          break;
        }
      }

      if (matches >= this.config.repeatThreshold - 1) {
        const patternStr = pattern.map((fp) => fp.tool).join("→");
        return {
          detected: true,
          type: "pattern",
          confidence: Math.min(1, matches / this.config.repeatThreshold),
          details: `Pattern "${patternStr}" repeated ${matches + 1} times`,
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 检测语义循环：相同工具但不同参数，输出相似
   */
  private detectSemanticLoop(): LoopDetectionResult {
    const recent = this.history.slice(-this.config.windowSize);
    if (recent.length < this.config.repeatThreshold) {
      return { detected: false, confidence: 0 };
    }

    // 按工具分组
    const toolGroups = new Map<string, ActionFingerprint[]>();
    for (const fp of recent) {
      const group = toolGroups.get(fp.tool) || [];
      group.push(fp);
      toolGroups.set(fp.tool, group);
    }

    // 检查是否有工具被过度使用
    for (const [tool, group] of toolGroups) {
      if (group.length >= this.config.repeatThreshold) {
        // 检查输出是否相似（相同的 outputHash）
        const outputHashes = group.map((fp) => fp.outputHash);
        const uniqueOutputs = new Set(outputHashes).size;
        const similarity = 1 - uniqueOutputs / group.length;

        if (similarity >= this.config.similarityThreshold) {
          return {
            detected: true,
            type: "semantic",
            confidence: similarity,
            details: `Tool "${tool}" called ${group.length} times with similar outputs (${Math.round(similarity * 100)}% similarity)`,
          };
        }
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 获取循环打破策略
   */
  breakLoop(result: LoopDetectionResult): BreakStrategy {
    if (!result.detected) {
      return { type: "continue" };
    }

    // 根据循环次数和类型决定策略
    if (this.loopCount >= 3) {
      return {
        type: "escalate_to_user",
        reason: `Detected ${result.type} loop: ${result.details}. Multiple break attempts failed.`,
      };
    }

    if (this.loopCount >= 2) {
      return {
        type: "abort",
        reason: `Persistent ${result.type} loop: ${result.details}`,
      };
    }

    switch (result.type) {
      case "exact":
        return {
          type: "inject_hint",
          hint: `You seem to be repeating the same action. ${result.details}. Try a different approach or tool.`,
        };

      case "pattern":
        const tools = this.history.slice(-3).map((fp) => fp.tool);
        return {
          type: "force_different_tool",
          exclude: tools,
        };

      case "semantic":
        return {
          type: "inject_hint",
          hint: `The current approach isn't making progress. ${result.details}. Consider a fundamentally different strategy.`,
        };

      default:
        return { type: "continue" };
    }
  }

  /**
   * 重置检测器
   */
  reset(): void {
    this.history = [];
    this.loopCount = 0;
  }

  /**
   * 获取历史
   */
  getHistory(): ActionFingerprint[] {
    return [...this.history];
  }

  /**
   * 获取循环计数
   */
  getLoopCount(): number {
    return this.loopCount;
  }

  /**
   * 获取最近的工具调用
   */
  getRecentTools(n: number = 5): string[] {
    return this.history.slice(-n).map((fp) => fp.tool);
  }
}
