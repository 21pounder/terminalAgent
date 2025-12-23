/**
 * Agent loop logic
 */
import { LLMClient } from "../llm/index.js";
import type { Message, ToolUse, ToolResult } from "../llm/types.js";
import { agentSystemPrompt, agentTools } from "./prompts.js";
import { logger } from "../utils/index.js";
import { glob, grep, readFile, writeFile, editFile, run } from "../tools/index.js";

const MAX_ITERATIONS = 15;

/**
 * Execute tool call
 */
async function executeTool(toolUse: ToolUse): Promise<string> {
  const { name, input } = toolUse;
  const args = input as Record<string, string>;

  try {
    switch (name) {
      case "Glob":
        const files = await glob(args.pattern, args.cwd);
        return files.length > 0
          ? `Found ${files.length} files:\n${files.join("\n")}`
          : "No matching files found";

      case "Grep":
        return await grep(args.pattern, args.path, { include: args.include });

      case "Read":
        return await readFile(args.file_path);

      case "Write":
        return await writeFile(args.file_path, args.content);

      case "Edit":
        return await editFile(args.file_path, args.old_string, args.new_string);

      case "Bash":
        return await run(args.command, args.cwd);

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Agent loop
 */
export async function agentLoop(userMessage: string): Promise<void> {
  const llm = new LLMClient();
  const messages: Message[] = [{ role: "user", content: userMessage }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 调用 LLM
    const response = await llm.chat(messages, {
      systemPrompt: agentSystemPrompt,
      tools: agentTools,
    });

    // 提取文本和工具调用
    const text = llm.extractText(response);
    const toolUses = llm.extractToolUses(response);

    // 输出文本
    if (text) {
      logger.output(text);
    }

    // 如果没有工具调用，结束循环
    if (toolUses.length === 0) {
      break;
    }

    // 添加 assistant 消息
    messages.push({ role: "assistant", content: response.content });

    // 执行工具调用
    const toolResults: ToolResult[] = [];

    for (const toolUse of toolUses) {
      logger.tool(toolUse.name, `Executing...`);

      const result = await executeTool(toolUse);

      // 显示结果摘要
      const preview = result.length > 200 ? result.slice(0, 200) + "..." : result;
      logger.output(preview);

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // 添加工具结果
    messages.push({ role: "user", content: toolResults });
  }
}
