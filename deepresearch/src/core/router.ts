/**
 * 智能路由 - 任务分发
 */
import type { SubagentType } from "../agents/types.js";
import { AGENT_KEYWORDS, SKILL_AGENT_MAP } from "../config/agents.js";

/**
 * 路由决策结果
 */
export interface RouteDecision {
  agent: SubagentType;
  confidence: number;
  reason: string;
}

/**
 * 智能路由器类
 */
export class Router {
  /**
   * 简单路由方法 - 返回最适合的 Agent 类型
   */
  route(prompt: string): SubagentType {
    return this.detectTaskType(prompt).agent;
  }

  /**
   * 检测任务类型，返回最适合的 Agent
   */
  detectTaskType(prompt: string): RouteDecision {
    const lowerPrompt = prompt.toLowerCase();

    // 1. 优先检查 Skill 命令
    const skillDecision = this.checkSkillCommand(lowerPrompt);
    if (skillDecision) {
      return skillDecision;
    }

    // 2. 关键词匹配
    const keywordDecision = this.matchKeywords(lowerPrompt);
    if (keywordDecision.confidence > 0.5) {
      return keywordDecision;
    }

    // 3. 默认使用 Coordinator
    return {
      agent: "coordinator",
      confidence: 0.3,
      reason: "Default: No specific pattern matched",
    };
  }

  /**
   * 检查 Skill 命令
   */
  private checkSkillCommand(prompt: string): RouteDecision | null {
    for (const [skill, agent] of Object.entries(SKILL_AGENT_MAP)) {
      if (
        prompt.includes(`use the "${skill}" skill`) ||
        prompt.includes(`/${skill}`)
      ) {
        return {
          agent,
          confidence: 1.0,
          reason: `Skill command: ${skill}`,
        };
      }
    }
    return null;
  }

  /**
   * 关键词匹配
   */
  private matchKeywords(prompt: string): RouteDecision {
    const scores: Record<SubagentType, number> = {
      coordinator: 0,
      reader: 0,
      coder: 0,
      reviewer: 0,
    };

    // 使用词边界匹配
    const matchWord = (text: string, word: string): boolean => {
      const regex = new RegExp(`\\b${word}\\b`, "i");
      return regex.test(text);
    };

    // 计算每个 Agent 的匹配分数
    for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (matchWord(prompt, keyword)) {
          scores[agent as SubagentType] += 1;
        }
      }
    }

    // 找到最高分的 Agent
    let bestAgent: SubagentType = "coordinator";
    let bestScore = 0;

    for (const [agent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent as SubagentType;
      }
    }

    // 计算置信度
    const totalKeywords = Object.values(AGENT_KEYWORDS).flat().length;
    const confidence = bestScore > 0 ? Math.min(bestScore / 3, 1.0) : 0;

    return {
      agent: bestAgent,
      confidence,
      reason: bestScore > 0
        ? `Keyword match: ${bestScore} keywords for ${bestAgent}`
        : "No keyword matches",
    };
  }

  /**
   * Skill 名称到 Agent 的映射
   */
  skillToAgent(skillName: string): SubagentType {
    return SKILL_AGENT_MAP[skillName] || "coordinator";
  }

  /**
   * 根据任务特征推荐执行模式
   */
  recommendMode(prompt: string): "single" | "parallel" | "react" | "coordinator" {
    const lowerPrompt = prompt.toLowerCase();

    // 复杂任务
    if (
      lowerPrompt.includes("重构") ||
      lowerPrompt.includes("refactor") ||
      lowerPrompt.includes("重新设计") ||
      lowerPrompt.includes("redesign")
    ) {
      return "coordinator";
    }

    // 调试任务
    if (
      lowerPrompt.includes("debug") ||
      lowerPrompt.includes("调试") ||
      lowerPrompt.includes("investigate") ||
      lowerPrompt.includes("追踪")
    ) {
      return "react";
    }

    // 并行任务
    if (
      lowerPrompt.includes(" and ") ||
      lowerPrompt.includes("并且") ||
      lowerPrompt.includes("同时") ||
      lowerPrompt.includes("以及")
    ) {
      return "parallel";
    }

    return "single";
  }

  /**
   * 分析任务复杂度
   */
  analyzeComplexity(prompt: string): {
    level: "simple" | "medium" | "complex";
    suggestedAgents: SubagentType[];
  } {
    const lowerPrompt = prompt.toLowerCase();

    // 复杂度指标
    const complexityIndicators = [
      "重构", "refactor", "redesign", "重新设计",
      "implement", "实现", "develop", "开发",
      "全面", "comprehensive", "complete", "完整",
    ];

    const mediumIndicators = [
      "add", "添加", "modify", "修改",
      "fix", "修复", "update", "更新",
    ];

    let complexityScore = 0;
    for (const indicator of complexityIndicators) {
      if (lowerPrompt.includes(indicator)) {
        complexityScore += 2;
      }
    }
    for (const indicator of mediumIndicators) {
      if (lowerPrompt.includes(indicator)) {
        complexityScore += 1;
      }
    }

    // 根据分数确定复杂度
    let level: "simple" | "medium" | "complex";
    let suggestedAgents: SubagentType[];

    if (complexityScore >= 4) {
      level = "complex";
      suggestedAgents = ["coordinator", "reader", "coder", "reviewer"];
    } else if (complexityScore >= 2) {
      level = "medium";
      suggestedAgents = ["reader", "coder"];
    } else {
      level = "simple";
      const decision = this.detectTaskType(prompt);
      suggestedAgents = [decision.agent];
    }

    return { level, suggestedAgents };
  }
}

// 全局单例
let globalRouter: Router | null = null;

/**
 * 获取全局路由器
 */
export function getRouter(): Router {
  if (!globalRouter) {
    globalRouter = new Router();
  }
  return globalRouter;
}
