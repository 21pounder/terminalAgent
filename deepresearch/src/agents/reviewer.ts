/**
 * Reviewer Agent - 审查者
 *
 * 职责：代码审查、质量检查、安全检查
 */
import { BaseAgent, type AgentCallbacks } from "./base.js";
import type { AgentResult } from "./types.js";

// 审查结果
export interface ReviewResult {
  score: number; // 0-100
  issues: ReviewIssue[];
  suggestions: string[];
  summary: string;
}

// 审查问题
export interface ReviewIssue {
  type: "error" | "warning" | "info";
  file?: string;
  line?: number;
  message: string;
  severity: "critical" | "major" | "minor";
}

/**
 * Reviewer Agent 类
 */
export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("reviewer");
  }

  /**
   * 执行任务 - 使用 SDK 进行代码审查
   */
  async execute(
    task: string,
    context?: string,
    callbacks?: AgentCallbacks
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // 记录开始审查
    this.writeContext("reviewer:currentTask", {
      task: task.slice(0, 100),
      startTime,
      status: "reviewing",
    });

    // 广播开始消息
    this.broadcast(`Starting review: ${task.slice(0, 50)}...`);

    try {
      // 使用 SDK 执行实际的代码审查
      const result = await this.runSDKQuery(task, {
        context,
        callbacks,
      });

      // 更新状态
      this.writeContext("reviewer:currentTask", {
        task: task.slice(0, 100),
        startTime,
        status: result.success ? "completed" : "failed",
        endTime: Date.now(),
      });

      // 广播完成消息
      this.broadcast(`Review ${result.success ? "completed" : "failed"}: ${task.slice(0, 50)}...`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.writeContext("reviewer:currentTask", {
        task: task.slice(0, 100),
        startTime,
        status: "failed",
        error: errorMsg,
      });

      return {
        agent: "reviewer",
        task,
        output: `Review failed: ${errorMsg}`,
        success: false,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建系统提示词（覆盖基类）
   */
  protected buildFullSystemPrompt(): string {
    return `${this.systemPrompt}

IMPORTANT Language Rules:
- You MUST respond to the user in the same language they use
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English

IMPORTANT Working Directory:
- The user is working in: ${this.userCwd}
- When reading/writing files, use paths relative to ${this.userCwd} or absolute paths

You are the Reviewer agent - a specialized code reviewer and quality analyst.

Your primary tools are:
- Read: Read code to review
- Glob/Grep: Find relevant code and patterns
- Bash: Run linters, tests, and analysis tools
- LSP: Check types and references

Focus on:
1. Code quality and maintainability
2. Potential bugs and edge cases
3. Security vulnerabilities (OWASP top 10)
4. Performance issues
5. Code style and consistency

For each issue found, specify:
- Severity (critical/major/minor)
- File and line number if applicable
- Clear description and fix suggestion

Do NOT modify any files. Only analyze and report.`;
  }

  /**
   * 生成审查报告
   */
  generateReport(results: ReviewResult[]): string {
    if (results.length === 0) {
      return "No review results available.";
    }

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const allIssues = results.flatMap((r) => r.issues);
    const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
    const majorCount = allIssues.filter((i) => i.severity === "major").length;
    const minorCount = allIssues.filter((i) => i.severity === "minor").length;

    let report = `# Code Review Report\n\n`;
    report += `## Summary\n`;
    report += `- Average Score: ${avgScore.toFixed(1)}/100\n`;
    report += `- Critical Issues: ${criticalCount}\n`;
    report += `- Major Issues: ${majorCount}\n`;
    report += `- Minor Issues: ${minorCount}\n\n`;

    if (allIssues.length > 0) {
      report += `## Issues\n\n`;
      for (const issue of allIssues) {
        const icon = issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "ℹ️";
        report += `${icon} [${issue.severity}] ${issue.message}`;
        if (issue.file) {
          report += ` (${issue.file}${issue.line ? `:${issue.line}` : ""})`;
        }
        report += "\n";
      }
    }

    return report;
  }
}

/**
 * 创建 Reviewer Agent
 */
export function createReviewerAgent(): ReviewerAgent {
  return new ReviewerAgent();
}
