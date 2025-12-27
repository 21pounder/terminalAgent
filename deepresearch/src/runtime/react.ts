/**
 * ReAct 执行器 - 推理-行动循环
 *
 * 实现 Thought → Action → Observation 循环
 */
import type { ReActStep, AgentResult, SubagentType } from "../agents/types.js";
import { MAX_REACT_ITERATIONS } from "../config/constants.js";
import { LoopDetector, type BreakStrategy } from "./loop-detector.js";
import { ContextCompressor, type MessageEntry } from "./context-compressor.js";
import { getSharedContext } from "./shared.js";
import { getMessageBus } from "./bus.js";

// ReAct 状态
export type ReActStatus =
  | "running"
  | "success"
  | "max_iterations"
  | "loop_detected"
  | "aborted"
  | "needs_input";

// ReAct 结果
export interface ReActResult {
  status: ReActStatus;
  steps: ReActStep[];
  finalOutput?: string;
  reason?: string;
  totalDuration: number;
}

// ReAct 配置
export interface ReActConfig {
  maxIterations: number;
  enableLoopDetection: boolean;
  enableCompression: boolean;
  verbose: boolean;
}

// 思考函数类型
type ThinkFunction = (observation: string, history: ReActStep[]) => Promise<{
  thought: string;
  action: { tool: string; input: Record<string, unknown> };
  shouldStop: boolean;
}>;

// 行动函数类型
type ActFunction = (action: { tool: string; input: Record<string, unknown> }) => Promise<string>;

/**
 * ReAct 执行器类
 */
export class ReActExecutor {
  private config: ReActConfig;
  private loopDetector: LoopDetector;
  private compressor: ContextCompressor;
  private steps: ReActStep[];
  private messageHistory: MessageEntry[];
  private status: ReActStatus;
  private startTime: number;
  private bus = getMessageBus();
  private sharedContext = getSharedContext();

  // 外部注入的函数
  private thinkFn: ThinkFunction;
  private actFn: ActFunction;

  constructor(
    thinkFn: ThinkFunction,
    actFn: ActFunction,
    config: Partial<ReActConfig> = {}
  ) {
    this.thinkFn = thinkFn;
    this.actFn = actFn;

    this.config = {
      maxIterations: config.maxIterations ?? MAX_REACT_ITERATIONS,
      enableLoopDetection: config.enableLoopDetection ?? true,
      enableCompression: config.enableCompression ?? true,
      verbose: config.verbose ?? false,
    };

    this.loopDetector = new LoopDetector();
    this.compressor = new ContextCompressor();
    this.steps = [];
    this.messageHistory = [];
    this.status = "running";
    this.startTime = 0;
  }

  /**
   * 执行 ReAct 循环
   */
  async run(initialObservation: string): Promise<ReActResult> {
    this.startTime = Date.now();
    this.status = "running";
    this.steps = [];

    let observation = initialObservation;

    for (let i = 0; i < this.config.maxIterations; i++) {
      // 1. 检查上下文大小，必要时压缩
      if (this.config.enableCompression) {
        await this.maybeCompressContext();
      }

      // 2. 思考
      const thinkResult = await this.think(observation);

      if (thinkResult.shouldStop) {
        this.status = "success";
        return this.buildResult(thinkResult.thought);
      }

      // 3. 行动
      const actionOutput = await this.act(thinkResult.action);

      // 4. 记录步骤
      const step: ReActStep = {
        iteration: i + 1,
        thought: thinkResult.thought,
        action: thinkResult.action,
        observation: actionOutput,
        timestamp: Date.now(),
      };
      this.steps.push(step);

      // 5. 循环检测
      if (this.config.enableLoopDetection) {
        const breakStrategy = await this.checkLoop(thinkResult.action, actionOutput);

        if (breakStrategy.type !== "continue") {
          const handled = await this.handleLoopBreak(breakStrategy);
          if (!handled.continue) {
            this.status = handled.status;
            return this.buildResult(handled.reason);
          }
          // 注入提示到观察
          if (handled.hint) {
            observation = `${actionOutput}\n\n[System Hint]: ${handled.hint}`;
            continue;
          }
        }
      }

      // 6. 更新观察
      observation = actionOutput;

      // 7. 发送进度事件
      this.bus.emit("task:progress" as any, {
        iteration: i + 1,
        total: this.config.maxIterations,
        lastAction: thinkResult.action.tool,
      });
    }

    this.status = "max_iterations";
    return this.buildResult(`Reached maximum iterations (${this.config.maxIterations})`);
  }

  /**
   * 思考阶段
   */
  private async think(observation: string): Promise<{
    thought: string;
    action: { tool: string; input: Record<string, unknown> };
    shouldStop: boolean;
  }> {
    this.messageHistory.push({
      role: "tool",
      content: observation,
      timestamp: Date.now(),
    });

    const result = await this.thinkFn(observation, this.steps);

    this.messageHistory.push({
      role: "assistant",
      content: result.thought,
      timestamp: Date.now(),
    });

    if (this.config.verbose) {
      console.log(`[ReAct] Thought: ${result.thought.slice(0, 100)}...`);
    }

    return result;
  }

