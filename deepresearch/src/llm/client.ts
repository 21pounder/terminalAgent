/**
 * LLM API 客户端 - 使用原生 HTTPS 调用代理 API
 */
import * as https from "node:https";
import { config } from "../utils/config.js";
import type { Tool, Message, APIResponse, ContentBlock, ToolUse } from "./types.js";

export class LLMClient {
  private apiKey: string;
  private hostname: string;
  private model: string;
  private maxTokens: number;

  constructor() {
    this.apiKey = config.apiKey;
    // 从 baseUrl 提取 hostname
    const url = new URL(config.baseUrl);
    this.hostname = url.hostname;
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  /**
   * 原生 HTTPS 调用 API
   */
  private async callAPI(
    messages: Message[],
    options?: { systemPrompt?: string; tools?: Tool[] }
  ): Promise<APIResponse> {
    return new Promise((resolve, reject) => {
      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: messages,
      };

      if (options?.systemPrompt) {
        body.system = options.systemPrompt;
      }

      if (options?.tools && options.tools.length > 0) {
        body.tools = options.tools;
      }

      const data = JSON.stringify(body);

      const req = https.request(
        {
          hostname: this.hostname,
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => (responseBody += chunk));
          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(new Error(`API Error ${res.statusCode}: ${responseBody.slice(0, 500)}`));
              return;
            }
            try {
              const response = JSON.parse(responseBody) as APIResponse;
              resolve(response);
            } catch (e) {
              reject(new Error(`Parse error: ${responseBody.slice(0, 200)}`));
            }
          });
        }
      );

      req.on("error", (e) => reject(e));
      req.write(data);
      req.end();
    });
  }

  /**
   * 简单文本补全（无工具）
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.callAPI(
      [{ role: "user", content: prompt }],
      { systemPrompt }
    );
    return this.extractText(response);
  }

  /**
   * 带工具的消息调用
   */
  async chat(
    messages: Message[],
    options?: {
      systemPrompt?: string;
      tools?: Tool[];
    }
  ): Promise<APIResponse> {
    return this.callAPI(messages, options);
  }

  /**
   * 提取工具调用
   */
  extractToolUses(response: APIResponse): ToolUse[] {
    return response.content.filter((block): block is ToolUse => block.type === "tool_use");
  }

  /**
   * 提取文本内容
   */
  extractText(response: APIResponse): string {
    const textBlocks = response.content.filter(
      (block): block is { type: "text"; text: string } => block.type === "text"
    );
    return textBlocks.map((b) => b.text).join("");
  }

  /**
   * 检查是否需要继续（有工具调用）
   */
  shouldContinue(response: APIResponse): boolean {
    return response.stop_reason === "tool_use";
  }
}
