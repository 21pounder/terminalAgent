/**
 * 流式响应处理
 */
import type { ContentBlock } from "./types.js";

export interface StreamChunk {
  type: "text" | "tool_use_start" | "tool_use_delta" | "tool_use_end";
  text?: string;
  toolUse?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  partialJson?: string;
}

/**
 * 处理流式响应，收集完整的工具调用
 */
export async function streamResponse(
  stream: AsyncIterable<{ type: string; text?: string; toolUse?: ContentBlock }>,
  onText?: (text: string) => void
): Promise<{ text: string; toolUses: ContentBlock[] }> {
  let fullText = "";
  const toolUses: ContentBlock[] = [];

  for await (const chunk of stream) {
    if (chunk.type === "text" && chunk.text) {
      fullText += chunk.text;
      onText?.(chunk.text);
    } else if (chunk.type === "tool_use" && chunk.toolUse) {
      toolUses.push(chunk.toolUse);
    }
  }

  return { text: fullText, toolUses };
}