  /**
   * 行动阶段
   */
  private async act(action: { tool: string; input: Record<string, unknown> }): Promise<string> {
    if (this.config.verbose) {
      console.log(`[ReAct] Action: ${action.tool}`);
    }

    const output = await this.actFn(action);

    // 保存到共享上下文
    this.sharedContext.set(`react:lastAction`, {
      tool: action.tool,
      input: action.input,
      output: output.slice(0, 500),
    });

    return output;
  }

  /**
   * 检查循环
   */
  private async checkLoop(
    action: { tool: string; input: Record<string, unknown> },
    output: string
  ): Promise<BreakStrategy> {
    this.loopDetector.record(action.tool, action.input, output);
    const detection = this.loopDetector.detect();

    if (detection.detected) {
      if (this.config.verbose) {
        console.log(`[ReAct] Loop detected: ${detection.details}`);
      }
      return this.loopDetector.breakLoop(detection);
    }

    return { type: "continue" };
  }

  /**
   * 处理循环打破策略
   */
  private async handleLoopBreak(strategy: BreakStrategy): Promise<{
    continue: boolean;
    status: ReActStatus;
    reason?: string;
    hint?: string;
  }> {
    switch (strategy.type) {
      case "inject_hint":
        return { continue: true, status: "running", hint: strategy.hint };

      case "force_different_tool":
        return {
          continue: true,
          status: "running",
          hint: `Please use a different tool. Avoid: ${strategy.exclude.join(", ")}`,
        };

      case "escalate_to_user":
        return {
          continue: false,
          status: "needs_input",
          reason: strategy.reason,
        };

      case "abort":
        return {
          continue: false,
          status: "aborted",
          reason: strategy.reason,
        };

      default:
        return { continue: true, status: "running" };
    }
  }

  /**
   * 必要时压缩上下文
   */
  private async maybeCompressContext(): Promise<void> {
    if (this.compressor.needsCompression(this.messageHistory)) {
      const result = this.compressor.compress(this.messageHistory);
      this.messageHistory = result.messages;

      if (this.config.verbose) {
        console.log(
          `[ReAct] Context compressed: ${result.original} → ${result.compressed} tokens (${Math.round(result.ratio * 100)}%)`
        );
      }
    }
  }

  /**
   * 构建结果
   */
  private buildResult(finalOutput?: string): ReActResult {
    return {
      status: this.status,
      steps: this.steps,
      finalOutput,
      reason: this.status !== "success" ? finalOutput : undefined,
      totalDuration: Date.now() - this.startTime,
    };
  }

  /**
   * 获取当前步骤
   */
  getSteps(): ReActStep[] {
    return [...this.steps];
  }

  /**
   * 获取状态
   */
  getStatus(): ReActStatus {
    return this.status;
  }

  /**
   * 中止执行
   */
  abort(reason: string = "User aborted"): void {
    this.status = "aborted";
    this.sharedContext.set("react:aborted", { reason, timestamp: Date.now() });
  }

  /**
   * 重置执行器
   */
  reset(): void {
    this.steps = [];
    this.messageHistory = [];
    this.status = "running";
    this.loopDetector.reset();
    this.compressor.clearCache();
  }

  /**
   * 注入用户输入（用于 needs_input 状态）
   */
  async injectUserInput(input: string): Promise<ReActResult> {
    if (this.status !== "needs_input") {
      throw new Error("Cannot inject input when not in needs_input state");
    }

    this.status = "running";
    return this.run(input);
  }
}

/**
 * 创建简单的 ReAct 执行器（用于测试）
 */
export function createSimpleReActExecutor(
  agentType: SubagentType,
  queryFn: (prompt: string) => Promise<{ thought: string; action: any; output: string }>
): ReActExecutor {
  const thinkFn: ThinkFunction = async (observation, history) => {
    const prompt = buildReActPrompt(observation, history);
    const result = await queryFn(prompt);

    return {
      thought: result.thought,
      action: result.action,
      shouldStop: result.action.tool === "finish",
    };
  };

  const actFn: ActFunction = async (action) => {
    // 实际执行由外部处理
    const result = await queryFn(`Execute: ${JSON.stringify(action)}`);
    return result.output;
  };

  return new ReActExecutor(thinkFn, actFn);
}

/**
 * 构建 ReAct 提示词
 */
function buildReActPrompt(observation: string, history: ReActStep[]): string {
  let prompt = "You are using the ReAct (Reasoning + Acting) framework.\n\n";

  if (history.length > 0) {
    prompt += "Previous steps:\n";
    for (const step of history.slice(-5)) {
      prompt += `\nStep ${step.iteration}:\n`;
      prompt += `Thought: ${step.thought}\n`;
      prompt += `Action: ${step.action.tool}(${JSON.stringify(step.action.input)})\n`;
      prompt += `Observation: ${step.observation.slice(0, 200)}...\n`;
    }
    prompt += "\n";
  }

  prompt += `Current observation:\n${observation}\n\n`;
  prompt += "Respond with:\n";
  prompt += "1. Thought: Your reasoning about what to do next\n";
  prompt += "2. Action: The tool to use and its input\n";
  prompt += "3. If the task is complete, use the 'finish' tool\n";

  return prompt;
}
